import ExpoModulesCore
import Foundation
import ImageIO
import UIKit
import Vision

public final class ShotOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShotOcr")

    AsyncFunction("recognize") { (uri: String) -> String in
      guard let url = URL(string: uri), url.isFileURL else {
        throw Exception(name: "InvalidImage", description: "无法读取截图")
      }

      return try Self.recognize(VNImageRequestHandler(url: url))
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")
    }

    AsyncFunction("preparePrivacyImage") { (uri: String) -> [String: Any] in
      guard let url = URL(string: uri), url.isFileURL,
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
        let width = properties[kCGImagePropertyPixelWidth] as? Int,
        let height = properties[kCGImagePropertyPixelHeight] as? Int,
        let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
          kCGImageSourceCreateThumbnailFromImageAlways: true,
          kCGImageSourceCreateThumbnailWithTransform: true,
          kCGImageSourceThumbnailMaxPixelSize: max(width, height),
        ] as CFDictionary)
      else { throw Exception(name: "InvalidImage", description: "无法读取图片") }

      let preview = try Self.savePrivacyPNG(UIImage(cgImage: image))
      let lines = try? Self.recognize(VNImageRequestHandler(cgImage: image)).compactMap { observation -> [String: Any]? in
        guard let text = observation.topCandidates(1).first?.string else { return nil }
        let box = observation.boundingBox
        let w = CGFloat(image.width)
        let h = CGFloat(image.height)
        let left = Int(floor(box.minX * w))
        let top = Int(floor((1 - box.maxY) * h))
        return ["text": text, "box": [left, top, Int(ceil(box.maxX * w)) - left, Int(ceil((1 - box.minY) * h)) - top]]
      }
      return ["uri": preview, "width": image.width, "height": image.height, "lines": lines as Any? ?? NSNull()]
    }

    AsyncFunction("redactImage") { (uri: String, boxes: [[Int]]) -> String in
      guard let url = URL(string: uri), url.isFileURL,
        let image = UIImage(contentsOfFile: url.path), let pixels = image.cgImage,
        !boxes.isEmpty, boxes.allSatisfy({ box in
          box.count == 4 && box[0] >= 0 && box[1] >= 0 && box[2] > 0 && box[3] > 0
            && box[0] <= pixels.width - box[2] && box[1] <= pixels.height - box[3]
        })
      else { throw Exception(name: "InvalidRedaction", description: "无法应用遮挡区域") }

      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.preferredRange = .standard
      let size = CGSize(width: pixels.width, height: pixels.height)
      let redacted = UIGraphicsImageRenderer(size: size, format: format).image { context in
        image.draw(in: CGRect(origin: .zero, size: size))
        context.cgContext.setShouldAntialias(false)
        context.cgContext.setFillColor(UIColor.black.cgColor)
        for box in boxes {
          context.fill(CGRect(x: box[0], y: box[1], width: box[2], height: box[3]))
        }
      }
      return try Self.savePrivacyPNG(redacted)
    }
  }

  private static func recognize(_ handler: VNImageRequestHandler) throws -> [VNRecognizedTextObservation] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    let supportedLanguages = try request.supportedRecognitionLanguages()
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"].filter { supportedLanguages.contains($0) }
    request.usesLanguageCorrection = true
    try handler.perform([request])
    return request.results ?? []
  }

  private static func savePrivacyPNG(_ image: UIImage) throws -> String {
    guard let png = image.pngData() else {
      throw Exception(name: "ExportFailed", description: "无法生成图片")
    }
    let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let url = cache.appendingPathComponent("shot-privacy-\(UUID().uuidString).png")
    try png.write(to: url, options: .atomic)
    return url.absoluteString
  }
}
