'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Learner,corpus,experiment}=require('../scripts/learning-experiment.cjs');
const resources=path.join(__dirname,'../Resources'),read=n=>JSON.parse(fs.readFileSync(path.join(resources,n+'.json')));
test('Generated browser data matches canonical JSON',()=>{for(const [name,file,global] of [['curriculum','curriculum.js','CURRICULUM'],['foundations-v5','foundations-v5.js','C_FOUNDATIONS'],['coursebook','coursebook-data.js','C_COURSEBOOK']]){const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(resources,file),'utf8'),ctx);assert.equal(JSON.stringify(ctx.window[global]),JSON.stringify(read(name)));}});
test('No duplicate example/steps or misconception/pitfall in foundations',()=>{for(const m of read('foundations-v5').modules)for(const p of m.points){assert.notEqual(p.beginner.example,p.beginner.steps.join('\n'),p.id);assert.ok(!p.professional.misconceptions.some(s=>p.pitfalls.includes(s)),p.id);assert.ok(!/^1\./.test(p.pseudocode),p.id);}});
test('Every competition problem has an existing prerequisite lesson and worked guide',()=>{const c=read('curriculum'),book=read('coursebook'),ids=new Set(book.lessons.map(l=>l.id)),pids=new Set(c.problems.map(p=>p.id));assert.equal(ids.size,book.lessons.length);for(const p of c.problems.filter(p=>p.collection==='olympiad')){const guide=book.lessons.find(l=>l.solutionID===p.id);assert.ok(guide,p.id);assert.ok(guide.prerequisites.every(x=>ids.has(x)),p.id);}for(const l of book.lessons){assert.equal(l.questions.length,3,l.id);assert.ok(l.beginner.length>100&&l.professional.length>100,l.id);assert.ok(l.practice.length&&l.practice.every(x=>pids.has(x)),l.id);assert.ok(l.prerequisites.every(x=>ids.has(x)),l.id);}for(const row of book.coverage)assert.ok(row.lessons.every(x=>ids.has(x)));});
test('Scratch learner has no knowledge before fitting, and excludes quiz keys/user state',()=>{const learner=new Learner();assert.equal(learner.predict('EOF').id,null);const d=corpus();assert.ok(d.inputs.every(x=>x.path.startsWith('Resources/')));assert.ok(d.documents.every(x=>!x.source.includes('question')));learner.fit([{id:'apple',source:'test',text:'苹果 果汁 苹果'}, {id:'code',source:'test',text:'循环 变量 循环'}]);assert.equal(learner.predict('循环').id,'code');assert.equal(learner.predict('xyzunknown').id,null);assert.throws(()=>experiment([{model:'other',answer:'bad'}]));});
test('Editorial coverage and protected code/judging contracts match the published corpus',()=>{
 const {verify}=require('../scripts/editorial-audit.cjs');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/editorial-review.json')));
 assert.deepEqual(verify(manifest).counts,{lesson:83,foundation:66,coursebook:141,problem:660});
 assert.equal(manifest.technicalErrata.length,6);
 const c=read('curriculum'),by=new Map(c.problems.map(p=>[p.id,p]));
 for(const name of ['chapter-additions','comprehensive','sports','olympiad-a','olympiad-b','course-exercises']){
  const data=read(name);for(const p of Array.isArray(data)?data:data.problems)assert.deepEqual(p,by.get(p.id),name+':'+p.id);
 }
 for(const t of c.tutorials)for(const l of t.lessons)assert.equal(l.teaching.questions.length,3,l.id);
});
