package expo.modules.shotocr

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class ShotOcrModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("ShotOcr")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val image = InputImage.fromFilePath(context, Uri.parse(uri))
      recognize(image, { promise.resolve(it.text) }) { error ->
        promise.reject("OCR_FAILED", "无法识别截图", error)
      }
    }

    AsyncFunction("preparePrivacyImage") { uri: String, promise: Promise ->
      val bitmap = loadOrientedBitmap(Uri.parse(uri))
      val width = bitmap.width
      val height = bitmap.height
      val preview = savePrivacyPng(bitmap)
      fun resolve(lines: List<Map<String, Any>>?) {
        promise.resolve(mapOf("uri" to preview, "width" to width, "height" to height, "lines" to lines))
      }
      try {
        recognize(InputImage.fromBitmap(bitmap, 0), { result ->
          resolve(result.textBlocks.flatMap { block ->
            block.lines.mapNotNull { line ->
              line.boundingBox?.let { box ->
                mapOf("text" to line.text, "box" to listOf(box.left, box.top, box.width(), box.height()))
              }
            }
          })
        }) { resolve(null) }
      } catch (_: Exception) {
        resolve(null)
      }
    }

    AsyncFunction("redactImage") { uri: String, boxes: List<List<Int>> ->
      val path = Uri.parse(uri).path ?: error("无法读取图片")
      val bitmap = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply {
        inMutable = true
        inPreferredConfig = Bitmap.Config.ARGB_8888
      }) ?: error("无法读取图片")
      require(boxes.isNotEmpty() && boxes.all { box ->
        box.size == 4 && box[0] >= 0 && box[1] >= 0 && box[2] > 0 && box[3] > 0 &&
          box[0] <= bitmap.width - box[2] && box[1] <= bitmap.height - box[3]
      }) { "无法应用遮挡区域" }

      val canvas = Canvas(bitmap)
      val paint = Paint().apply { color = Color.BLACK }
      for ((x, y, width, height) in boxes) {
        canvas.drawRect(x.toFloat(), y.toFloat(), (x + width).toFloat(), (y + height).toFloat(), paint)
      }
      savePrivacyPng(bitmap)
    }

    Function("canScheduleExactAlarms") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        context.getSystemService(AlarmManager::class.java)?.canScheduleExactAlarms() == true
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.startActivity(
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + context.packageName))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }
  }

  private fun recognize(image: InputImage, onSuccess: (Text) -> Unit, onFailure: (Exception) -> Unit) {
    val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
    try {
      recognizer.process(image)
        .addOnSuccessListener { onSuccess(it) }
        .addOnFailureListener { onFailure(it) }
        .addOnCompleteListener { recognizer.close() }
    } catch (error: Exception) {
      recognizer.close()
      throw error
    }
  }

  private fun loadOrientedBitmap(uri: Uri): Bitmap {
    val resolver = context.contentResolver
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      return ImageDecoder.decodeBitmap(ImageDecoder.createSource(resolver, uri)) { decoder, _, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
      }
    }

    val orientation = resolver.openInputStream(uri)?.use { stream ->
      runCatching {
        ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    }
    val bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) } ?: error("无法读取图片")
    val transform = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> transform.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 -> transform.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> transform.setScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        transform.setRotate(90f)
        transform.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_90 -> transform.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        transform.setRotate(90f)
        transform.postScale(1f, -1f)
      }
      ExifInterface.ORIENTATION_ROTATE_270 -> transform.setRotate(-90f)
    }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, transform, false)
  }

  private fun savePrivacyPng(bitmap: Bitmap): String {
    val file = File.createTempFile("shot-privacy-", ".png", context.cacheDir)
    try {
      file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
      return Uri.fromFile(file).toString()
    } catch (error: Exception) {
      file.delete()
      throw error
    }
  }
}
