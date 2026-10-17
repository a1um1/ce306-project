// Vision OCR: image -> recognized text observations.
import Foundation
import Vision
import ImageIO

struct Obs {
    let text: String
    let box: CGRect // Vision coords: normalized, origin bottom-left
    let confidence: Float
}

func recognize(_ cg: CGImage) throws -> [Obs] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["th-TH", "en-US"]
    try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
    return (request.results ?? []).compactMap { o in
        guard let c = o.topCandidates(1).first else { return nil }
        return Obs(text: c.string, box: o.boundingBox, confidence: c.confidence)
    }
}

// Single-pass decode + downscale. maxEdge caps the long side: 0.6x of a typical
// slip is the accuracy cliff we measured; keep >= 760.
func loadCGImage(_ path: String, maxEdge: Int = 760) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
    let opts: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxEdge,
    ]
    return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
}
