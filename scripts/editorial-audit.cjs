'use strict';
// Compare the public editorial manifest with the installed corpus. Code and
// judging contracts are hashed separately from prose, so drift is visible.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function records(c,f,b){return [...c.tutorials.flatMap(m=>m.lessons.map(record=>({kind:'lesson',id:record.id,record}))),...f.modules.flatMap(m=>m.points.map(record=>({kind:'foundation',id:record.id,record}))),...b.lessons.map(record=>({kind:'coursebook',id:record.id,record})),...c.problems.map(record=>({kind:'problem',id:record.id,record}))];}
function protectedContent(kind,r){
 if(kind==='problem')return Object.fromEntries(['id','module','level','constraints','solution','starter','tests','bank','displayExamples','collection','sport','tags','skills','sources','topic'].filter(k=>k in r).map(k=>[k,r[k]]).concat([['complexityBounds',{time:r.complexity?.time,space:r.complexity?.space}],['subtaskRules',r.subtasks]]));
 if(kind==='lesson')return {id:r.id,code:r.code,input:r.input,expected:r.expected,answer:r.quiz?.answer,options:r.quiz?.options,walkthroughCode:r.walkthrough?.map(w=>({line:w.line,code:w.code})),mistakeCode:r.mistakes?.map(m=>({wrong:m.wrong,right:m.right})),quoteIDs:r.reviewQuotes?.map(q=>({id:q.id,keys:q.keys})),relatedTopics:r.relatedTopics};
 if(kind==='foundation')return {id:r.id,code:r.code,sampleInput:r.sampleInput,expectedOutput:r.expectedOutput,sources:r.sources,complexityBounds:{time:r.complexity?.time,space:r.complexity?.space}};
 return {id:r.id,stage:r.stage,prerequisites:r.prerequisites,practice:r.practice,code:r.code,diagram:r.diagram,solutionID:r.solutionID};
}
function corpus(){return records(read('Resources/curriculum.json'),read('Resources/foundations-v5.json'),read('Resources/coursebook.json'));}
function verify(manifest){
 const current=corpus(),index=new Map(manifest.records.map(x=>[x.kind+':'+x.id,x]));
 if(current.length!==index.size)throw Error('Editorial coverage count does not match corpus');
 for(const item of current){const key=item.kind+':'+item.id,entry=index.get(key);if(!entry)throw Error('Missing review: '+key);if(entry.afterSHA256!==hash(item.record))throw Error('Content changed since editorial review: '+key);if(entry.contractSHA256!==hash(protectedContent(item.kind,item.record)))throw Error('Code/judging contract changed: '+key);if(entry.conflicts?.length)throw Error('Unresolved editorial conflict: '+key);}
 return {items:current.length,counts:current.reduce((out,r)=>(out[r.kind]=(out[r.kind]||0)+1,out),{})};
}
if(require.main===module)console.log(verify(read('docs/editorial-review.json')));
module.exports={records,protectedContent,hash,corpus,verify};
