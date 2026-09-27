'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {findTool,toolEnvironment,sdkFlags,compiler}=require('./platform.cjs');
const {execute,killTree}=require('./process.cjs');
class Language{
 constructor(emit){this.emit=emit;this.pending=new Map();this.seq=0;this.version=0;this.versions=new Map();this.starting=null;this.child=null;this.queue=Promise.resolve();this.warned=false;}
 write(o){const data=Buffer.from(JSON.stringify(o));this.child?.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${data.length}\r\n\r\n`),data]));}
 notify(method,params){this.write({jsonrpc:'2.0',method,params});}
 rpc(method,params){return new Promise(resolve=>{const id=++this.seq,timer=setTimeout(()=>{this.pending.delete(id);resolve(null);},5000);this.pending.set(id,value=>{clearTimeout(timer);resolve(value);});this.write({jsonrpc:'2.0',id,method,params});});}
 async start(){
  if(this.starting)return this.starting;
  this.starting=(async()=>{
   const tool=findTool('clangd');if(!tool)throw Error('未找到 clangd：语法着色与缩进仍可用；安装 clangd 后可启用语义补全。');
   this.dir=await fs.mkdtemp(path.join(os.tmpdir(),'CPracticeLanguage-'));this.uri=pathToFileURL(path.join(this.dir,'main.c')).href;
   await fs.writeFile(path.join(this.dir,'compile_flags.txt'),['-std=c17','-Wall','-Wextra',...sdkFlags()].join('\n'));
   const cc=compiler();this.child=spawn(tool,['--background-index=false','--clang-tidy=false','--header-insertion=never','--enable-config=false','--log=error','--query-driver='+cc.file],{cwd:this.dir,env:toolEnvironment(),windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
   this.child.stdin.on('error',()=>{});this.child.stderr.resume();this.child.on('error',()=>{});
   let buffer=Buffer.alloc(0);
   this.child.stdout.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);if(buffer.length>8000000){this.stop();return;}while(true){const end=buffer.indexOf('\r\n\r\n');if(end<0)break;const size=Number(buffer.subarray(0,end).toString().match(/Content-Length:\s*(\d+)/i)?.[1]);if(!Number.isFinite(size)||size>8000000){this.stop();return;}if(buffer.length<end+4+size)break;try{this.receive(JSON.parse(buffer.subarray(end+4,end+4+size)));}catch{}buffer=buffer.subarray(end+4+size);}});
   this.child.on('exit',()=>{for(const reply of this.pending.values())reply(null);this.pending.clear();});
   const initialized=await this.rpc('initialize',{processId:process.pid,rootUri:pathToFileURL(this.dir).href,capabilities:{textDocument:{completion:{completionItem:{snippetSupport:true}},hover:{contentFormat:['markdown','plaintext']},documentSymbol:{hierarchicalDocumentSymbolSupport:true}}}});
   if(!initialized)throw Error('clangd 未能启动，请检查编译工具安装。');this.notify('initialized',{});
  })();return this.starting;
 }
 receive(o){if(o.id!=null){this.pending.get(o.id)?.(o.result??null);this.pending.delete(o.id);return;}if(o.method==='textDocument/publishDiagnostics'&&o.params.uri===this.uri&&o.params.version===this.version)this.emit({diagnostics:o.params.diagnostics,version:this.versions.get(this.version),uri:this.uri});}
 handle(b){this.queue=this.queue.then(()=>this.perform(b)).catch(()=>{});}
 async perform(b){
  if(!Number.isInteger(b.requestID)||typeof b.code!=='string'||Buffer.byteLength(b.code)>262144)return;
  const reply=result=>this.emit({requestID:b.requestID,result:result??null,uri:this.uri});
  try{
   if(b.method==='format'){const file=findTool('clang-format');if(!file){reply(null);return;}const r=await execute(file,['--style={BasedOnStyle: LLVM, IndentWidth: 4, ColumnLimit: 88, AllowShortFunctionsOnASingleLine: None, AllowShortIfStatementsOnASingleLine: Never, AllowShortLoopsOnASingleLine: false}'],{input:b.code,env:toolEnvironment(),timeout:5000});reply(r.code===0?r.out:null);return;}
   await this.start();
   if(b.code!==this.text||!this.open){this.text=b.code;this.version++;this.versions.clear();this.versions.set(this.version,b.version);if(!this.open){this.notify('textDocument/didOpen',{textDocument:{uri:this.uri,languageId:'c',version:this.version,text:b.code}});this.open=true;}else this.notify('textDocument/didChange',{textDocument:{uri:this.uri,version:this.version},contentChanges:[{text:b.code}]});}
   if(b.method==='sync'){reply(true);return;}
   if(!['textDocument/completion','textDocument/hover','textDocument/definition','textDocument/references','textDocument/documentSymbol','textDocument/signatureHelp','textDocument/rename'].includes(b.method)){reply(null);return;}
   reply(await this.rpc(b.method,{...b.params,textDocument:{uri:this.uri}}));
  }catch(e){reply(null);if(!this.warned){this.warned=true;this.emit({serviceError:e.message});}}
 }
 async stop(){killTree(this.child);for(const reply of this.pending.values())reply(null);this.pending.clear();if(this.dir)await fs.rm(this.dir,{recursive:true,force:true}).catch(()=>{});}
}
module.exports={Language};
