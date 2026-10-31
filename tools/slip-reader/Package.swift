// swift-tools-version: 6.4
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "slip-reader",
    platforms: [.macOS(.v26)],
    dependencies: [
        .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "2.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "slip-service",
            dependencies: [
                .product(name: "Hummingbird", package: "hummingbird"),
            ],
						path: "Sources"
        ),
    ]
)
