import Hummingbird
import Foundation
import NIOCore
import FoundationModels

let model = SystemLanguageModel.default

let router = Router()

router.post("slip") { request, context -> Response in
		// Optional shared-secret auth
		// guard request.headers[.authorization] == "Bearer \(secret)" else {
		//     return Response(status: .unauthorized)
		// }

		let buffer = try await request.body.collect(upTo: 10_000_000) // 10 MB
		let data = Data(buffer: buffer)

		guard let cg = loadCGImage(from: data) else {
				return Response(status: .unprocessableContent)
		}

		let session = LanguageModelSession(model: model, instructions: instructions)
		let obs = try await recognizeStructured(cg)   // fallback to recognize(cg) if empty
		let fields = try await extract(file: "upload", obs: obs, session: session)

		let json = try JSONSerialization.data(withJSONObject: fields, options: [.withoutEscapingSlashes])
		
		return Response(
				status: .ok,
				headers: [.contentType: "application/json"],
				body: .init(byteBuffer: ByteBuffer(data: json))
		)
}

let app = Application(router: router,
											configuration: .init(address: .hostname("0.0.0.0", port: 4001)))
try await app.runService()