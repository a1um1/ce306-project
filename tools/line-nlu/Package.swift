// swift-tools-version: 6.4
// LINE NLU service: Apple Foundation Model -> Thai expense tool calls.
// Same shape as tools/slip-reader (Hummingbird HTTP + FoundationModels).
import PackageDescription

let package = Package(
    name: "line-nlu",
    platforms: [.macOS(.v26)],
    dependencies: [
        .package(url: "https://github.com/hummingbird-project/hummingbird.git", from: "2.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "line-nlu",
            dependencies: [
                .product(name: "Hummingbird", package: "hummingbird"),
            ],
            path: "Sources"
        ),
    ]
)
