const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const sources=path.join(__dirname,'../Resources');
function harness(){
 const nodes=new Map(),sent=[],notices=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',scrollHeight:10,firstChild:{textContent:''},classList:{add(){},remove(){}},querySelectorAll(){return []},scrollTo(){},focus(){},click(){this.onclick?.({type:'click',target:this})}});return nodes.get(id)};
 const original={C001:{code:'int main(void) { return 7; }',input:'7\n'}};
 const c=vm.createContext({window:{},crypto:{randomUUID},state:{studyArchives:[],annotations:[],remedialJobs:[],remedialExercises:[],drafts:structuredClone(original)},native:true,page:'agent',post:(action,data)=>sent.push({action,...data}),persist(){},flush(){},toast:t=>notices.push(t),$:node,$$:()=>[],CAnnotations:{mount(){}},byID:id=>id==='S002'?{id,module:15,title:'原题',description:'原题规则',input:'输入',output:'输出',constraints:'n<=10',complexity:{time:'O(n)'}}:c.state.remedialExercises.find(p=>p.id===id),renderMistakes(){},esc:s=>String(s),navigate(){} });
 vm.runInContext(fs.readFileSync(path.join(sources,'study.js'),'utf8'),c);
 vm.runInContext(fs.readFileSync(path.join(sources,'remedial.js'),'utf8'),c);
 // Rendering is exercised by native WebKit tests; keep these tests focused on real state/transport lifecycle.
 vm.runInContext('renderStudy=()=>{}; rememberComposer=()=>{studyDraft=$("#study-input").value;const a=studyArchive();if(a){a.draft=studyDraft;a.quote=studyQuote;}};',c);
 return {c,nodes,node,sent,notices,original,run:code=>vm.runInContext(code,c)};
}
const tick=()=>new Promise(r=>setImmediate(r));
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS:',name)}
(async()=>{
 await test('真实click事件发送当前输入，且原始C草稿不变',async()=>{
  const h=harness();h.node('#study-input').value='为什么getchar返回int？';h.run('bindChat(null)');
  const pending=h.node('#study-send').onclick({type:'click'});
  const request=h.sent.find(x=>x.action==='studyAsk');assert.equal(request.messages.length,1);assert.equal(request.messages[0].content,'为什么getchar返回int？');
  h.c.receiveStudy('studyResult',{requestID:request.requestID,title:'getchar返回值',summary:'EOF和字符',answer:'使用int以区分EOF。',time:'2026-09-27T00:00:00Z'});await pending;
  assert.equal(h.c.state.studyArchives[0].messages.length,2);assert.equal(h.c.state.studyArchives[0].pending,false);assert.deepEqual(h.c.state.drafts,h.original);
 });
 await test('生成期间重复点击不追加问题或重复调用',async()=>{
  const h=harness();h.node('#study-input').value='第一问';const pending=h.c.sendStudy();await h.c.sendStudy();
  assert.equal(h.sent.filter(x=>x.action==='studyAsk').length,1);assert.equal(h.c.state.studyArchives[0].messages.length,1);
  h.c.receiveStudy('studyError',{requestID:h.sent[0].requestID,message:'已取消'});await pending;
 });
 await test('取消后保留原问题，重试不重复用户消息',async()=>{
  const h=harness();h.node('#study-input').value='解释EOF';let pending=h.c.sendStudy();const first=h.sent.at(-1);
  h.c.receiveStudy('studyError',{requestID:first.requestID,message:'已取消本次请求'});await pending;
  const a=h.c.state.studyArchives[0];assert.equal(a.pending,false);assert.match(a.error,/取消/);assert.equal(a.messages.length,1);
  pending=h.c.sendStudy(true);const second=h.sent.at(-1);assert.notEqual(first.requestID,second.requestID);assert.equal(a.messages.length,1);
  h.c.receiveStudy('studyResult',{requestID:second.requestID,title:'EOF',summary:'输入结束',answer:'EOF是负整数常量。'});await pending;assert.equal(a.messages.length,2);
 });
 await test('迟到或未知requestID不会结束当前请求',async()=>{
  const h=harness();h.node('#study-input').value='解释数组';const pending=h.c.sendStudy();const request=h.sent.at(-1);
  h.c.receiveStudy('studyResult',{requestID:randomUUID(),answer:'旧结果'});assert.equal(h.c.window.CStudy.requests.size,1);assert.equal(h.c.state.studyArchives[0].messages.length,1);
  h.c.receiveStudy('studyError',{requestID:request.requestID,message:'取消'});await pending;
 });
 await test('切换存档后回复只追加到原存档',async()=>{
  const h=harness();h.node('#study-input').value='问题A';const pending=h.c.sendStudy();const request=h.sent.at(-1),a=h.c.state.studyArchives[0];
  const b={id:randomUUID(),title:'B',messages:[],draft:''};h.c.state.studyArchives.push(b);h.c.targetID=b.id;h.run('studyArchiveID=targetID');
  h.c.receiveStudy('studyResult',{requestID:request.requestID,title:'A回答',summary:'A摘要',answer:'回答A'});await pending;
  assert.equal(a.messages.at(-1).content,'回答A');assert.equal(b.messages.length,0);assert.equal(h.run('studyArchiveID'),b.id);
 });
 await test('只发送最近8张图，旧照片仍完整留在存档',async()=>{
  const h=harness();const a={id:randomUUID(),title:'多图',messages:[{role:'user',content:'旧题',images:Array.from({length:6},(_,i)=>({name:'old'+i,dataURL:'old'+i}))},{role:'assistant',content:'旧解释'},{role:'user',content:'新题',images:Array.from({length:4},(_,i)=>({name:'new'+i,dataURL:'new'+i}))}]};
  h.c.state.studyArchives.push(a);h.c.targetID=a.id;h.run('studyArchiveID=targetID');const pending=h.c.sendStudy(true),request=h.sent.at(-1);
  assert.equal(request.messages.flatMap(m=>m.images).length,8);assert.equal(request.messages[0].images[0].name,'old2');assert.match(request.messages[0].content,/照片本轮未附/);assert.equal(a.messages[0].images.length,6);
  h.c.receiveStudy('studyError',{requestID:request.requestID,message:'取消'});await pending;
 });
 await test('重启把中断任务改为可重试，不删除问题和代码',()=>{
  const h=harness();h.c.state.studyArchives.push({id:'old',pending:true,messages:[{role:'user',content:'保留问题'}]});h.c.state.remedialJobs.push({id:'r',status:'running',code:'原代码'});h.c.initStudy();
  assert.equal(h.c.state.studyArchives[0].pending,false);assert.equal(h.c.state.studyArchives[0].messages[0].content,'保留问题');assert.equal(h.c.state.remedialJobs[0].status,'error');assert.equal(h.c.state.remedialJobs[0].code,'原代码');assert.deepEqual(h.c.state.drafts,h.original);
 });
 await test('重复整理同一错误只生成一次，多个问题串行调用',()=>{
  const h=harness();const analysis={problemID:'S002',code:'坏代码',report:{issues:[{line:1,title:'越界'},{line:2,title:'EOF截断'}]}};
  h.c.collectRemedial(analysis);h.c.collectRemedial(analysis);assert.equal(h.c.state.remedialJobs.length,2);assert.equal(h.sent.filter(x=>x.action==='remedialGenerate').length,1);
  const first=h.sent.at(-1);h.c.receiveRemedial('remedialError',{requestID:first.requestID,message:'模型失败'});assert.equal(h.sent.filter(x=>x.action==='remedialGenerate').length,2);assert.equal(h.c.state.remedialJobs[0].status,'error');assert.equal(h.c.state.remedialJobs[1].status,'running');
 });
 await test('动态题结果只新增题目，不覆盖原题或用户代码',()=>{
  const h=harness();h.c.collectRemedial({problemID:'S002',code:'原程序',report:{issues:[{line:1,title:'越界'}]}});const request=h.sent.at(-1);
  h.c.receiveRemedial('remedialResult',{requestID:request.requestID,exercise:{id:'R'+request.requestID.replaceAll('-',''),title:'针对练习',tests:[{input:'1',expected:'1'}]},validation:{status:'passed'}});
  const p=h.c.state.remedialExercises[0];assert.equal(p.generated,true);assert.equal(p.sourceID,'S002');assert.equal(h.c.state.remedialJobs[0].status,'done');assert.deepEqual(h.c.state.drafts,h.original);
  h.c.receiveRemedial('remedialResult',{requestID:request.requestID,exercise:{id:'duplicate'}});assert.equal(h.c.state.remedialExercises.length,1);
 });
 console.log(`${passed} study/remedial lifecycle regressions passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
