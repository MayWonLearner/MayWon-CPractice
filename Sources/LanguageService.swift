import Foundation

final class LanguageService {
    private let queue = DispatchQueue(label: "CPractice.language")
    private var process: Process?
    private var input: FileHandle?
    private var sequence = 0
    private var callbacks: [Int: (Any?) -> Void] = [:]
    private var ready = false
    private var waiting: [() -> Void] = []
    private var text = ""
    private var documentOpen = false
    private var serverVersion = 0
    private var editorVersion = 0
    private let directory = FileManager.default.temporaryDirectory.appendingPathComponent("CPracticeLanguage-" + UUID().uuidString)
    private var uri: String { directory.appendingPathComponent("main.c").absoluteString }
    var emit: (([String:Any]) -> Void)?
    private func sendToUI(_ data: [String:Any]) { DispatchQueue.main.async { [weak self] in self?.emit?(data) } }
    private func write(_ object: [String:Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object), let input else { return }
        do { try input.write(contentsOf: Data("Content-Length: \(data.count)\r\n\r\n".utf8) + data) } catch { }
    }
    private func notify(_ method: String, _ params: [String:Any]) { write(["jsonrpc":"2.0", "method":method, "params":params]) }
    private func request(_ method: String, _ params: [String:Any], _ callback: @escaping (Any?) -> Void) {
        sequence += 1; let id = sequence; callbacks[id] = callback
        write(["jsonrpc":"2.0", "id":id, "method":method, "params":params])
        queue.asyncAfter(deadline:.now()+5) { [weak self] in self?.callbacks.removeValue(forKey:id)?(nil) }
    }
    private func command(_ arguments: [String]) -> String? {
        let p=Process(), out=Pipe(); p.executableURL=URL(fileURLWithPath:"/usr/bin/xcrun");p.arguments=arguments;p.standardOutput=out;p.standardError=FileHandle.nullDevice
        do { try p.run();DispatchQueue.global().asyncAfter(deadline:.now()+5){if p.isRunning {p.terminate()}}
            let data=out.fileHandleForReading.readDataToEndOfFile();p.waitUntilExit();return p.terminationStatus==0 ? String(data:data,encoding:.utf8) : nil
        }catch{return nil}
    }
    private func start() {
        guard process == nil else { return }
        do {
            try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
            let sdk=command(["--show-sdk-path"])?.trimmingCharacters(in:.whitespacesAndNewlines) ?? ""
            let flags=["-std=c17","-Wall","-Wextra","-Wpedantic","-isysroot",sdk]
            try Data(flags.joined(separator:"\n").utf8).write(to:directory.appendingPathComponent("compile_flags.txt"))
            let p=Process(), stdin=Pipe(), stdout=Pipe()
            p.executableURL=URL(fileURLWithPath:"/usr/bin/xcrun");p.arguments=["clangd","--background-index=false","--clang-tidy=false","--header-insertion=never","--enable-config=false","--log=error"]
            p.currentDirectoryURL=directory;p.standardInput=stdin;p.standardOutput=stdout;p.standardError=FileHandle.nullDevice
            try p.run();process=p;input=stdin.fileHandleForWriting
            DispatchQueue.global(qos:.utility).async { [weak self] in
                var buffer=Data();let delimiter=Data("\r\n\r\n".utf8)
                while p.isRunning {
                    let data=stdout.fileHandleForReading.availableData;if data.isEmpty {break};buffer.append(data)
                    while let boundary=buffer.range(of:delimiter) {
                        let header=String(decoding:buffer[..<boundary.lowerBound],as:UTF8.self)
                        guard let line=header.components(separatedBy:"\r\n").first(where:{$0.lowercased().hasPrefix("content-length:")}),let n=Int(line.dropFirst(15).trimmingCharacters(in:.whitespaces)),n>=0,n<8_000_000 else {buffer.removeAll();break}
                        let start=boundary.upperBound;guard buffer.count>=start+n else {break}
                        let body=Data(buffer[start..<start+n]);buffer.removeSubrange(0..<start+n)
                        if let obj=try? JSONSerialization.jsonObject(with:body) as? [String:Any] {self?.queue.async {[weak self] in self?.receive(obj)}}
                    }
                }
            }
            request("initialize",["processId":ProcessInfo.processInfo.processIdentifier,"rootUri":directory.absoluteString,"capabilities":["textDocument":["completion":["completionItem":["snippetSupport":true]],"hover":["contentFormat":["markdown","plaintext"]],"documentSymbol":["hierarchicalDocumentSymbolSupport":true]]]]) { [weak self] result in
                guard let self else{return};self.ready=result != nil;self.notify("initialized",[:]);let jobs=self.waiting;self.waiting=[];jobs.forEach{$0()}
            }
        } catch { sendToUI(["serviceError":"无法启动 clangd，请检查 Command Line Tools。"]);let jobs=waiting;waiting=[];jobs.forEach{$0()} }
    }
    private func receive(_ obj: [String:Any]) {
        if let id=obj["id"] as? Int {callbacks.removeValue(forKey:id)?(obj["result"]);return}
        if obj["method"] as? String == "textDocument/publishDiagnostics",let params=obj["params"] as? [String:Any],params["uri"] as? String == uri,let diagnostics=params["diagnostics"],params["version"] as? Int == serverVersion {
            sendToUI(["diagnostics":diagnostics,"version":editorVersion,"uri":uri])
        }
    }
    func handle(_ body: [String:Any]) {
        guard let requestID=body["requestID"] as? Int,let method=body["method"] as? String,let code=body["code"] as? String,code.utf8.count<=262144 else{return}
        queue.async { [weak self] in
            guard let self else{return}
            let action = { [weak self] in
                guard let self else{return}
                let reply: (Any?) -> Void = {result in self.sendToUI(["requestID":requestID,"result":result ?? NSNull(),"uri":self.uri])}
                if method == "format" {
                    let file=self.directory.appendingPathComponent("format.c");try? Data(code.utf8).write(to:file)
                    reply(self.command(["clang-format","--style={BasedOnStyle: LLVM, IndentWidth: 4, ColumnLimit: 88, AllowShortFunctionsOnASingleLine: None, AllowShortIfStatementsOnASingleLine: Never, AllowShortLoopsOnASingleLine: false}",file.path]));return
                }
                guard self.ready else {reply(nil);return}
                self.editorVersion=body["version"] as? Int ?? 0
                if code != self.text || !self.documentOpen {
                    self.text=code;self.serverVersion += 1
                    if !self.documentOpen {self.notify("textDocument/didOpen",["textDocument":["uri":self.uri,"languageId":"c","version":self.serverVersion,"text":code]]);self.documentOpen=true}
                    else {self.notify("textDocument/didChange",["textDocument":["uri":self.uri,"version":self.serverVersion],"contentChanges":[["text":code]]])}
                }
                if method == "sync" {reply(true);return}
                let allowed=["textDocument/completion","textDocument/hover","textDocument/definition","textDocument/references","textDocument/documentSymbol","textDocument/signatureHelp","textDocument/rename"]
                guard allowed.contains(method) else{reply(nil);return}
                var params=body["params"] as? [String:Any] ?? [:];params["textDocument"]=["uri":self.uri]
                self.request(method,params,reply)
            }
            if self.ready {action()} else {self.waiting.append(action);self.start()}
        }
    }
    func stop() { process?.terminate();try? FileManager.default.removeItem(at:directory) }
}
