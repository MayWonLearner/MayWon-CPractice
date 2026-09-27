'use strict';
// Explicit --smoke-test uses disposable app data and never calls a model.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
async function run({window,store,dataDir,restoreState,quit}){
 const checks=[];
 try{
  await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(window.CPracticeTest&&document.querySelector('.module-card')){clearInterval(t);resolve(true);}else if(++n>100){clearInterval(t);reject(Error('home not loaded'));}},100);})`);
  const data=await window.webContents.executeJavaScript(`(()=>{const a={bridge:!!window.webkit?.messageHandlers?.native,nodeHidden:typeof require==='undefined',cards:document.querySelectorAll('.module-card').length};document.querySelector('#chapters button[data-module="6"]').click();a.fullTutorial=!!document.querySelector('[data-annotation-root],.lesson-content,.lesson-article')||document.body.innerText.includes('完整课程目录');a.points=document.body.innerText.includes('EOF');CPracticeTest.openProblem('C001');a.editor=!!document.querySelector('.monaco-editor');CPracticeTest.navigate('agent');a.tutor=!!document.querySelector('#study-send');a.math=CStudy.renderMarkdown('\\\\(x^2\\\\)').includes('katex');a.sanitized=!CStudy.renderMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>').includes('onerror');return a;})()`);
  assert.equal(data.bridge,true);assert.equal(data.nodeHidden,true);assert.equal(data.cards,15);assert.equal(data.fullTutorial,true);assert.equal(data.points,true);assert.equal(data.editor,true);assert.equal(data.tutor,true);assert.equal(data.math,true);assert.equal(data.sanitized,true);checks.push(data);
  await window.webContents.executeJavaScript(`(()=>{CPracticeTest.openProblem('C001');CEditor.instance.setValue(CURRICULUM.problems.find(p=>p.id==='C001').solution);CPracticeTest.startRun('judge');})()`);
  const judged=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const r=CPracticeTest.results.C001;if(r){clearInterval(t);resolve(r.result);}else if(++n>400){clearInterval(t);reject(Error('judge timeout'));}},100);})`);
  assert.equal(judged.status,'passed',JSON.stringify(judged));checks.push({nativeIPCJudge:'passed'});
  await window.webContents.executeJavaScript(`window.webkit.messageHandlers.native.postMessage({action:'save',state:CPracticeTest.snapshot()})`);
  for(let n=0;(await store.load()).history?.length!==1;n++){if(n>100)throw Error('submission was not saved');await new Promise(resolve=>setTimeout(resolve,25));}
  await restoreState({drafts:{},progress:{},favorites:[],history:[],reviews:{},last:'C001'});
  const restored=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(window.CPracticeTest&&document.querySelector('.module-card')){clearInterval(t);resolve(CPracticeTest.snapshot().history.length);}else if(++n>100){clearInterval(t);reject(Error('restored home not loaded'));}},100);})`);
  assert.equal(restored,0,'The old document must not overwrite an imported backup');
  await store.queue;
  assert.equal((await store.load()).history.length,0);
  const backup=(await fs.readdir(dataDir)).find(n=>n.startsWith('before-restore-'));
  assert.ok(backup);assert.equal(JSON.parse(await fs.readFile(path.join(dataDir,backup),'utf8')).history.length,1);
  checks.push({backupRestore:'passed',previousRecordsBackedUp:true});
  const dest=process.env.CPRACTICE_SMOKE_REPORT||path.join(process.cwd(),'tests/reports/desktop-smoke.json');await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,JSON.stringify({platform:process.platform,arch:process.arch,passed:true,checks},null,2));console.log('Desktop smoke passed:',process.platform,process.arch);
 }finally{await quit();}
}
module.exports={run};
