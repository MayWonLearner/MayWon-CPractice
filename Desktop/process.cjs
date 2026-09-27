'use strict';
const {spawn}=require('node:child_process');
function killTree(child){
 if(!child?.pid)return;
 if(process.platform==='win32'){const killer=spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>child.kill());}
 else {try{process.kill(-child.pid,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}}
}
function execute(file,args,{cwd,input='',timeout=8000,maxOutput=1048576,env,signal,onOutput}={}){
 return new Promise(resolve=>{
  const start=Date.now();let out=[],err=[],size=0,timedOut=false,overflow=false,settled=false;
  if(signal?.aborted)return resolve({code:-1,out:'',err:'已取消',cancelled:true,milliseconds:0});
  const child=spawn(file,args,{cwd,env,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe'],shell:false});
  const stop=()=>killTree(child),timer=setTimeout(()=>{timedOut=true;stop();},timeout);
  signal?.addEventListener('abort',stop,{once:true});
  function finish(code,error){if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);resolve({code:code??-1,out:Buffer.concat(out).toString('utf8'),err:Buffer.concat(err).toString('utf8')+(error?'\n'+error.message:''),timedOut,overflow,cancelled:!!signal?.aborted,milliseconds:Date.now()-start});}
  function capture(chunks,data){size+=data.length;if(size<=maxOutput){chunks.push(data);onOutput?.(data.toString('utf8'));}else{overflow=true;stop();}}
  child.stdout.on('data',data=>capture(out,data));child.stderr.on('data',data=>capture(err,data));
  child.on('error',e=>finish(-1,e));child.on('close',code=>finish(code));child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
module.exports={execute,killTree};
