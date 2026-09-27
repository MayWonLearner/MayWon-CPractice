'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,nativeImage,session}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {Runner}=require('./runner.cjs'),{Models}=require('./models.cjs'),{Language}=require('./language.cjs'),{StateStore,validateState}=require('./state.cjs');
const {findTool,commandFor,compiler,toolEnvironment}=require('./platform.cjs');
const {execute}=require('./process.cjs');
const smoke=process.argv.includes('--smoke-test');
const resources=app.isPackaged?path.join(process.resourcesPath,'learning'):path.join(__dirname,'../Resources');
const nativeSources=app.isPackaged?process.resourcesPath:path.join(__dirname,'../Sources');
const dataDir=process.env.CPRACTICE_DATA_DIR||(smoke?path.join(os.tmpdir(),'CPracticeSmoke-'+process.pid):path.join(app.getPath('appData'),'CPractice Desktop'));
app.setPath('userData',dataDir);
let window,closing=false,restoring=false,state={},store=new StateStore(dataDir);const active=new Map();
const runner=new Runner(resources,nativeSources);
// Development keeps the Windows helper with desktop sources; packaged builds copy both together.
if(!app.isPackaged&&process.platform==='win32')runner.nativeSources=__dirname;
const models=new Models(resources,runner,async dataURL=>{const image=nativeImage.createFromDataURL(dataURL),s=image.getSize();if(image.isEmpty()||s.width>12000||s.height>12000||s.width*s.height>40000000)throw Error('照片无法解码或尺寸过大。');return image.toPNG();});
const send=(type,payload)=>{if(window&&!window.isDestroyed())window.webContents.send('cpractice:message',{type,payload});};
const language=new Language(payload=>send('language',payload));
async function runTask(key,b,work){
 if(active.has(key)){send(key+'Error',{requestID:b.requestID,message:'同类请求正在运行，请等待或取消。'});return;}
 const controller=new AbortController();active.set(key,controller);
 try{send(key+'Result',await work(controller.signal));}catch(e){send(key+'Error',{requestID:b.requestID,message:e.message});}finally{active.delete(key);}
}
function validSender(event){return event.sender===window?.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url===pathToFileURL(path.join(resources,'index.html')).href;}
async function saveDialog(name,content,extensions){const r=await dialog.showSaveDialog(window,{defaultPath:path.basename(name),filters:[{name:'CPractice',extensions}]});if(!r.canceled&&r.filePath){await fs.writeFile(r.filePath,content);send('notice','已保存文件。');}}
async function restoreState(imported){
 if(active.size)throw Error('请先停止运行或取消模型请求，再导入备份。');
 await store.queue;
 await fs.writeFile(path.join(dataDir,'before-restore-'+Date.now()+'.json'),JSON.stringify(state,null,2),{mode:0o600});
 restoring=true;state=validateState(imported);await store.save(state);
 // Ignore the old document's pagehide autosave until the new document requests state.
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.reload();});
}
function workspace(id){if(!/^(?:[CBXSH][0-9]{3,4}|R[0-9A-Fa-f]{32})$/.test(id))throw Error('练习编号无效。');return path.join(dataDir,'VSCode',id);}
async function openVSCode(b){
 if(typeof b.code!=='string'||Buffer.byteLength(b.code)>262144)throw Error('代码过大。');const dir=workspace(b.problemID),source=path.join(dir,'main.c');
 await fs.mkdir(path.join(dir,'.vscode'),{recursive:true});try{await fs.copyFile(source,source+'.backup-'+Date.now());}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.writeFile(source,b.code);const cc=compiler(),binary=path.join(dir,process.platform==='win32'?'program.exe':'program');
 const configs={
  'settings.json':{'files.associations':{'*.c':'c'},'editor.tabSize':4,'editor.insertSpaces':true,'editor.formatOnSave':true,'C_Cpp.intelliSenseEngine':'disabled'},
  'extensions.json':{recommendations:['llvm-vs-code-extensions.vscode-clangd','ms-vscode.cpptools','vadimcn.vscode-lldb']},
  'tasks.json':{version:'2.0.0',tasks:[{label:'编译当前 C 程序',type:'process',command:cc.file,args:['-std=c17','-Wall','-Wextra','-g','${file}','-o',binary,'-lm'],group:{kind:'build',isDefault:true},problemMatcher:['$gcc']}]},
  'launch.json':{version:'0.2.0',configurations:[process.platform==='win32'?{name:'调试当前 C 程序',type:'cppdbg',request:'launch',program:binary,cwd:dir,MIMode:'gdb',miDebuggerPath:findTool('gdb')||'gdb',externalConsole:true,preLaunchTask:'编译当前 C 程序'}:{name:'调试当前 C 程序',type:'lldb',request:'launch',program:binary,cwd:dir,preLaunchTask:'编译当前 C 程序'}]}
 };
 for(const [name,value] of Object.entries(configs))await fs.writeFile(path.join(dir,'.vscode',name),JSON.stringify(value,null,2));
 const cmd=commandFor(findTool('code')),r=await execute(cmd.file,[...cmd.args,dir],{env:toolEnvironment(),timeout:15000});if(r.code!==0)throw Error('无法打开 VS Code，请检查 code 命令安装。');send('notice','已打开 VS Code，修改后可返回本应用取回代码。');
}
async function handle(event,b){
 if(!validSender(event)||!b||typeof b.action!=='string')return;
 try{
  switch(b.action){
   case 'ready':restoring=false;send('state',state);break;
   case 'save':if(restoring)break;state=validateState(b.state);await store.save(state);send('saved',true);break;
   case 'run':case 'judge':{
    if(active.has('run'))return;const controller=new AbortController();active.set('run',controller);
    try{const result=await runner.run({...b,mode:b.action},{signal:controller.signal});send('result',{problemID:b.problemID,code:b.code,mode:b.action,result});}finally{active.delete('run');}break;
   }
   case 'stop':active.get('run')?.abort();break;
   case 'language':language.handle(b);break;
   case 'analyze':await runTask('analysis',b,signal=>models.analyze(b,signal,message=>send('analysisStatus',{requestID:b.requestID,message})));break;
   case 'studyAsk':await runTask('study',b,signal=>models.study(b,signal,message=>send('studyStatus',{requestID:b.requestID,message})));break;
   case 'remedialGenerate':await runTask('remedial',b,signal=>models.remedial(b,signal,message=>send('remedialStatus',{requestID:b.requestID,message})));break;
   case 'cancelAnalysis':active.get('analysis')?.abort();break;
   case 'cancelStudy':active.get('study')?.abort();break;
   case 'cancelRemedial':active.get('remedial')?.abort();break;
   case 'codexStatus':send('codexStatus',await models.status());break;
   case 'codexLogin':await runTask('codex',b,signal=>models.login(signal,status=>send('codexStatus',status)));break;
   case 'cancelCodexLogin':active.get('codex')?.abort();break;
   case 'runtimeStatus':{let info;try{info=compiler();}catch(e){info={error:e.message};}send('runtimeStatus',{platform:process.platform,architecture:process.arch,compiler:info.name||info.error,clangd:!!findTool('clangd'),formatter:!!findTool('clang-format'),codex:!!findTool('codex'),vscode:!!findTool('code')});break;}
   case 'import':{const r=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'C 源文件',extensions:['c']}]});if(!r.canceled){const f=r.filePaths[0],s=await fs.stat(f);if(s.size>262144)throw Error('源文件不能超过256KB。');const code=new TextDecoder('utf-8',{fatal:true}).decode(await fs.readFile(f));send('imported',{code,name:path.basename(f)});}break;}
   case 'export':if(typeof b.code!=='string'||Buffer.byteLength(b.code)>262144)throw Error('代码过大。');await saveDialog(b.name||'main.c',b.code,['c']);break;
   case 'backup':await saveDialog('CPractice-backup.json',JSON.stringify(state,null,2),['json']);break;
   case 'restoreBackup':{
    const r=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'CPractice 学习备份',extensions:['json']}]});if(r.canceled)break;
    if((await fs.stat(r.filePaths[0])).size>134217728)throw Error('备份超过128MB。');
    const imported=validateState(JSON.parse(await fs.readFile(r.filePaths[0],'utf8')));
    const answer=await dialog.showMessageBox(window,{type:'question',message:'用该备份恢复学习记录？',detail:'当前记录会先自动备份到应用数据目录。恢复后重载界面，跨系统也可使用同一份备份。',buttons:['取消','恢复'],defaultId:0,cancelId:0});if(answer.response!==1)break;
    await restoreState(imported);break;
   }
   case 'openVSCode':await openVSCode(b);break;
   case 'reloadVSCode':{const f=path.join(workspace(b.problemID),'main.c');if((await fs.stat(f)).size>262144)throw Error('代码过大。');send('imported',{code:new TextDecoder('utf-8',{fatal:true}).decode(await fs.readFile(f)),name:'main.c'});break;}
   case 'openURL':{const url=new URL(b.url);if(url.protocol==='https:'&&!url.username&&!url.password)await shell.openExternal(url.href);break;}
  }
 }catch(e){send('error',e.message);}
}
async function finishQuit(){if(closing)return;closing=true;for(const c of active.values())c.abort();await language.stop();await store.queue.catch(()=>{});app.quit();}
if(!smoke&&!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{window?.show();window?.focus();});
 app.whenReady().then(async()=>{
  await fs.mkdir(dataDir,{recursive:true});
  if(!smoke&&process.platform==='darwin'){
   const legacy=path.join(app.getPath('appData'),'CPractice/state.json');
   try{await fs.access(store.file);}catch{try{const original=validateState(JSON.parse(await fs.readFile(legacy,'utf8')));await store.save(original);}catch{}}
  }
  try{state=await store.load();}catch(e){await dialog.showMessageBox({type:'error',message:e.message});app.quit();return;}
  window=new BrowserWindow({width:1400,height:900,minWidth:900,minHeight:620,backgroundColor:'#10141a',title:'CPractice · C 语言练习室',icon:path.join(resources,'AppIcon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([...(process.platform==='darwin'?[{role:'appMenu'}]:[]),{label:'文件',submenu:[{label:'导出学习记录',click:()=>saveDialog('CPractice-backup.json',JSON.stringify(state,null,2),['json'])},{role:'quit'}]},{role:'editMenu'},{label:'显示',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
  session.defaultSession.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')&&!details.url.startsWith('blob:')&&!details.url.startsWith('devtools:')}));
  ipcMain.on('cpractice:action',handle);ipcMain.on('cpractice:flushed',event=>{if(validSender(event)&&window.closingRequested)finishQuit();});
  window.on('close',event=>{if(closing)return;event.preventDefault();if(window.closingRequested)return;window.closingRequested=true;window.webContents.send('cpractice:closing');setTimeout(()=>{if(!closing)finishQuit();},3000).unref();});
  await window.loadFile(path.join(resources,'index.html'));
  if(smoke)require('./smoke.cjs').run({window,runner,store,resources,dataDir,restoreState,quit:finishQuit}).catch(async e=>{console.error(e);process.exitCode=1;await finishQuit();});
 });
 app.on('window-all-closed',()=>app.quit());
}
