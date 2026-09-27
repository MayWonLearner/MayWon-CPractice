import AppKit

// A large C above an open book: language + learning, readable at Dock sizes.
let iconset = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let transform = NSAffineTransform()
        transform.scale(by: CGFloat(pixels) / 1024)
        transform.concat()
        NSColor.clear.setFill()
        NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()
        let tile = NSBezierPath(roundedRect: NSRect(x: 64, y: 64, width: 896, height: 896),
            xRadius: 198, yRadius: 198)
        NSColor(calibratedRed: 0.65, green: 0.90, blue: 0.72, alpha: 1).setFill()
        tile.fill()
        let ink = NSColor(calibratedRed: 0.075, green: 0.20, blue: 0.16, alpha: 1)
        let c = NSBezierPath()
        c.appendArc(withCenter: NSPoint(x: 507, y: 621), radius: 181,
            startAngle: 45, endAngle: 315, clockwise: false)
        c.lineWidth = 91
        c.lineCapStyle = .round
        ink.setStroke()
        c.stroke()
        let book = NSBezierPath()
        book.move(to: NSPoint(x: 257, y: 355))
        book.curve(to: NSPoint(x: 512, y: 305), controlPoint1: NSPoint(x: 360, y: 369), controlPoint2: NSPoint(x: 435, y: 347))
        book.curve(to: NSPoint(x: 767, y: 355), controlPoint1: NSPoint(x: 589, y: 347), controlPoint2: NSPoint(x: 664, y: 369))
        book.line(to: NSPoint(x: 767, y: 241))
        book.curve(to: NSPoint(x: 512, y: 192), controlPoint1: NSPoint(x: 665, y: 254), controlPoint2: NSPoint(x: 588, y: 233))
        book.curve(to: NSPoint(x: 257, y: 241), controlPoint1: NSPoint(x: 436, y: 233), controlPoint2: NSPoint(x: 359, y: 254))
        book.close()
        NSColor(calibratedRed: 0.97, green: 0.99, blue: 0.95, alpha: 1).setFill()
        book.fill()
        book.lineWidth = 22
        book.lineJoinStyle = .round
        book.stroke()
        let spine = NSBezierPath()
        spine.move(to: NSPoint(x: 512, y: 305))
        spine.line(to: NSPoint(x: 512, y: 199))
        spine.lineWidth = 20
        spine.lineCapStyle = .round
        spine.stroke()
        NSGraphicsContext.restoreGraphicsState()
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try bitmap.representation(using: .png, properties: [:])!.write(to: iconset.appendingPathComponent(name))
    }
}
if CommandLine.arguments.count > 2 {
    func sizeBytes(_ value: Int) -> Data {
        var number = UInt32(value).bigEndian
        return withUnsafeBytes(of: &number) { Data($0) }
    }
    let entries = [("icp4", "icon_16x16.png"), ("icp5", "icon_32x32.png"),
        ("icp6", "icon_32x32@2x.png"), ("ic07", "icon_128x128.png"),
        ("ic08", "icon_256x256.png"), ("ic09", "icon_512x512.png"),
        ("ic10", "icon_512x512@2x.png"), ("ic11", "icon_16x16@2x.png"),
        ("ic12", "icon_32x32@2x.png"), ("ic13", "icon_128x128@2x.png"),
        ("ic14", "icon_256x256@2x.png")]
    var payload = Data()
    for (type, filename) in entries {
        let png = try Data(contentsOf: iconset.appendingPathComponent(filename))
        payload.append(Data(type.utf8))
        payload.append(sizeBytes(png.count + 8))
        payload.append(png)
    }
    var icon = Data("icns".utf8)
    icon.append(sizeBytes(payload.count + 8))
    icon.append(payload)
    try icon.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
}
