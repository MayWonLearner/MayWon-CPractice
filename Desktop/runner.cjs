'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execute}=require('./process.cjs');
const {compiler,sdkFlags,toolEnvironment,developerDirectory}=require('./platform.cjs');
const normalize=s=>String(s).trim().split(/\s+/u).filter(Boolean).join(' ');
const safeName=s=>typeof s==='string'&&/^[\w.-]+$/.test(s)&&!['.','..'].includes(s);
function validateDynamic(request){
 const e=request.exercise;
 if(!e||e.id!==request.problemID||!/^R[\da-f]{32}$/i.test(e.id)||!Array.isArray(e.tests)||e.tests.length<3||e.tests.length>12)throw Error('定向练习编号或检查点无效。');
 let total=0;for(const t of e.tests){for(const k of ['input','expected']){if(typeof t[k]!=='string'||Buffer.byteLength(t[k])>65536)throw Error('检查点输入输出过大。');total+=Buffer.byteLength(t[k]);}if(Object.keys(t.files||{}).length||Object.keys(t.outputFiles||{}).length)throw Error('定向题不允许外部文件。');}
 if(total>262144)throw Error('检查点总数据过大。');return e;
}
function macProfile(dir,helper,compiling,tool){
 const q=JSON.stringify,read=['/System','/usr/lib','/usr/share','/Library/Apple','/private/preboot','/private/var/db/dyld',dir,helper];
 if(compiling){read.push('/Library/Developer','/usr/bin','/bin',path.resolve(tool,'../..'));const developer=developerDirectory();if(developer)read.push(developer);}
 return `(version 1)(deny default)(allow file-read-metadata)(allow file-read-data (literal "/"))(allow file-read* ${read.map(x=>`(subpath ${q(x)})`).join(' ')} (literal "/dev/null") (literal "/dev/urandom") (literal "/dev/random"))(allow file-write* (subpath ${q(dir)}) (literal "/dev/null"))(allow sysctl-read)(allow mach-lookup)(allow signal (target self))(allow process-info* (target self)) ${compiling?'(allow process-exec)(allow process-fork)':`(allow process-exec (literal ${q(helper)}) (literal ${q(path.join(dir,'program'))}))`}`;
}
class Runner{
 constructor(resources,nativeSources){this.resources=resources;this.nativeSources=nativeSources;}
 async catalog(){return JSON.parse(await fs.readFile(path.join(this.resources,'curriculum.json'),'utf8'));}
 async problem(request){
  if(request.exercise)return validateDynamic(request);
  const c=await this.catalog(),p=c.problems.find(p=>p.id===request.problemID);if(p)return p;
  const l=c.tutorials.flatMap(c=>c.lessons).find(l=>l.id===request.problemID);if(l)return {id:l.id,tests:[{name:'教程示例验证',input:l.input,expected:l.expected}]};
  throw Error('找不到题目或教程示例。');
 }
 async run(request,{signal}={}){
  let dir;const result={status:'error',diagnostics:'',checks:[]};
  try{
   if(typeof request.code!=='string'||Buffer.byteLength(request.code)>262144||!['run','judge'].includes(request.mode)||Buffer.byteLength(request.input||'')>1048576)throw Error('代码/输入过大或运行方式无效。');
   const exercise=await this.problem(request),cc=compiler(),env=toolEnvironment();
   dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'CPracticeRun-')));
   const helper=path.join(dir,process.platform==='win32'?'limit.exe':'limit'),binary=path.join(dir,process.platform==='win32'?'program.exe':'program');
   const helperSource=path.join(this.nativeSources,process.platform==='win32'?'limit-win.c':'limit-runner.c');
   // Relative input/output arguments avoid legacy Windows compiler argv code-page loss.
   await fs.copyFile(helperSource,path.join(dir,'limit-helper.c'));
   const buildEnv={...env,TMPDIR:dir,TMP:'.',TEMP:'.'};
   const prep=await execute(cc.file,[...sdkFlags(),'-O2','limit-helper.c',...(process.platform==='win32'?['-municode']:[]),'-o',path.basename(helper)],{cwd:dir,env:buildEnv,timeout:30000,signal});
   if(prep.code!==0)throw Error('无法准备运行限制器：'+prep.err);
   await fs.writeFile(path.join(dir,'main.c'),request.code);
   const flags=[...sdkFlags(),'-std=c17','-Wall','-Wextra','-Wpedantic','-fno-common','-O2','-g',...(cc.name==='clang'?['-fno-color-diagnostics','-ferror-limit=12']:['-fdiagnostics-color=never','-fmax-errors=12']),'main.c','-o',path.basename(binary),'-lm'];
   let buildFile=cc.file,buildArgs=flags;
   if(process.platform==='darwin'){const profile=path.join(dir,'compile.sb');await fs.writeFile(profile,macProfile(dir,helper,true,cc.file));buildFile='/usr/bin/sandbox-exec';buildArgs=['-f',profile,cc.file,...flags];}
   const built=await execute(buildFile,buildArgs,{cwd:dir,env:buildEnv,timeout:30000,signal});
   result.diagnostics=built.err.split(dir+path.sep).join('');
   if(signal?.aborted)return {...result,status:'cancelled'};
   if(built.code!==0||built.timedOut)return {...result,status:built.timedOut?'compile_timeout':'compile_error',diagnostics:result.diagnostics||'编译失败：'+built.code};
   const tests=request.mode==='run'?[{name:'自定义运行',input:request.input||'',expected:'',files:exercise.tests[0]?.files}]:exercise.tests;
   for(let i=0;i<tests.length;i++){
    if(signal?.aborted)return {...result,status:'cancelled'};
    const t=tests[i],cwd=path.join(dir,'case-'+i);await fs.mkdir(cwd);
    for(const [name,contents] of Object.entries(t.files||{})){if(!safeName(name))throw Error('测试文件名无效。');await fs.writeFile(path.join(cwd,name),contents);}
    let runFile=helper,runArgs=[binary];
    if(process.platform==='darwin'){const profile=path.join(dir,'run.sb');await fs.writeFile(profile,macProfile(dir,helper,false,cc.file));runFile='/usr/bin/sandbox-exec';runArgs=['-f',profile,helper,binary];}
    // Do not pass authentication variables to learner programs; retain only toolchain/runtime paths.
    const runEnv={PATH:env.PATH,LANG:'C.UTF-8',LC_ALL:'C',HOME:cwd,TMPDIR:cwd,TMP:cwd,TEMP:cwd};
    if(process.platform==='win32'){runEnv.SystemRoot=process.env.SystemRoot;runEnv.WINDIR=process.env.WINDIR;}
    const r=await execute(runFile,runArgs,{cwd,env:runEnv,input:t.input,timeout:8500,signal});
    if(signal?.aborted)return {...result,status:'cancelled'};
    let fileMessage='';for(const [name,expected] of Object.entries(t.outputFiles||{})){
     if(!safeName(name))throw Error('输出文件名无效。');
     try{const file=path.join(cwd,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.size>1048576)throw Error();const actual=await fs.readFile(file,'utf8');if(normalize(actual)!==normalize(expected))fileMessage+='文件 '+name+' 内容不符。\n';}catch{fileMessage+='文件 '+name+' 缺失或过大。\n';}
    }
    const status=r.timedOut||r.code===124?'timeout':r.code!==0||r.overflow?'runtime_error':request.mode==='run'?'ran':normalize(r.out)===normalize(t.expected)&&!fileMessage?'passed':'wrong_answer';
    result.checks.push({name:t.name,input:t.input,expected:t.expected,actual:r.out,stderr:r.err+(r.overflow?'\n输出超过1MB，已停止。':'')+(r.code!==0?'\n退出状态：'+r.code:''),status,milliseconds:r.milliseconds,fileMessage});
   }
   result.status=request.mode==='run'?result.checks[0].status:result.checks.every(c=>c.status==='passed')?'passed':'failed';return result;
  }catch(e){return {...result,status:signal?.aborted?'cancelled':'error',diagnostics:e.message};}
  finally{if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});}
 }
}
module.exports={Runner,normalize,safeName,validateDynamic};
