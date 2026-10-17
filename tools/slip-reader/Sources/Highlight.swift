// Highlight PNG: draw boxes + labels for the extracted regions.
import Foundation
import AppKit

let palette: [String: NSColor] = [
    "date": .systemBlue, "txn": .systemPurple, "amount": .systemGreen,
    "fee": .systemOrange, "sender": .systemRed, "recipient": .systemTeal,
]

func highlight(_ cg: CGImage, regions: [(String, Obs)], to path: String) {
    let w = cg.width, h = cg.height
    guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { return }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

    let labelAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.boldSystemFont(ofSize: max(14, CGFloat(w) / 55)),
        .foregroundColor: NSColor.black,
        .backgroundColor: NSColor.white.withAlphaComponent(0.85),
    ]
    for (label, o) in regions {
        let color = palette[label] ?? .systemPink
        // Vision origin bottom-left; NSGraphicsContext bitmap is also bottom-left.
        let padX = o.box.width * CGFloat(w) * 0.04, padY = o.box.height * CGFloat(h) * 0.25
        let rect = CGRect(x: o.box.minX * CGFloat(w) - padX, y: o.box.minY * CGFloat(h) - padY,
                          width: o.box.width * CGFloat(w) + 2 * padX, height: o.box.height * CGFloat(h) + 2 * padY)
        let p = NSBezierPath(roundedRect: rect, xRadius: 6, yRadius: 6)
        p.lineWidth = 3
        color.setStroke(); p.stroke()
        color.withAlphaComponent(0.12).setFill(); p.fill()
        (label as NSString).draw(at: CGPoint(x: rect.minX, y: rect.maxY + 2), withAttributes: labelAttrs)
    }
    NSGraphicsContext.restoreGraphicsState()
    if let png = rep.representation(using: .png, properties: [:]) {
        try? png.write(to: URL(fileURLWithPath: path))
    }
}
