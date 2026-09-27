'use strict';
// Explicit developer-only audit. The launcher supplies a disposable profile.
const fs=require('node:fs/promises'),path=require('node:path');
const {experiment,saveExperiment}=require('../scripts/learning-experiment.cjs');
async function run({window,quit}){
 const destination=process.env.CPRACTICE_LEARNING_REPORT;if(!destination)throw Error('Use scripts/run-learning-audit.cjs so no personal profile is used');
 try{
  await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(window.CStudy&&window.CPracticeTest){clearInterval(t);resolve(true);}else if(++n>100){clearInterval(t);reject(Error('Learning UI not ready'));}},100);})`);
  const baseline=experiment(),difficult=baseline.report.afterReading.filter(x=>!x.correct||x.margin<0.08).slice(0,3),answers=[];
  for(const item of difficult){
   const id=item.expected[0],foundation=JSON.parse(await fs.readFile(path.join(__dirname,'../Resources/foundations-v5.json'),'utf8')).modules.flatMap(m=>m.points).find(p=>p.id===id),lesson=JSON.parse(await fs.readFile(path.join(__dirname,'../Resources/coursebook.json'),'utf8')).lessons.find(p=>p.id===id);
   const source=foundation?{title:foundation.title,beginner:foundation.beginner,professional:foundation.professional,pseudocode:foundation.pseudocode}:lesson?{title:lesson.title,beginner:lesson.beginner,professional:lesson.professional,pseudocode:lesson.pseudocode}:null;
   if(!source)throw Error('Missing source '+id);
   const question='这是教材可读性实验。请仅依据引用的本应用教程解释，不引入外部资料；缺少依据就明确说教材缺失。先指出初学者在哪一步容易误解，再用小白+专业双层语言说明，给具体值的推演。问题：'+item.question;
   console.log('Asking built-in High tutor:',item.id);
   const response=await window.webContents.executeJavaScript(`CStudy.ask([{role:'user',content:${JSON.stringify(question)}}],{context:'仅以本次附带教程为依据的可读性检查',quote:${JSON.stringify(JSON.stringify(source))}})`);
   answers.push({...response,lessonID:id,probeID:item.id,question,source});
   await fs.mkdir(destination,{recursive:true});await fs.writeFile(path.join(destination,'teacher-answers.json'),JSON.stringify(answers,null,2));
  }
  const result=experiment(answers);saveExperiment(result,destination);console.log('Learning audit:',JSON.stringify(result.report.metrics));
 }finally{await quit();}
}
module.exports={run};
