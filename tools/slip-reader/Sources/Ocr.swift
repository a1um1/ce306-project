import Foundation
import Vision
import ImageIO
import CoreImage
import CoreImage.CIFilterBuiltins

private let ciContext = CIContext()
struct Block {
    var lines: [String]
    var box: CGRect
    var text: String { lines.joined(separator: "\n") }
}

func formatBlocks(_ blocks: [Block]) -> String {
    blocks.enumerated()
        .map { "\($0.element.text)" }
        .joined(separator: "\n")
}

struct Obs {
    let text: String
    let box: CGRect
    let confidence: Float
}

struct DocResult {
    let transcript: String
    let paragraphs: [String]
    let tables: [[[String]]]
    let lists: [[String]]
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

@available(iOS 26.0, macOS 26.0, *)
func recognizeStructured(_ cg: CGImage) async throws -> [Obs] {
    let request = RecognizeDocumentsRequest()
    let observations = try await request.perform(on: cg)
    guard let doc = observations.first?.document else { return [] }
    return doc.text.transcript
        .split(whereSeparator: \.isNewline)
        .map { Obs(text: String($0), box: .zero, confidence: 1) }
}

private func readingOrder(_ a: Block, _ b: Block) -> Bool {
    // top to bottom; if on the same band, left to right
    if abs(a.box.midY - b.box.midY) > min(a.box.height, b.box.height) * 0.5 {
        return a.box.midY > b.box.midY
    }
    return a.box.minX < b.box.minX
}

@available(macOS 26.0, iOS 26.0, *)
func recognizeBlocks(_ cg: CGImage) async throws -> [Block] {
    let request = RecognizeDocumentsRequest()
    let observations = try await request.perform(on: cg)
    guard let doc = observations.first?.document else { return [] }

    let blocks = doc.paragraphs
        .map { p in
            Block(
                lines: p.transcript
                    .split(whereSeparator: \.isNewline)
                    .map { String($0).trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty },
                box: p.boundingRegion.boundingBox.cgRect
            )
        }
        .filter { !$0.lines.isEmpty }
        .sorted(by: readingOrder)

    if ProcessInfo.processInfo.environment["SLIP_DEBUG"] != nil {
        FileHandle.standardError.write((formatBlocks(blocks) + "\n---\n").data(using: .utf8)!)
    }
    return blocks
}

func loadCGImage(from data: Data, maxEdge: Int = 0) -> CGImage? {
    guard let src = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
    return load(from: src, maxEdge: maxEdge)
}

private func load(from src: CGImageSource, maxEdge: Int) -> CGImage? {
    let maxE = maxEdge > 0
        ? maxEdge
        : (ProcessInfo.processInfo.environment["SLIP_MAX_EDGE"].flatMap(Int.init) ?? 1600)
    let minE = 1600  // upscale anything whose long edge is below this

    let opts: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxE,
    ]
    guard let base = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }

    var img = CIImage(cgImage: base)

    // Upscale small images up to minE on the long edge.
    let longEdge = max(img.extent.width, img.extent.height)
    if longEdge < CGFloat(minE) {
        let f = CIFilter.lanczosScaleTransform()
        f.inputImage = img
        f.scale = Float(CGFloat(minE) / longEdge)
        f.aspectRatio = 1
        img = f.outputImage ?? img
    }

    // Enhance: grayscale, mild contrast, mild sharpen.
    let c = CIFilter.colorControls()
    c.inputImage = img
    c.saturation = 0
    c.contrast = 1.2
    c.brightness = 0
    let s = CIFilter.sharpenLuminance()
    s.inputImage = c.outputImage ?? img
    s.sharpness = 0.4
    img = s.outputImage ?? img

    return ciContext.createCGImage(img, from: img.extent) ?? base
}