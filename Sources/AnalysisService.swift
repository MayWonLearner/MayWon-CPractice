import Foundation
import Darwin

struct AnalysisDynamicProblem: Codable {
    let id: String; let title: String; let description: String; let input: String; let output: String; let constraints: String; let complexity: [String:String]?; let tests: [Checkpoint]
}
struct AnalysisRequest: Decodable {
    let requestID: String
    let problemID: String
    let code: String
    let input: String?
    let previousCode: String?
    let exercise: AnalysisDynamicProblem?
}
struct AnalysisRepair: Codable { let startLine: Int; let endLine: Int; let code: String; let steps: [String]; let explanation: String; let verification: String }
struct AnalysisIssue: Codable { let title: String; let line: Int; let code: String; let evidence: String; let beginner: String; let professional: String; let minimalFix: String; let repair: AnalysisRepair? }
struct AnalysisWalkthrough: Codable { let input: String; let steps: [String]; let expected: String; let actual: String }
struct AnalysisComplexity: Codable { let time: String; let space: String; let explanation: String }
struct AnalysisReview: Codable { let quoteId: String; let explanation: String }
struct AnalysisQuestion: Codable { let question: String; let answer: String }
struct AnalysisReport: Codable {
    let summary: String
    let alreadyFixed: [String]
    let issues: [AnalysisIssue]
    let walkthrough: AnalysisWalkthrough
    let minimalPatch: String
    let complexity: AnalysisComplexity
    let verification: [String]
    let reviews: [AnalysisReview]
    let questions: [AnalysisQuestion]
}
struct AnalysisFailure: LocalizedError { let message: String; var errorDescription: String? { message } }

final class AnalysisService: @unchecked Sendable {
    static let model = "gpt-5.6-sol"
    static let effort = "medium"
    private let resources: URL
    private let runner: Runner
    private let lock = NSLock()
    private var child: Process?
    private var cancelled = false
    init(resources: URL) { self.resources = resources; runner = Runner(resources: resources) }
    func prepare() { lock.lock(); cancelled = false; lock.unlock(); runner.prepare() }
    func cancel() { lock.lock(); cancelled = true; if let p=child,p.isRunning { kill(p.processIdentifier,SIGKILL) };lock.unlock();runner.cancel() }
    private var stopped: Bool { lock.lock(); defer { lock.unlock() };return cancelled }
    private func checkCancelled() throws { if stopped { throw AnalysisFailure(message:"已取消模型分析。") } }
    private func executable() throws -> URL {
        let home=FileManager.default.homeDirectoryForCurrentUser
        let paths=[home.appendingPathComponent(".local/bin/codex").path,"/opt/homebrew/bin/codex","/usr/local/bin/codex","/Applications/Codex.app/Contents/Resources/codex"]
        guard let path=paths.first(where:{FileManager.default.isExecutableFile(atPath:$0)}) else { throw AnalysisFailure(message:"找不到 Codex CLI。请安装 Codex CLI，并在终端运行 codex login 登录；模型分析使用该登录，不需要把密钥填入应用。") }
        return URL(fileURLWithPath:path)
    }
    private func read(_ url: URL, limit: Int = 262144) -> String {
        guard let f=try? FileHandle(forReadingFrom:url) else {return ""};defer{try? f.close()}
        return String(decoding:(try? f.read(upToCount:limit)) ?? Data(),as:UTF8.self)
    }
    func analyze(_ request: AnalysisRequest, status: @escaping (String)->Void) throws -> [String:Any] {
        guard UUID(uuidString:request.requestID) != nil,request.code.utf8.count<=262144,(request.previousCode?.utf8.count ?? 0)<=262144 else {throw AnalysisFailure(message:"分析请求无效或代码超过256KB。")}
        let binary=try executable()
        let data=try Data(contentsOf:resources.appendingPathComponent("curriculum.json"))
        guard let catalog=try JSONSerialization.jsonObject(with:data) as? [String:Any],let problems=catalog["problems"] as? [[String:Any]] else {throw AnalysisFailure(message:"无法读取题库。")}
        let problem: [String:Any]
        var dynamic: Exercise?=nil
        if let supplied=request.exercise {
            guard supplied.id==request.problemID,supplied.id.range(of:"^R[0-9A-Fa-f]{32}$",options:.regularExpression) != nil else {throw AnalysisFailure(message:"定向练习编号不匹配。")}
            problem=try JSONSerialization.jsonObject(with:JSONEncoder().encode(supplied)) as! [String:Any]
            dynamic=Exercise(id:supplied.id,tests:supplied.tests)
        } else {
            guard let found=problems.first(where:{$0["id"] as? String == request.problemID}) else {throw AnalysisFailure(message:"没有找到要分析的题目。")}
            problem=found
        }
        try checkCancelled();status("正在重新验证这份代码，收集本次诊断与失败输入…")
        let tested=runner.run(RunRequest(code:request.code,problemID:request.problemID,mode:"judge",input:nil,exercise:dynamic))
        try checkCancelled()
        var quotes=[[String:Any]]()
        for chapter in catalog["tutorials"] as? [[String:Any]] ?? [] {
            for lesson in chapter["lessons"] as? [[String:Any]] ?? [] {
                for q in lesson["reviewQuotes"] as? [[String:Any]] ?? [] {
                    if let id=q["id"] as? String,let text=q["text"] as? String {quotes.append(["id":id,"lessonID":lesson["id"] ?? "","title":lesson["title"] ?? "","text":text])}
                }
            }
        }
        let failed=tested.checks.filter{!["passed","ran"].contains($0.status)}
        let chosen=Array((failed.isEmpty ? tested.checks : failed).sorted{$0.input.count<$1.input.count}.prefix(3))
        let checks=try JSONSerialization.jsonObject(with:JSONEncoder().encode(chosen))
        let facts=problem.filter{["id","title","description","input","output","constraints","complexity"].contains($0.key)}
        let numbered=request.code.components(separatedBy:"\n").enumerated().map{"\($0.offset+1): \($0.element)"}.joined(separator:"\n")
        let payload:[String:Any]=["problem":facts,"code":request.code,"numberedCode":numbered,"previousCode":request.previousCode ?? "","customInputNotExecuted":request.input ?? "","currentRun":["status":tested.status,"diagnostics":tested.diagnostics,"passed":tested.checks.filter{$0.status=="passed"}.count,"total":tested.checks.count,"selectedChecks":checks],"quotes":quotes]
        let instructions=try String(contentsOf:resources.appendingPathComponent("analysis-instructions.txt"),encoding:.utf8)
        let prompt=instructions+"\n\n下面是本次独立数据包（JSON）：\n"+String(decoding:try JSONSerialization.data(withJSONObject:payload,options:[.sortedKeys]),as:UTF8.self)
        let dir=FileManager.default.temporaryDirectory.appendingPathComponent("CPracticeAnalysis-"+request.requestID,isDirectory:true)
        try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
        defer{try? FileManager.default.removeItem(at:dir)}
        let input=dir.appendingPathComponent("prompt.txt"),out=dir.appendingPathComponent("events.jsonl"),err=dir.appendingPathComponent("stderr.txt"),answer=dir.appendingPathComponent("answer.json")
        try Data(prompt.utf8).write(to:input);FileManager.default.createFile(atPath:out.path,contents:nil);FileManager.default.createFile(atPath:err.path,contents:nil)
        let fin=try FileHandle(forReadingFrom:input),fout=try FileHandle(forWritingTo:out),ferr=try FileHandle(forWritingTo:err)
        defer{try? fin.close();try? fout.close();try? ferr.close()}
        let p=Process();p.executableURL=binary;p.currentDirectoryURL=dir
        var args=["exec","--ignore-user-config","--ephemeral","--skip-git-repo-check","-s","read-only","-m",Self.model,"-c","model_reasoning_effort=\"medium\"","-c","web_search=\"disabled\"","-c","sqlite_home=\"\(dir.appendingPathComponent("runtime").path)\"","-c","log_dir=\"\(dir.appendingPathComponent("log").path)\"","--color","never","--json","--output-schema",resources.appendingPathComponent("analysis-schema.json").path,"-o",answer.path]
        for feature in ["shell_tool","unified_exec","apps","plugins","hooks","multi_agent","browser_use","computer_use","in_app_browser","image_generation","view_image","shell_snapshot"] {args += ["--disable",feature]}
        args += ["-"];p.arguments=args;p.standardInput=fin;p.standardOutput=fout;p.standardError=ferr
        var env=ProcessInfo.processInfo.environment
        // No inherited task/host session routing; use the user's existing Codex login only.
        for key in Array(env.keys) where key.hasPrefix("CODEX_THREAD") || key.hasPrefix("CODEX_INTERNAL") || key.hasPrefix("CPRACTICE_") {env.removeValue(forKey:key)}
        env["PATH"]="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";p.environment=env
        status("正在调用 GPT-5.6-Sol · Medium，分析具体代码与失败路径…")
        lock.lock();if cancelled{lock.unlock();throw AnalysisFailure(message:"已取消模型分析。")}
        do{try p.run();child=p;lock.unlock()}catch{lock.unlock();throw error}
        let start=Date();var timedOut=false
        while p.isRunning {
            if Date().timeIntervalSince(start)>240 {timedOut=true;kill(p.processIdentifier,SIGKILL);break}
            if ((try? FileManager.default.attributesOfItem(atPath:out.path)[.size]) as? NSNumber)?.intValue ?? 0 > 4_194_304 {kill(p.processIdentifier,SIGKILL);break}
            Thread.sleep(forTimeInterval:0.05)
        }
        p.waitUntilExit();lock.lock();child=nil;lock.unlock()
        try checkCancelled()
        if timedOut {throw AnalysisFailure(message:"模型分析等待超过4分钟，已停止。请检查网络后重试；没有用规则模板替代模型结果。")}
        let output=read(answer)
        guard p.terminationStatus==0,!output.isEmpty else {
            let raw=read(err,limit:16000)+"\n"+read(out,limit:16000)
            if raw.contains("401")||raw.localizedCaseInsensitiveContains("not logged in")||raw.localizedCaseInsensitiveContains("authentication") {throw AnalysisFailure(message:"Codex 登录已失效或尚未登录。请在终端运行 codex login，然后重试。")}
            if raw.contains("429")||raw.localizedCaseInsensitiveContains("usage limit") {throw AnalysisFailure(message:"模型额度或请求频率已达限制，请稍后重试。此次没有生成详细分析。")}
            throw AnalysisFailure(message:"GPT-5.6-Sol 调用未完成（退出码 \(p.terminationStatus)）。请检查 Codex 登录、模型权限和网络后重试；不会切换模型或展示模板充当模型结果。")
        }
        let report:AnalysisReport
        do{report=try JSONDecoder().decode(AnalysisReport.self,from:Data(output.utf8))}catch{throw AnalysisFailure(message:"模型返回的分析格式不完整，请重试。原代码和学习记录未修改。")}
        let lineCount=request.code.components(separatedBy:"\n").count
        guard report.issues.allSatisfy({ issue in
            guard let repair=issue.repair else { return false }
            return repair.startLine>=1 && repair.endLine>=repair.startLine && repair.endLine<=lineCount &&
                issue.line>=repair.startLine && issue.line<=repair.endLine &&
                !repair.code.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty &&
                repair.steps.count>=2 && repair.steps.allSatisfy({!$0.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty}) &&
                !repair.explanation.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty &&
                !repair.verification.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty
        }) else {throw AnalysisFailure(message:"模型没有给出完整的分段修改代码、有效替换范围或补充说明，请重试。原分析仍保留。")}
        let allowed=Set(quotes.compactMap{$0["id"] as? String})
        guard report.reviews.allSatisfy({allowed.contains($0.quoteId)}),report.issues.allSatisfy({$0.line>=1&&$0.line<=request.code.components(separatedBy:"\n").count}),report.questions.count==3 else {throw AnalysisFailure(message:"模型返回了无法核对的行号、引用或理解题，未将其作为有效复盘保存，请重试。")}
        return ["requestID":request.requestID,"problemID":request.problemID,"code":request.code,"input":request.input ?? "","model":Self.model,"effort":Self.effort,"time":ISO8601DateFormatter().string(from:Date()),"report":try JSONSerialization.jsonObject(with:JSONEncoder().encode(report)),"validation":try JSONSerialization.jsonObject(with:JSONEncoder().encode(tested))]
    }
}
