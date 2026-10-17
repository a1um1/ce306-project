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

// Single-pass decode + downscale. maxEdge caps the long side. 768 is the
// accuracy floor we measured; 1280 keeps headroom for soft phone photos at no
// output cost on sharp slips. SLIP_MAX_EDGE overrides it (re-measure the cliff).
func loadCGImage(_ path: String, maxEdge: Int = 0) -> CGImage? {
    let edge = maxEdge > 0
        ? maxEdge
        : (ProcessInfo.processInfo.environment["SLIP_MAX_EDGE"].flatMap(Int.init) ?? 1280)
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
    let opts: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: edge,
    ]
    return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
}
