'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
// The parent removes its disposable profile after Chromium has released Windows file locks.
function launch(executable,args,report){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'CPracticeSmoke-'));
 fs.rmSync(report,{force:true});
 try{
  const r=spawnSync(executable,args,{cwd:path.resolve(__dirname,'..'),env:{...process.env,CPRACTICE_DATA_DIR:data,CPRACTICE_SMOKE_REPORT:report},stdio:'inherit',timeout:120000});
  if(r.error)throw r.error;
  if(r.status!==0||!fs.existsSync(report)||!JSON.parse(fs.readFileSync(report)).passed)throw Error('Desktop smoke test failed');
 }finally{fs.rmSync(data,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
}
if(require.main===module)launch(require('electron'),['.','--smoke-test'],path.resolve(__dirname,'../tests/reports/desktop-smoke.json'));
module.exports={launch};
