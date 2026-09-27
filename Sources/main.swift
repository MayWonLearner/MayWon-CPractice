import AppKit
import WebKit
import UniformTypeIdentifiers

let resourceURL = Bundle.main.resourceURL ?? URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("Resources")
if CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "--judge" {
    let resources = CommandLine.arguments.count > 2 ? URL(fileURLWithPath: CommandLine.arguments[2]) : resourceURL
    let runner = Runner(resources: resources)
    do {
        let request = try JSONDecoder().decode(RunRequest.self, from: FileHandle.standardInput.readDataToEndOfFile())
        runner.prepare()
        let result = runner.run(request)
        FileHandle.standardOutput.write(try JSONEncoder().encode(result))
    } catch { fputs("\(error)\n", stderr); exit(1) }
    exit(0)
}

let qaConfiguration: [String:String] = {
    guard let data = try? Data(contentsOf: resourceURL.appendingPathComponent("qa-config.json")), let object = try? JSONDecoder().decode([String:String].self, from:data) else { return [:] }
    return object
}()
final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    let runner = Runner(resources: resourceURL)
    let language = LanguageService()
    let analysis = AnalysisService(resources: resourceURL)
    let study = StudyService(resources: resourceURL)
    let remedial = RemedialService(resources: resourceURL)
    let codexConnection = CodexConnection()
    var studyBusy = false
    var remedialBusy = false
    var codexLoginBusy = false
    var analysisBusy = false
    var busy = false
    var state: [String:Any] = [:]
    var testEvents: [[String:Any]] = []
    var testOutput: String? { ProcessInfo.processInfo.environment["CPRACTICE_UI_REPORT"] ?? qaConfiguration["report"] }
    var dataURL: URL {
        if let override = ProcessInfo.processInfo.environment["CPRACTICE_DATA_DIR"] ?? qaConfiguration["data"] { return URL(fileURLWithPath: override).appendingPathComponent("state.json") }
        if testOutput != nil { return FileManager.default.temporaryDirectory.appendingPathComponent("CPracticeTests-"+String(ProcessInfo.processInfo.processIdentifier)+"/state.json") }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("CPractice/state.json")
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.applicationIconImage = NSImage(contentsOf: resourceURL.appendingPathComponent("AppIcon.icns"))
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于 CPractice", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出 CPractice", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); main.addItem(editItem); let edit = NSMenu(title:"编辑"); editItem.submenu = edit
        for (name,action,key) in [("撤销","undo:","z"),("重做","redo:","Z"),("剪切","cut:","x"),("复制","copy:","c"),("粘贴","paste:","v"),("全选","selectAll:","a")] { edit.addItem(withTitle:name,action:Selector(action),keyEquivalent:key) }
        let windowItem = NSMenuItem(); main.addItem(windowItem);let wm = NSMenu(title:"窗口");windowItem.submenu=wm
        wm.addItem(withTitle:"最小化",action:#selector(NSWindow.miniaturize(_:)),keyEquivalent:"m");NSApp.windowsMenu=wm
        NSApp.mainMenu = main
        let config = WKWebViewConfiguration();config.userContentController.add(self,name:"native")
        web = WKWebView(frame: .zero, configuration: config); web.navigationDelegate = self; web.uiDelegate = self
        web.setValue(false, forKey:"drawsBackground")
        window = NSWindow(contentRect:NSRect(x:0,y:0,width:1400,height:900),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.delegate = self
        window.title = "CPractice · C 语言练习室"; window.minSize = NSSize(width:1080,height:700)
        window.titlebarAppearsTransparent=true;window.backgroundColor=NSColor(calibratedRed:0.055,green:0.069,blue:0.09,alpha:1)
        window.appearance = NSAppearance(named:.darkAqua);window.contentView=web;window.center();window.makeKeyAndOrderFront(nil)
        web.loadFileURL(resourceURL.appendingPathComponent("index.html"),allowingReadAccessTo:resourceURL)
        language.emit = { [weak self] payload in self?.send("language", payload) }
        NSApp.activate(ignoringOtherApps:true)
    }
    @objc func about() {
        let alert=NSAlert();alert.messageText="CPractice · C 语言练习室";alert.informativeText="5.0.0 · 双层教程与批注 · High 问答与存档 · 定向练习\nSwift / AppKit / WebKit / Apple Clang";alert.runModal()
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        runner.cancel(); analysis.cancel(); study.cancel(); remedial.cancel(); codexConnection.cancel()
        web.evaluateJavaScript("JSON.stringify(window.CPracticeTest.snapshot())") { [self] result, error in
            if let json = result as? String, let data = json.data(using: .utf8), let snapshot = try? JSONSerialization.jsonObject(with: data) as? [String:Any] { state = snapshot; saveState() }
            NSApp.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { runner.cancel(); analysis.cancel(); study.cancel(); remedial.cancel(); codexConnection.cancel(); language.stop() }
    func send(_ type: String, _ payload: Any) {
        let value: [String:Any] = ["type":type,"payload":payload]
        guard let data = try? JSONSerialization.data(withJSONObject:value),let text=String(data:data,encoding:.utf8) else{return}
        web.evaluateJavaScript("window.receiveNative(\(text))", completionHandler:nil)
    }
    func saveState() {
        do { try FileManager.default.createDirectory(at:dataURL.deletingLastPathComponent(),withIntermediateDirectories:true);try JSONSerialization.data(withJSONObject:state,options:[.prettyPrinted,.sortedKeys]).write(to:dataURL,options:.atomic) }
        catch { send("error","保存失败：\(error.localizedDescription)") }
    }
    private func workspaceURL(_ id: String) -> URL? {
        guard id.range(of: "^(?:[CBXSH][0-9]{3,4}|R[0-9A-Fa-f]{32})$", options: .regularExpression) != nil else { return nil }
        return dataURL.deletingLastPathComponent().appendingPathComponent("VSCode/" + id)
    }
    func openVSCode(_ body: [String:Any]) {
        guard let id=body["problemID"] as? String,let code=body["code"] as? String,let dir=workspaceURL(id) else{return}
        let app=URL(fileURLWithPath:"/Applications/Visual Studio Code.app")
        guard FileManager.default.fileExists(atPath:app.path) else {send("error","未找到 Visual Studio Code，请先安装后再打开工作区。");return}
        do {
            try FileManager.default.createDirectory(at:dir.appendingPathComponent(".vscode"),withIntermediateDirectories:true)
            let source=dir.appendingPathComponent("main.c")
            if FileManager.default.fileExists(atPath:source.path) {try? FileManager.default.copyItem(at:source,to:dir.appendingPathComponent("main-backup-"+UUID().uuidString+".c"))}
            try Data(code.utf8).write(to:source,options:.atomic)
            for name in ["settings.json","tasks.json","launch.json","extensions.json"] {
                let contents=try Data(contentsOf:resourceURL.appendingPathComponent("vscode-"+name));try contents.write(to:dir.appendingPathComponent(".vscode/"+name),options:.atomic)
            }
            let config=NSWorkspace.OpenConfiguration();config.activates=true
            NSWorkspace.shared.open([dir],withApplicationAt:app,configuration:config){ [weak self] _,error in
                DispatchQueue.main.async {if let error {self?.send("error",error.localizedDescription)}else{self?.send("notice","已打开 VS Code 工作区；编辑后回到本应用点击“取回代码”验证。")}}
            }
        }catch{send("error","创建 VS Code 工作区失败："+error.localizedDescription)}
    }
    func openCourseFlowchart() {
        let editor=URL(fileURLWithPath:"/Applications/Visual Studio Code.app")
        guard FileManager.default.fileExists(atPath:editor.path) else {send("error","请先安装 Visual Studio Code，再在扩展页安装 hediet 的 Draw.io Integration。");return}
        do {
            let dir=dataURL.deletingLastPathComponent().appendingPathComponent("VSCode/flowcharts")
            try FileManager.default.createDirectory(at:dir.appendingPathComponent(".vscode"),withIntermediateDirectories:true)
            let file=dir.appendingPathComponent("score-loop.drawio")
            if !FileManager.default.fileExists(atPath:file.path) {try FileManager.default.copyItem(at:resourceURL.appendingPathComponent("diagrams/score-loop.drawio"),to:file)}
            let extensions=try Data(contentsOf:resourceURL.appendingPathComponent("vscode-extensions.json"))
            try extensions.write(to:dir.appendingPathComponent(".vscode/extensions.json"),options:.atomic)
            let config=NSWorkspace.OpenConfiguration();config.activates=true
            NSWorkspace.shared.open([dir,file],withApplicationAt:editor,configuration:config){[weak self] _,error in
                DispatchQueue.main.async {if let error {self?.send("error",error.localizedDescription)}else{self?.send("notice","流程图已打开；首次使用请接受工作区推荐，安装 Draw.io Integration。已有图不会覆盖。")}}
            }
        }catch{send("error","打开流程图失败："+error.localizedDescription)}
    }
    func reloadVSCode(_ body: [String:Any]) {
        guard let id=body["problemID"] as? String,let dir=workspaceURL(id) else{return}
        do {let data=try Data(contentsOf:dir.appendingPathComponent("main.c"));guard data.count<=262144,let code=String(data:data,encoding:.utf8) else {send("error","源码需为 UTF-8 且不超过 256 KB。");return};send("imported",["code":code,"name":"main.c"])}catch{send("error","还没有该题的 VS Code 工作区，请先点击“VS Code”。")}
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body=message.body as? [String:Any],let action=body["action"] as? String else{return}
        switch action {
        case "ready":
            if let data=try? Data(contentsOf:dataURL),let saved=try? JSONSerialization.jsonObject(with:data) as? [String:Any] { state=saved }
            send("state",state)
        case "save":
            if let s=body["state"] as? [String:Any] {state=s;saveState();send("saved",true)}
        case "judge", "run":
            guard !busy, let data=try? JSONSerialization.data(withJSONObject:body),let request=try? JSONDecoder().decode(RunRequest.self,from:data) else {return}
            busy=true;runner.prepare()
            DispatchQueue.global(qos:.userInitiated).async { [self] in
                let result=runner.run(request)
                DispatchQueue.main.async { [self] in
                    busy=false
                    if let d=try? JSONEncoder().encode(result),let obj=try? JSONSerialization.jsonObject(with:d) {send("result",["problemID":request.problemID,"code":request.code,"mode":request.mode,"result":obj])}
                }
            }
        case "analyze":
            guard let data=try? JSONSerialization.data(withJSONObject:body),let request=try? JSONDecoder().decode(AnalysisRequest.self,from:data) else {return}
            guard !analysisBusy else {send("analysisError",["requestID":request.requestID,"message":"已有分析正在运行，请等待或取消后重试。"]);return}
            analysisBusy=true;analysis.prepare()
            DispatchQueue.global(qos:.userInitiated).async { [self] in
                do {
                    let result=try analysis.analyze(request) { text in DispatchQueue.main.async { [self] in send("analysisStatus",["requestID":request.requestID,"message":text]) } }
                    DispatchQueue.main.async { [self] in analysisBusy=false;send("analysisResult",result) }
                } catch {DispatchQueue.main.async { [self] in analysisBusy=false;send("analysisError",["requestID":request.requestID,"message":error.localizedDescription])}}
            }
        case "studyAsk":
            let id=body["requestID"] as? String ?? ""
            guard !studyBusy else {send("studyError",["requestID":id,"message":"已有问答正在生成，请等待或取消后重试。"]);return}
            guard let data=try? JSONSerialization.data(withJSONObject:body),let request=try? JSONDecoder().decode(StudyRequest.self,from:data) else {send("studyError",["requestID":id,"message":"问答请求格式无效。"]);return}
            studyBusy=true;study.prepare()
            DispatchQueue.global(qos:.userInitiated).async { [self] in
                do {
                    let result=try study.ask(request) { text in DispatchQueue.main.async { [self] in send("studyStatus",["requestID":id,"message":text]) } }
                    DispatchQueue.main.async { [self] in studyBusy=false;send("studyResult",result) }
                } catch {DispatchQueue.main.async { [self] in studyBusy=false;send("studyError",["requestID":id,"message":error.localizedDescription])}}
            }
        case "cancelStudy":study.cancel()
        case "remedialGenerate":
            let id=body["requestID"] as? String ?? ""
            guard !remedialBusy else {send("remedialError",["requestID":id,"message":"已有错题练习正在生成，请等待或取消后重试。"]);return}
            remedialBusy=true;remedial.prepare()
            DispatchQueue.global(qos:.userInitiated).async { [self] in
                do {
                    let result=try remedial.generate(body) { text in DispatchQueue.main.async { [self] in send("remedialStatus",["requestID":id,"message":text]) } }
                    DispatchQueue.main.async { [self] in remedialBusy=false;send("remedialResult",result) }
                } catch {DispatchQueue.main.async { [self] in remedialBusy=false;send("remedialError",["requestID":id,"message":error.localizedDescription])}}
            }
        case "cancelRemedial":remedial.cancel()
        case "codexStatus":
            DispatchQueue.global(qos:.userInitiated).async { [self] in
                let result=codexConnection.status();DispatchQueue.main.async { [self] in send("codexStatusResult",result) }
            }
        case "codexLogin":
            guard !codexLoginBusy else {send("codexLoginStatus",["message":"登录正在进行，请完成官方页面的操作或取消。"]);return}
            codexLoginBusy=true;codexConnection.prepare()
            send("codexLoginStatus",["message":"正在启动 OpenAI 官方设备登录…"])
            DispatchQueue.global(qos:.userInitiated).async { [self] in
                do {
                    let result=try codexConnection.login { payload in DispatchQueue.main.async { [self] in send("codexLoginStatus",payload) } }
                    DispatchQueue.main.async { [self] in codexLoginBusy=false;send("codexLoginResult",result) }
                } catch {DispatchQueue.main.async { [self] in codexLoginBusy=false;send("codexLoginResult",["installed":StudyModelClient.executable() != nil,"loggedIn":false,"message":error.localizedDescription])}}
            }
        case "cancelCodexLogin":codexConnection.cancel()
        case "cancelAnalysis":analysis.cancel()
        case "stop":runner.cancel()
        case "language":language.handle(body)
        case "openVSCode":openVSCode(body)
        case "openFlowchart":openCourseFlowchart()
        case "reloadVSCode":reloadVSCode(body)
        case "import":
            let panel=NSOpenPanel();panel.allowedContentTypes=[UTType(filenameExtension:"c") ?? .sourceCode];panel.allowsMultipleSelection=false
            panel.beginSheetModal(for:window) { [self] result in
                if result == .OK, let url=panel.url {
                    do { let data=try Data(contentsOf:url);guard data.count<=262144 else {send("error","文件不能超过 256 KB。");return};guard let code=String(data:data,encoding:.utf8) else {send("error","请将 .c 文件保存为 UTF-8 编码。");return};send("imported",["code":code,"name":url.lastPathComponent]) } catch {send("error",error.localizedDescription)}
                }
            }
        case "export":
            guard let code=body["code"] as? String else{return};let panel=NSSavePanel();panel.nameFieldStringValue=(body["name"] as? String ?? "main.c");panel.allowedContentTypes=[UTType(filenameExtension:"c") ?? .sourceCode]
            panel.beginSheetModal(for:window) { [self] result in if result == .OK,let url=panel.url {do{try Data(code.utf8).write(to:url,options:.atomic);send("notice","已导出 .c 文件")}catch{send("error",error.localizedDescription)}} }
        case "backup":
            let panel=NSSavePanel();panel.nameFieldStringValue="CPractice-backup.json";panel.allowedContentTypes=[.json]
            panel.beginSheetModal(for:window) { [self] result in if result == .OK,let url=panel.url {do{try JSONSerialization.data(withJSONObject:state,options:.prettyPrinted).write(to:url,options:.atomic);send("notice","学习记录已备份")}catch{send("error",error.localizedDescription)}} }
        case "openURL":
            if let s=body["url"] as? String,let url=URL(string:s),["https"].contains(url.scheme ?? "") {NSWorkspace.shared.open(url)}
        case "selftest":
            if let output=testOutput,let event=body["event"] as? [String:Any] {testEvents.append(event);try? JSONSerialization.data(withJSONObject:testEvents,options:.prettyPrinted).write(to:URL(fileURLWithPath:output))}
        default:break
        }
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard frame.isMainFrame else {completionHandler(nil);return}
        let panel=NSOpenPanel();panel.allowedContentTypes=[.image];panel.canChooseDirectories=false
        panel.allowsMultipleSelection=parameters.allowsMultipleSelection
        panel.beginSheetModal(for:window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard testOutput != nil else {return}
        if let js=try? String(contentsOf:resourceURL.appendingPathComponent("selftest.js"),encoding:.utf8) {web.evaluateJavaScript(js,completionHandler:nil)}
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy)->Void) {
        if let url=navigationAction.request.url,url.isFileURL,url.standardized.path.hasPrefix(resourceURL.standardized.path+"/") {decisionHandler(.allow)}else{decisionHandler(.cancel)}
    }
}
let app=NSApplication.shared
let delegate=AppDelegate();app.delegate=delegate;app.run()
