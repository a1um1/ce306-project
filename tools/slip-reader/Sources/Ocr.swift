import Foundation
import Vision
import ImageIO

struct Obs {
    let text: String
    let box: CGRect // Vision coords: normalized, origin bottom-left
    let confidence: Float
}

struct DocResult {
    let transcript: String
    let paragraphs: [String]
    let tables: [[[String]]]   // table -> row -> cell text
    let lists: [[String]]      // list -> item text
}

func recognize(_ cg: CGImage) throws -> [Obs] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["th-TH", "en-US"]
    try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
    return (request.results ?? [])
        .compactMap { o -> Obs? in
            guard let c = o.topCandidates(1).first else { return nil }
            return Obs(text: c.string, box: o.boundingBox, confidence: c.confidence)
        }
        .sorted { $0.box.midY > $1.box.midY }
}

// New path: use the document's own reading-order transcript.
@available(iOS 26.0, macOS 26.0, *)
func recognizeStructured(_ cg: CGImage) async throws -> [Obs] {
    let request = RecognizeDocumentsRequest()
    let observations = try await request.perform(on: cg)
    guard let doc = observations.first?.document else { return [] }
    return doc.text.transcript
        .split(whereSeparator: \.isNewline)
        .map { Obs(text: String($0), box: .zero, confidence: 1) }
}

func loadCGImage(from data: Data, maxEdge: Int = 2000) -> CGImage? {
    guard let src = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
    let opts: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxEdge,
    ]
    return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
}