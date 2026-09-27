'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'CPracticeLearningAudit-')),report=path.resolve(__dirname,'../tests/reports/learning-audit');
const child=spawn(require('electron'),['.','--learning-audit'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,CPRACTICE_DATA_DIR:profile,CPRACTICE_LEARNING_REPORT:report},stdio:'inherit'});
let cleaned=false;
function cleanup(){if(cleaned)return;cleaned=true;fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
child.on('error',e=>{console.error(e);cleanup();process.exitCode=1;});
child.on('exit',code=>{cleanup();if(code!==0)console.error('Learning audit failed: Electron exited with code '+code+'. No successful training result is claimed. Check GUI launch permissions and Codex login.');process.exitCode=code??1;});
process.on('SIGINT',()=>child.kill('SIGINT'));
