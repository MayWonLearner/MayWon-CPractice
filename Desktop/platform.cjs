'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
function searchPaths(env=process.env,platform=process.platform){
 const home=env.USERPROFILE||env.HOME||os.homedir();
 const dirs=(env.PATH||env.Path||'').split(platform==='win32'?';':':').filter(Boolean);
 if(platform==='win32')dirs.push(path.join(env.APPDATA||path.join(home,'AppData','Roaming'),'npm'),'C:\\msys64\\ucrt64\\bin','C:\\msys64\\clang64\\bin',path.join(env.ProgramFiles||'C:\\Program Files','LLVM','bin'),path.join(env.LOCALAPPDATA||path.join(home,'AppData','Local'),'Programs','Microsoft VS Code','bin'));
 else {
  dirs.push(path.join(home,'.local/bin'),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin','/opt/homebrew/opt/llvm/bin','/usr/local/opt/llvm/bin', '/Applications/Codex.app/Contents/Resources', '/Applications/Visual Studio Code.app/Contents/Resources/app/bin');
  const nvm=path.join(home,'.nvm/versions/node');
  try{for(const version of fs.readdirSync(nvm).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})))dirs.push(path.join(nvm,version,'bin'));}catch{}
 }
 return [...new Set(dirs)];
}
function findTool(name,env=process.env,platform=process.platform){
 const override=env['CPRACTICE_'+name.toUpperCase().replaceAll('-','_')];
 const candidates=override?[override]:searchPaths(env,platform).flatMap(dir=>(platform==='win32'?['.exe','.cmd','']:['']).map(ext=>path.join(dir,name+ext)));
 for(const file of candidates){try{fs.accessSync(file,platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);if(fs.statSync(file).isFile())return file;}catch{}}
 return null;
}
// Invoke npm's JS entry directly, rather than passing learner data through cmd.exe.
function commandFor(file){
 if(!file)throw Error('所需工具尚未安装，请查看“连接 Codex”或 README 的安装步骤。');
 if(process.platform==='win32'&&/\.cmd$/i.test(file)){
  const dir=path.dirname(file),name=path.basename(file,'.cmd').toLowerCase();
  const entry=name==='codex'?path.join(dir,'node_modules/@openai/codex/bin/codex.js'):name==='code'?path.join(dir,'../resources/app/out/cli.js'):null;
  const node=findTool('node');if(node&&entry&&fs.existsSync(entry))return {file:node,args:[entry]};
  throw Error('无法直接启动 '+name+'；请安装官方 Node.js/CLI，或用 CPRACTICE_'+name.toUpperCase()+' 指定可执行文件。');
 }
 return {file,args:[]};
}
function toolEnvironment(){const env={...process.env};for(const key of Object.keys(env))if(/^(CODEX_THREAD|CODEX_INTERNAL|CPRACTICE_)/.test(key))delete env[key];env.PATH=searchPaths().join(path.delimiter);return env;}
function compiler(){
 // Windows GCC includes the C runtime headers; a standalone LLVM install often does not.
 const names=process.platform==='win32'?['gcc','clang']:['clang','gcc'];
 for(const name of names){const p=findTool(name);if(p){
  // /usr/bin/clang is an xcrun shim. Resolve it before entering the compile sandbox.
  if(process.platform==='darwin'&&p==='/usr/bin/clang'){
   const r=spawnSync('/usr/bin/xcrun',['--find','clang'],{encoding:'utf8',timeout:5000});
   if(r.status===0&&r.stdout.trim())return {file:fs.realpathSync(r.stdout.trim()),name};
  }
  return {file:p,name};
 }}
 throw Error(process.platform==='win32'?'未找到 C 编译器。请按 README 安装 MSYS2 UCRT64 GCC。':process.platform==='darwin'?'未找到 C 编译器，请在终端运行 xcode-select --install。':'未找到 C 编译器，请安装 build-essential 或 clang。');
}
function sdkFlags(){if(process.platform!=='darwin')return [];const r=spawnSync('/usr/bin/xcrun',['--show-sdk-path'],{encoding:'utf8',timeout:5000});return r.status===0?['-isysroot',r.stdout.trim()]:[];}
function developerDirectory(){if(process.platform!=='darwin')return null;const r=spawnSync('/usr/bin/xcode-select',['-p'],{encoding:'utf8',timeout:5000});if(r.status!==0)return null;try{return fs.realpathSync(r.stdout.trim());}catch{return null;}}
module.exports={findTool,commandFor,searchPaths,toolEnvironment,compiler,sdkFlags,developerDirectory};
