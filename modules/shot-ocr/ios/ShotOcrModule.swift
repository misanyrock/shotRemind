import ExpoModulesCore
import Foundation
import Vision

public final class ShotOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShotOcr")

    AsyncFunction("recognize") { (uri: String) -> String in
      guard let url = URL(string: uri), url.isFileURL else {
        throw Exception(name: "InvalidImage", description: "无法读取截图")
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      let supportedLanguages = try request.supportedRecognitionLanguages()
      request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"].filter { supportedLanguages.contains($0) }
      request.usesLanguageCorrection = true

      try VNImageRequestHandler(url: url).perform([request])
      return (request.results ?? [])
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")
    }
  }
}
