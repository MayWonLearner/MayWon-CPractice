'use strict';
let remedialActive=null;
function collectRemedial(analysis){
 if(!analysis?.report?.issues?.length)return;
 state.remedialJobs??=[];for(const issue of analysis.report.issues){const signature=JSON.stringify([analysis.problemID,analysis.code,issue.line,issue.title]);if(state.remedialJobs.some(j=>j.signature===signature))continue;state.remedialJobs.push({id:crypto.randomUUID(),signature,sourceID:analysis.problemID,issue,code:analysis.code,status:'queued',createdAt:new Date().toISOString()});}persist();pumpRemedial();
}
function pumpRemedial(){
 if(!native||remedialActive)return;const job=state.remedialJobs?.find(j=>j.status==='queued');if(!job)return;const p=byID(job.sourceID);if(!p){job.status='error';job.error='原题已不存在。';persist();return;}
 remedialActive=job.id;job.status='running';job.message='正在根据本次错误设计完整程序题…';persist();if(page==='mistakes')renderMistakes();
 post('remedialGenerate',{requestID:job.id,sourceID:job.sourceID,issue:job.issue,originalProblem:{id:p.id,module:p.module,title:p.title,description:p.description,input:p.input,output:p.output,constraints:p.constraints,complexity:p.complexity},code:job.code});
}
function receiveRemedial(type,payload){
 if(!type.startsWith('remedial'))return false;const job=state.remedialJobs?.find(j=>j.id===payload.requestID);if(!job||job.id!==remedialActive)return true;
 if(type==='remedialStatus'){job.message=payload.message;if(page==='mistakes')renderMistakes();return true;}
 remedialActive=null;if(type==='remedialResult'){
 const exercise=payload.exercise;exercise.generated=true;exercise.sourceID=job.sourceID;exercise.sourceIssue=job.issue.title;exercise.createdAt=new Date().toISOString();exercise.validation=payload.validation;
 state.remedialExercises??=[];state.remedialExercises.push(exercise);job.status='done';job.exerciseID=exercise.id;toast('错题本新增定向练习：'+exercise.title);
 }else{job.status='error';job.error=payload.message||'定向练习未完成，请重试。';}
 persist();flush();if(page==='mistakes')renderMistakes();pumpRemedial();return true;
}
function renderRemedialSection(){
 const jobs=state.remedialJobs??[],exercises=state.remedialExercises??[];return `<section class="remedial-section"><div class="section-head"><div><h2>为你的错误专门设计的练习</h2><p>Medium 每次发现错误或显著复杂度问题后，自动生成一道完整程序题；参考程序通过本机检查点后才收录。</p></div><button class="button small" id="import-analysis-mistakes">整理已有模型复盘</button></div>${jobs.filter(j=>j.status!=='done').map(j=>`<article class="remedial-job"><strong>${esc(byID(j.sourceID)?.title??j.sourceID)} · ${esc(j.issue.title)}</strong><p>${esc(j.status==='error'?j.error:j.message??'等待生成…')}</p>${j.status==='error'?`<button class="button small" data-retry-remedial="${j.id}">重试生成</button>`:j.status==='running'?'<button class="button quiet small" id="cancel-remedial">取消本次生成</button>':''}</article>`).join('')}${exercises.map(p=>`<article class="recommend-card"><div class="tags"><span class="tag">${completed(p.id)?'✓ 已通过':'定向练习'}</span><span class="tag">${esc(p.level)}</span></div><h3>${esc(p.title)}</h3><p>针对：${esc(p.sourceIssue)}<br>来自 ${esc(byID(p.sourceID)?.title??p.sourceID)}</p><p>${esc(p.description.slice(0,180))}</p><button class="button primary small" data-remedial-open="${p.id}">编写完整程序 →</button> <button class="text-btn" data-remedial-source="${p.sourceID}">回看原题</button></article>`).join('')||(!jobs.length?'<p class="note">在练习中点击“详细分析”，发现的问题会在这里变成新的巩固题。已有复盘可点击上方按钮整理。</p>':'')}</section>`;
}
function bindRemedial(){
 if($('#import-analysis-mistakes'))$('#import-analysis-mistakes').onclick=()=>{Object.values(state.aiAnalyses??{}).forEach(collectRemedial);renderMistakes();};
 $$('[data-remedial-open]').forEach(b=>b.onclick=()=>openProblem(b.dataset.remedialOpen));$$('[data-remedial-source]').forEach(b=>b.onclick=()=>openProblem(b.dataset.remedialSource));
 $$('[data-retry-remedial]').forEach(b=>b.onclick=()=>{const j=state.remedialJobs.find(x=>x.id===b.dataset.retryRemedial);j.status='queued';j.error='';persist();pumpRemedial();renderMistakes();});if($('#cancel-remedial'))$('#cancel-remedial').onclick=()=>post('cancelRemedial');
}
function restoreRemedial(){if(!state.remedialBackfillV5){state.remedialBackfillV5=true;Object.values(state.aiAnalyses??{}).forEach(collectRemedial);persist();}pumpRemedial();}
window.CRemedial={collect:collectRemedial,receive:receiveRemedial,pump:pumpRemedial,restore:restoreRemedial};
