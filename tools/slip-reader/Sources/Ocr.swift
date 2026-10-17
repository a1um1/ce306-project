// Vision OCR: image -> recognized text observations.
import Foundation
import Vision
import AppKit

struct Obs {
    let text: String
    let box: CGRect // Vision coords: normalized, origin bottom-left
    let confidence: Float
}

func recognize(_ cg: CGImage) throws -> [Obs] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["th-TH", "en-US"]
    try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
    return (request.results ?? []).compactMap { o in
        guard let c = o.topCandidates(1).first else { return nil }
        return Obs(text: c.string, box: o.boundingBox, confidence: c.confidence)
    }
}

func loadCGImage(_ path: String) -> CGImage? {
    guard let img = NSImage(contentsOfFile: path),
          let tiff = img.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff) else { return nil }
    return rep.cgImage
}
