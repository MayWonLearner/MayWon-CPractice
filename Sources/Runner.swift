import Foundation
import Darwin

struct Checkpoint: Codable {
    let name: String
    let input: String
    let expected: String
    let files: [String:String]?
    let outputFiles: [String:String]?
}
struct Exercise: Codable { let id: String; let tests: [Checkpoint] }
struct LessonExample: Decodable { let id: String; let input: String; let expected: String }
struct Tutorial: Decodable { let lessons: [LessonExample] }
struct Catalog: Decodable { let problems: [Exercise]; let tutorials: [Tutorial]? }
struct RunRequest: Decodable {
    let code: String
    let problemID: String
    let mode: String
    let input: String?
    let exercise: Exercise?
    init(code: String, problemID: String, mode: String, input: String?, exercise: Exercise? = nil) {
        self.code=code; self.problemID=problemID; self.mode=mode; self.input=input; self.exercise=exercise
    }
}
struct CheckResult: Codable {
    let name: String
    let input: String
    let expected: String
    let actual: String
    let stderr: String
    let status: String
    let milliseconds: Int
    let fileMessage: String
}
struct RunResult: Codable {
    var status: String
    var diagnostics: String = ""
    var checks: [CheckResult] = []
}
struct Execution { let code: Int32; let out: String; let err: String; let timedOut: Bool; let milliseconds: Int }

final class Runner: @unchecked Sendable {
    private let lock = NSLock()
    private var child: Process?
    private var cancelled = false
    let resourceURL: URL
    let scratchRoot: URL
    init(resources: URL, scratch: URL? = nil) {
        resourceURL = resources
        scratchRoot = scratch ?? FileManager.default.temporaryDirectory.appendingPathComponent("CPracticeRuns", isDirectory: true)
    }
    func cancel() {
        lock.lock(); cancelled = true
        if let p = child, p.isRunning { kill(p.processIdentifier, SIGKILL) }
        lock.unlock()
    }
    private var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
    func prepare() { lock.lock(); cancelled = false; lock.unlock() }
    private func read(_ url: URL, limit: Int = 65536) -> String {
        guard let h = try? FileHandle(forReadingFrom: url) else { return "" }
        defer { try? h.close() }
        let data = (try? h.read(upToCount: limit)) ?? Data()
        var s = String(decoding: data, as: UTF8.self)
        if data.count >= limit { s += "\n[输出已截断]" }
        return s
    }
    private func execute(_ executable: String, _ arguments: [String], at dir: URL, input: String, timeout: Double) throws -> Execution {
        let fm = FileManager.default
        let tag = UUID().uuidString
        let outURL = dir.appendingPathComponent(".stdout-"+tag), errURL = dir.appendingPathComponent(".stderr-"+tag), inURL = dir.appendingPathComponent(".stdin-"+tag)
        try Data(input.utf8).write(to: inURL)
        fm.createFile(atPath: outURL.path, contents: nil); fm.createFile(atPath: errURL.path, contents: nil)
        let output = try FileHandle(forWritingTo: outURL), error = try FileHandle(forWritingTo: errURL), stdin = try FileHandle(forReadingFrom: inURL)
        defer { try? output.close(); try? error.close(); try? stdin.close() }
        let p = Process(); p.executableURL = URL(fileURLWithPath: executable); p.arguments = arguments
        p.currentDirectoryURL = dir; p.standardInput = stdin; p.standardOutput = output; p.standardError = error
        p.environment = ["PATH":"/usr/bin:/bin:/usr/sbin:/sbin", "HOME":dir.path, "TMPDIR":dir.path, "LANG":"en_US.UTF-8", "LC_ALL":"C"]
        let start = Date()
        lock.lock()
        if cancelled { lock.unlock(); return Execution(code: -1, out: "", err: "已停止", timedOut: false, milliseconds: 0) }
        do { try p.run(); child = p; lock.unlock() } catch { lock.unlock(); throw error }
        var timeoutHit = false
        while p.isRunning {
            if Date().timeIntervalSince(start) > timeout { timeoutHit = true; kill(p.processIdentifier, SIGKILL); break }
            let attrs = try? fm.attributesOfItem(atPath: outURL.path)
            let errs = try? fm.attributesOfItem(atPath: errURL.path)
            if (attrs?[.size] as? NSNumber)?.intValue ?? 0 > 1_048_576 || (errs?[.size] as? NSNumber)?.intValue ?? 0 > 1_048_576 { kill(p.processIdentifier, SIGKILL); break }
            Thread.sleep(forTimeInterval: 0.015)
        }
        p.waitUntilExit()
        lock.lock(); child = nil; lock.unlock()
        return Execution(code: p.terminationStatus, out: read(outURL), err: read(errURL), timedOut: timeoutHit, milliseconds: Int(Date().timeIntervalSince(start)*1000))
    }
    private func quote(_ s: String) -> String { "\"" + s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") + "\"" }
    private func profile(dir: URL, compiler: Bool) -> String {
        let readable = ["/System", "/usr/lib", "/usr/share", "/Library/Apple", "/private/preboot", "/private/var/db/dyld", dir.path] + (compiler ? ["/Library/Developer", "/Applications/Xcode.app", "/usr/bin", "/bin", resourceURL.path] : [resourceURL.appendingPathComponent("limit-runner").path])
        let reads = readable.map { "(subpath \(quote($0)))" }.joined(separator: " ")
        let execs = compiler ? "(allow process-exec) (allow process-fork)" : "(allow process-exec (literal \(quote(dir.appendingPathComponent("program").path))) (literal \(quote(resourceURL.appendingPathComponent("limit-runner").path))))"
        return """
        (version 1)
        (deny default)
        (allow file-read-metadata)
        (allow file-read-data (literal "/"))
        (allow file-read* \(reads) (literal "/dev/null") (literal "/dev/urandom") (literal "/dev/random"))
        (allow file-write* (subpath \(quote(dir.path))) (literal "/dev/null"))
        (allow sysctl-read)
        (allow mach-lookup)
        (allow signal (target self))
        (allow process-info* (target self))
        \(execs)
        """
    }
    private func normalized(_ s: String) -> String { s.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ") }
    func run(_ request: RunRequest) -> RunResult {
        let fm = FileManager.default
        try? fm.createDirectory(at: scratchRoot, withIntermediateDirectories: true)
        let rootPath: String
        if let resolved = realpath(scratchRoot.path, nil) { rootPath = String(cString: resolved); free(resolved) } else { rootPath = scratchRoot.path }
        let dir = URL(fileURLWithPath: rootPath).appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            guard request.code.utf8.count <= 262144 else { return RunResult(status: "error", diagnostics: "源文件不能超过 256 KB。") }
            let catalog = try JSONDecoder().decode(Catalog.self, from: Data(contentsOf: resourceURL.appendingPathComponent("curriculum.json")))
            let exercise: Exercise
            if let custom = request.exercise {
                guard custom.id == request.problemID, custom.id.range(of:"^R[0-9A-Fa-f]{32}$",options:.regularExpression) != nil,
                      (3...12).contains(custom.tests.count), custom.tests.allSatisfy({
                          $0.input.utf8.count <= 65536 && $0.expected.utf8.count <= 65536 &&
                          ($0.files?.isEmpty ?? true) && ($0.outputFiles?.isEmpty ?? true)
                      }), custom.tests.reduce(0,{$0+$1.input.utf8.count+$1.expected.utf8.count}) <= 262144 else {
                    return RunResult(status:"error",diagnostics:"错题练习的编号、检查点或输入规模无效。")
                }
                exercise = custom
            }
            else if let found = catalog.problems.first(where: {$0.id == request.problemID}) { exercise = found }
            else if let lesson = catalog.tutorials?.flatMap({$0.lessons}).first(where: {$0.id == request.problemID}) { exercise = Exercise(id: lesson.id, tests: [Checkpoint(name: "教程示例验证", input: lesson.input, expected: lesson.expected, files: nil, outputFiles: nil)]) }
            else { return RunResult(status: "error", diagnostics: "找不到题目或教程示例。") }
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
            defer { try? fm.removeItem(at: dir) }
            try Data(request.code.utf8).write(to: dir.appendingPathComponent("main.c"))
            let compilerInfo = try execute("/usr/bin/xcrun", ["--find", "clang"], at: dir, input: "", timeout: 10)
            let sdkInfo = try execute("/usr/bin/xcrun", ["--show-sdk-path"], at: dir, input: "", timeout: 10)
            let compiler = compilerInfo.out.trimmingCharacters(in: .whitespacesAndNewlines)
            let sdk = sdkInfo.out.trimmingCharacters(in: .whitespacesAndNewlines)
            guard compilerInfo.code == 0, sdkInfo.code == 0, !compiler.isEmpty, !sdk.isEmpty else { return RunResult(status: "error", diagnostics: "未找到 Apple Clang / macOS SDK。请运行 xcode-select --install。\n" + compilerInfo.err + sdkInfo.err) }
            let compileProfile = dir.appendingPathComponent("compile.sb")
            try Data(profile(dir: dir, compiler: true).utf8).write(to: compileProfile)
            let optimization = request.problemID.hasPrefix("S") || request.problemID.hasPrefix("H") ? "-O2" : "-O0"
            let build = try execute("/usr/bin/sandbox-exec", ["-f",compileProfile.path,compiler,"-isysroot",sdk,"-std=c17","-Wall","-Wextra","-Wpedantic","-fno-common",optimization,"-g","-fno-color-diagnostics","-ferror-limit=12",dir.appendingPathComponent("main.c").path,"-o",dir.appendingPathComponent("program").path], at: dir, input: "", timeout: 20)
            if isCancelled { return RunResult(status: "cancelled") }
            let diagnostics = build.err.replacingOccurrences(of: dir.path+"/", with: "")
            guard build.code == 0, !build.timedOut else { return RunResult(status: build.timedOut ? "compile_timeout" : "compile_error", diagnostics: diagnostics.isEmpty ? "编译进程退出状态：\(build.code)。\n\(build.out)" : diagnostics) }
            let runProfile = dir.appendingPathComponent("run.sb")
            try Data(profile(dir: dir, compiler: false).utf8).write(to: runProfile)
            let checks = request.mode == "run" ? [Checkpoint(name: "自定义运行", input: request.input ?? "", expected: "", files: exercise.tests.first?.files, outputFiles: nil)] : exercise.tests
            var results: [CheckResult] = []
            for (index, test) in checks.enumerated() {
                if isCancelled { return RunResult(status: "cancelled", diagnostics: diagnostics, checks: results) }
                let caseDir = dir.appendingPathComponent("case-\(index)", isDirectory: true)
                try fm.createDirectory(at: caseDir, withIntermediateDirectories: true)
                for (name, contents) in test.files ?? [:] {
                    guard !name.contains("/"), name != ".." else { continue }
                    try Data(contents.utf8).write(to: caseDir.appendingPathComponent(name))
                }
                let execution = try execute("/usr/bin/sandbox-exec", ["-f", runProfile.path, resourceURL.appendingPathComponent("limit-runner").path, dir.appendingPathComponent("program").path], at: caseDir, input: test.input, timeout: 8)
                if isCancelled { return RunResult(status: "cancelled", diagnostics: diagnostics, checks: results) }
                var fileMessage = ""
                for (name, expected) in test.outputFiles ?? [:] {
                    let actual = read(caseDir.appendingPathComponent(name))
                    if !fm.fileExists(atPath: caseDir.appendingPathComponent(name).path) || normalized(actual) != normalized(expected) { fileMessage += "文件 \(name) 内容不符或未创建。\n期望：\(expected)\n实际：\(actual)\n" }
                }
                let status: String
                if execution.timedOut || execution.code == SIGXCPU { status = "timeout" }
                else if execution.code != 0 { status = "runtime_error" }
                else if request.mode == "run" { status = "ran" }
                else { status = normalized(execution.out) == normalized(test.expected) && fileMessage.isEmpty ? "passed" : "wrong_answer" }
                results.append(CheckResult(name: test.name, input: test.input, expected: test.expected, actual: execution.out, stderr: execution.err + (execution.code != 0 ? "\n进程退出状态：\(execution.code)" : ""), status: status, milliseconds: execution.milliseconds, fileMessage: fileMessage))
            }
            return RunResult(status: request.mode == "run" ? (results.first?.status ?? "error") : (results.allSatisfy({$0.status == "passed"}) ? "passed" : "failed"), diagnostics: diagnostics, checks: results)
        } catch { return RunResult(status: "error", diagnostics: error.localizedDescription) }
    }
}
