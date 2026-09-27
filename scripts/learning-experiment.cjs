'use strict';
// Zero prior vocabulary or pretrained weights. A small multinomial Naive Bayes
// learner predicts a source lesson; it does not claim language understanding.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function tokens(text){const chunks=String(text).toLowerCase().match(/[a-z_][a-z_0-9]*|[\u3400-\u9fff]+/g)||[],out=[];for(const c of chunks){if(/[\u3400-\u9fff]/.test(c)){for(let i=0;i<c.length-1;i++)out.push(c.slice(i,i+2));}else out.push(c);}return out;}
class Learner{
 constructor(){this.classes=new Map();this.vocab=new Set();}
 fit(documents){this.classes.clear();this.vocab.clear();for(const d of documents){const words=tokens(d.text);let c=this.classes.get(d.id);if(!c){c={counts:new Map(),total:0,documents:[]};this.classes.set(d.id,c);}c.documents.push(d);for(const w of words){this.vocab.add(w);c.counts.set(w,(c.counts.get(w)||0)+1);c.total++;}}return this;}
 predict(question){const words=tokens(question).filter(w=>this.vocab.has(w));if(!words.length||!this.classes.size)return {id:null,margin:0,evidence:null};
  const scores=[...this.classes].map(([id,c])=>({id,score:words.reduce((s,w)=>s+Math.log(((c.counts.get(w)||0)+0.1)/(c.total+0.1*this.vocab.size)),0)/words.length})).sort((a,b)=>b.score-a.score);
  const best=scores[0],c=this.classes.get(best.id);const evidence=c.documents.map(d=>({document:d,overlap:words.reduce((n,w)=>n+(tokens(d.text).includes(w)?1:0),0)})).sort((a,b)=>b.overlap-a.overlap)[0].document;
  return {id:best.id,margin:best.score-(scores[1]?.score??best.score),evidence:{source:evidence.source,sha256:hash(evidence.text),text:evidence.text}};
 }
 serialize(){return {kind:'multinomial-naive-bayes',alpha:0.1,vocabulary:[...this.vocab].sort(),classes:[...this.classes].map(([id,c])=>({id,total:c.total,counts:Object.fromEntries(c.counts)}))};}
}
function corpus(){const documents=[],inputs=[];function read(file){const bytes=fs.readFileSync(path.join(root,file));inputs.push({path:file,sha256:hash(bytes)});return JSON.parse(bytes);}
 const foundations=read('Resources/foundations-v5.json');for(const m of foundations.modules)for(const p of m.points){for(const [section,text] of Object.entries({beginner:[p.beginner.analogy,p.beginner.example,...p.beginner.steps].filter(Boolean).join('\n'),professional:p.professional.mechanism+'\n'+p.professional.boundaries,pseudocode:p.pseudocode})){documents.push({id:p.id,source:`foundation:${p.id}/${section}`,text:p.title+'\n'+text});}}
 const book=read('Resources/coursebook.json');for(const p of book.lessons.filter(p=>p.stage!=='worked'))for(const section of ['beginner','professional','pseudocode'])documents.push({id:p.id,source:`coursebook:${p.id}/${section}`,text:p.title+'\n'+p[section]});
 return {documents,inputs}; // Deliberately excludes quizzes, answer keys, problem solutions, user state.
}
function evaluate(learner,probes){return probes.map(p=>{const prediction=learner.predict(p.question);return {id:p.id,question:p.question,expected:p.sources,predicted:prediction.id,correct:p.sources.includes(prediction.id),margin:prediction.margin,evidence:prediction.evidence};});}
function experiment(answers=[]){const {documents,inputs}=corpus(),probes=JSON.parse(fs.readFileSync(path.join(root,'tests/learning-probes.json'))),learner=new Learner();const before=evaluate(learner,probes);learner.fit(documents);const after=evaluate(learner,probes);const added=[];
 for(const a of answers){if(a.model!=='gpt-5.6-sol'||a.effort!=='high'||!(a.sourceID||a.requestID)||!a.answer||!a.lessonID)throw Error('Only recorded in-app High answers may enter the training set');added.push({id:a.lessonID,source:a.sourceID||('in-app-question:'+a.requestID),text:a.answer});}
 learner.fit([...documents,...added]);const afterQuestions=evaluate(learner,probes);
 const summary=rows=>({correct:rows.filter(r=>r.correct).length,total:rows.length,accuracy:rows.filter(r=>r.correct).length/rows.length});
 return {report:{method:'从空词表开始拟合多项式朴素贝叶斯；字符二元组与英文标识符；无预训练权重。任务是定位相关教材，不是解题或理解测验。',limitations:['预训练High只扮演回答提问的教师，不扮演从零学习者。','这是固定探针的课程定位实验，不证明真人学习效果，不衡量算法掌握程度。','探针与答案未参与训练；提问后数据已针对已发现困难补充，因此提问后分数属于适应结果，不是新的盲测成绩。','低置信度与错误定位提示可读性审查方向；最后修改由具体语义与可运行示例验证，不能为提分堆关键词。'],inputs,documents:documents.length,answerDocuments:added.length,metrics:{before:summary(before),afterReading:summary(after),afterQuestions:summary(afterQuestions)},before,afterReading:after,afterQuestions,teacherAnswers:answers},model:learner.serialize()};
}
function saveExperiment(result,dir){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'learning-report.json'),JSON.stringify(result.report,null,2));fs.writeFileSync(path.join(dir,'learner-model.json'),JSON.stringify(result.model));}
if(require.main===module){const answerFile=process.argv[2],answers=answerFile?JSON.parse(fs.readFileSync(answerFile)):[];const result=experiment(answers);saveExperiment(result,path.join(root,'tests/reports'));console.log(JSON.stringify(result.report.metrics,null,2));}
module.exports={Learner,tokens,corpus,evaluate,experiment,saveExperiment};
