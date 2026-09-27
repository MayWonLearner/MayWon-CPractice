'use strict';
let analysisPending=null,analysisRendered=null,analysisHoverTimer=null,analysisHideTimer=null,analysisHoverKey=null;
function analysisInline(text){return esc(text).replace(/`([^`\n]+)`/g,'<code>$1</code>');}
function analysisPatch(text){
 if(!String(text).includes('```'))return `<pre class="codeblock">${esc(text)}</pre>`;
 return String(text).split(/```(?:c|text)?\n([\s\S]*?)```/g).map((s,i)=>i%2?`<pre class="codeblock">${esc(s)}</pre>`:`<p>${analysisInline(s)}</p>`).join('');
}
function analysisControls(){
 const saved=current&&state.aiAnalyses?.[current.id];
 return `<div class="analysis-actions"><button class="button primary small" data-ai-analyze>${analysisPending?'查看分析进度':'详细分析 · GPT-5.6-Sol'}</button>${saved?'<button class="button quiet small" data-ai-saved>查看上次模型分析</button>':''}<span class="muted">Medium · 联网发送本题代码与诊断 · 使用已登录的 Codex</span></div>`;
}
function bindAnalysisControls(){
 $$('[data-ai-analyze]').forEach(b=>b.onclick=startDetailedAnalysis);
 $$('[data-ai-saved]').forEach(b=>b.onclick=()=>showAnalysisReport(state.aiAnalyses?.[current?.id]));
 if($('#analyze-button')){$('#analyze-button').disabled=false;$('#analyze-button').textContent=analysisPending?'分析进度':'详细分析';$('#analyze-button').onclick=startDetailedAnalysis;}
}
function startDetailedAnalysis(){
 if(!current)return;
 if(analysisPending){showAnalysisProgress();return;}
 if(!native){toast('模型分析需要打开 Mac 应用，并安装、登录 Codex CLI。');return;}
 saveDraft();flush();
 const code=codeFor(current),previous=[...state.history].reverse().find(h=>h.problemID===current.id&&h.code!==code)?.code;
 const requestID=crypto.randomUUID();analysisPending={requestID,problemID:current.id,code,input:state.drafts[current.id]?.input??'',message:'正在重新验证当前代码…'};
 showAnalysisProgress();bindAnalysisControls();
 post('analyze',{requestID,problemID:current.id,code,input:analysisPending.input,previousCode:previous??'',exercise:current.generated?current:undefined});
}
function analysisNotice(title,message,{cancel=false,retry=false,problemID=null}={}){
 let box=$('#ai-notice');if(!box){box=document.createElement('aside');box.id='ai-notice';box.setAttribute('role','status');document.body.appendChild(box);}
 box.innerHTML=`<button class="ai-notice-close" aria-label="关闭分析通知">×</button><strong>${esc(title)}</strong><p id="ai-progress">${esc(message)}</p>${cancel?'<button class="button quiet small" id="cancel-analysis">取消本次分析</button>':''}${retry?'<button class="button quiet small" id="retry-analysis">重试当前代码</button>':''}${problemID?'<button class="button quiet small" id="locate-analysis">查看代码标注</button>':''}`;
 box.querySelector('.ai-notice-close').onclick=()=>box.remove();
 if(cancel)$('#cancel-analysis').onclick=()=>{post('cancelAnalysis');$('#cancel-analysis').disabled=true;$('#ai-progress').textContent='正在取消…';};
 if(retry)$('#retry-analysis').onclick=startDetailedAnalysis;
 if(problemID)$('#locate-analysis').onclick=()=>{if(current?.id!==problemID)openProblem(problemID);showAnalysisReport(state.aiAnalyses?.[problemID]);};
}
function showAnalysisProgress(){
 if(analysisPending)analysisNotice('GPT-5.6-Sol · Medium 正在分析',analysisPending.message+' 分析期间可以继续修改代码。',{cancel:true});
}
function hideAnalysisHover(){
 clearTimeout(analysisHoverTimer);clearTimeout(analysisHideTimer);analysisHoverKey=null;$('#ai-hover')?.remove();
}
function leaveAnalysisHover(){
 clearTimeout(analysisHoverTimer);analysisHideTimer=setTimeout(hideAnalysisHover,250);
}
function openAnalysisHover(html,anchor,key){
 clearTimeout(analysisHoverTimer);clearTimeout(analysisHideTimer);
 if(analysisHoverKey===key&&$('#ai-hover'))return;
 hideAnalysisHover();analysisHoverKey=key;
 const box=document.createElement('aside');box.id='ai-hover';box.setAttribute('aria-label','GPT-5.6-Sol 分析详情');
 box.innerHTML=`<button class="ai-hover-close" aria-label="关闭悬浮分析">×</button>${html}`;document.body.appendChild(box);
 const width=Math.min(580,window.innerWidth-32);box.style.width=width+'px';
 box.style.left=Math.max(16,Math.min(anchor.left,window.innerWidth-width-16))+'px';
 const height=box.getBoundingClientRect().height;
 const below=anchor.bottom+7;box.style.top=Math.max(12,Math.min(below+height<=window.innerHeight-16?below:anchor.top-height-7,window.innerHeight-height-16))+'px';
 box.onmouseenter=()=>{clearTimeout(analysisHideTimer);clearTimeout(analysisHoverTimer);};box.onmouseleave=leaveAnalysisHover;
 box.querySelector('.ai-hover-close').onclick=hideAnalysisHover;bindDiagnosticLinks();
 box.querySelectorAll('[data-reviewlesson]').forEach(b=>b.addEventListener('click',hideAnalysisHover));
}
function queueAnalysisHover(html,anchor,key){
 clearTimeout(analysisHideTimer);clearTimeout(analysisHoverTimer);
 if(analysisHoverKey===key&&$('#ai-hover'))return;
 analysisHoverTimer=setTimeout(()=>openAnalysisHover(html,anchor,key),350);
}
function analysisRepairHTML(saved,issue){
 const r=issue.repair;
 if(!r)return `<section class="ai-repair"><h4>具体修改建议</h4><p>${analysisInline(issue.minimalFix)}</p><h4>上次报告的整体修改代码（涉及多处问题）</h4>${analysisPatch(saved.report.minimalPatch)}<p class="muted">这份旧报告尚未提供逐段替换范围和补充说明。点击“详细分析”可按当前代码重新生成；不要把整段代码当成本行的直接替换。</p></section>`;
 const original=saved.code.split('\n').slice(r.startLine-1,r.endLine).join('\n');
 return `<section class="ai-repair"><h4>建议替换的代码</h4><p class="ai-repair-range">将分析时的第 ${r.startLine}–${r.endLine} 行整体替换为下面代码，不要追加在原代码后面。${saved.code!==state.drafts[saved.problemID]?.code?'当前代码已修改，请先对照原代码定位，不要直接按旧行号替换。':''}</p><pre class="codeblock ai-replacement">${esc(r.code)}</pre><h4>具体怎么改</h4><ol>${r.steps.map(x=>`<li>${analysisInline(x)}</li>`).join('')}</ol><h4>为什么这样改／补充说明</h4><p>${analysisInline(r.explanation)}</p><h4>修改后怎样核对</h4><p>${analysisInline(r.verification)}</p><details><summary>对照本次分析使用的原代码</summary><pre class="codeblock">${esc(original)}</pre></details></section>`;
}
function analysisIssueHTML(saved,issue,stale=false){
 return `<article class="ai-analysis"><div class="ai-provenance">GPT-5.6-Sol · Medium · ${issue.originalLine&&issue.originalLine!==issue.line?`原第 ${issue.originalLine} 行 → 当前第 ${issue.line} 行`:`第 ${issue.line} 行`}</div>${stale?'<p class="ai-stale">待复核：代码已修改。以下是上一次分析及当时的代码，不代表修改后仍然有错。点击“详细分析”可重新验证。</p>':''}<h3>${esc(issue.title)}</h3>${analysisRepairHTML(saved,issue)}<h4>本次证据</h4><p>${analysisInline(issue.evidence)}</p><h4>小白解释</h4><p>${analysisInline(issue.beginner)}</p><h4>专业解释</h4><p>${analysisInline(issue.professional)}</p>${analysisReviewHTML(saved.report.reviews)}<p class="muted">失败过程、复杂度和完整复盘：悬浮代码末尾的分析条查看。</p></article>`;
}
function analysisReviewHTML(reviews){
 return `<h3>对应教程原文与本次关联</h3>${reviews.map(x=>{const q=analysisQuote(x.quoteId);return q?`<blockquote>${esc(q.quote.text)}</blockquote><p>${analysisInline(x.explanation)}</p><button class="text-btn" data-reviewlesson="${q.module},${q.index},${esc(q.quote.id)}">${esc(q.lesson.title)} →</button>`:'';}).join('')||'<p>本次未选择直接相关的教程引用。</p>'}`;
}
function syncAnalysisAnnotations(){
 const saved=current&&state.aiAnalyses?.[current.id],model=window.CEditor?.model;
 if(!model){analysisRendered=null;return;}
 const stale=!!saved&&model.getValue()!==saved.code,version=model.getVersionId();
 if(analysisRendered?.model===model&&analysisRendered.saved===saved&&analysisRendered.version===version)return;
 hideAnalysisHover();analysisRendered={model,saved,stale,version};
 const issues=saved?(stale?window.CEditor.mapAnalysisIssues(saved.code,saved.report.issues):saved.report.issues):[];
 window.CEditor.setAnalysis(saved?{
  issues,
  label:stale?'GPT 分析 · 待复核 · 复杂度与旧分析 · 悬浮查看':'GPT 分析 · 时间 / 空间复杂度与整体复盘 · 悬浮查看',
  stale,
  hoverIssue(line,anchor){const matches=issues.filter(x=>x.line===line);if(matches.length)queueAnalysisHover(matches.map(x=>analysisIssueHTML(saved,x,stale)).join(''),anchor,`${saved.requestID}:${version}:${line}`);},
  hoverSummary(anchor,immediate=false){const html=analysisReportHTML(saved);(immediate?openAnalysisHover:queueAnalysisHover)(html,anchor,`${saved.requestID}:summary:${version}`);},
  leave:leaveAnalysisHover,hide:hideAnalysisHover
 }:null);
}
function showAnalysisReport(saved){
 if(!saved)return;
 if(current?.id!==saved.problemID)openProblem(saved.problemID);
 syncAnalysisAnnotations();window.CEditor?.revealAnalysis();
}
function analysisQuote(id){
 for(const chapter of tutorials)for(let index=0;index<chapter.lessons.length;index++){
  const lesson=chapter.lessons[index],quote=lesson.reviewQuotes?.find(q=>q.id===id);
  if(quote)return {module:chapter.module,index,lesson,quote};
 }
 return null;
}
function analysisReportHTML(saved){
 const r=saved.report,p=byID(saved.problemID),stale=state.drafts[saved.problemID]?.code!==saved.code;
 const pre=text=>`<pre class="codeblock">${esc(text)}</pre>`;
 const list=xs=>`<ol>${(xs??[]).map(x=>`<li>${analysisInline(x)}</li>`).join('')}</ol>`;
 return `<article class="ai-analysis"><div class="ai-provenance">GPT-5.6-Sol · Medium · ${esc(new Date(saved.time).toLocaleString('zh-CN'))}</div><h3>${esc(p?.title??saved.problemID)}</h3>${stale?'<p class="ai-stale">代码已修改。这份分析对应下方保存的旧代码；点击“详细分析”可重新分析当前代码。</p>':''}<h3>时间与空间复杂度</h3><p>时间：${analysisInline(r.complexity.time)}<br>空间：${analysisInline(r.complexity.space)}</p><p>${analysisInline(r.complexity.explanation)}</p><h3>整体复盘</h3><p class="ai-summary">${analysisInline(r.summary)}</p>${r.alreadyFixed.length?`<h3>这次已经修好的地方</h3>${list(r.alreadyFixed)}`:''}${r.issues.map(x=>`<section class="ai-issue"><h3>第 ${x.line} 行 · ${esc(x.title)}</h3>${pre(x.code)}<h4>本次证据</h4><p>${analysisInline(x.evidence)}</p><h4>小白解释</h4><p>${analysisInline(x.beginner)}</p><h4>专业解释</h4><p>${analysisInline(x.professional)}</p>${analysisRepairHTML(saved,x)}</section>`).join('')}<h3>把失败过程走一遍</h3>${pre(r.walkthrough.input)}${list(r.walkthrough.steps)}<p><b>期望：</b>${analysisInline(r.walkthrough.expected)}</p><p><b>实际／不确定性：</b>${analysisInline(r.walkthrough.actual)}</p><h3>保留你的思路，修改这几行</h3>${analysisPatch(r.minimalPatch)}<h3>修改后怎样验证（模型建议，需实际运行）</h3>${list(r.verification)}<h3>对应教程原文与本次关联</h3>${r.reviews.map(x=>{const q=analysisQuote(x.quoteId);return q?`<blockquote>${esc(q.quote.text)}</blockquote><p>${analysisInline(x.explanation)}</p><button class="text-btn" data-reviewlesson="${q.module},${q.index},${esc(q.quote.id)}">${esc(q.lesson.title)} →</button>`:'';}).join('')||'<p>本次未选择直接相关的教程引用。</p>'}<h3>检查你是否真正理解</h3>${r.questions.map((x,i)=>`<p>${i+1}. ${analysisInline(x.question)}</p><details><summary>查看参考答案</summary><p>${analysisInline(x.answer)}</p></details>`).join('')}<details><summary>本次分析使用的完整代码快照</summary>${pre(saved.code)}</details><p class="muted">模型分析不自动改代码，也不计为通过。建议修改后再次运行检查点。</p></article>`;
}
function receiveAnalysis(type,payload){
 if(!analysisPending||payload.requestID!==analysisPending.requestID)return;
 if(type==='analysisStatus'){analysisPending.message=payload.message;if($('#ai-progress'))$('#ai-progress').textContent=payload.message;return;}
 const pending=analysisPending;analysisPending=null;
 if(type==='analysisResult'){
  if(payload.problemID!==pending.problemID||payload.code!==pending.code){toast('分析快照不匹配，未保存。');bindAnalysisControls();return;}
  state.aiAnalyses??={};state.aiAnalyses[payload.problemID]=payload;persist();flush();CRemedial.collect(payload);
  if(current?.id===payload.problemID)renderConsole();
  syncAnalysisAnnotations();
  analysisNotice('GPT-5.6-Sol 分析已完成',`${payload.problemID} · ${state.drafts[payload.problemID]?.code!==payload.code?'代码已修改；保留待复核标记，悬浮可看上次分析。':payload.report.issues.length?`已标注 ${payload.report.issues.length} 处问题；代码末尾可查看复杂度与整体复盘。`:'本次未发现需标记的问题；代码末尾仍可查看复杂度与整体复盘。'}`,{problemID:payload.problemID});
 }else{
  analysisNotice('模型分析未完成',payload.message+' 已有分析与代码仍然保留。',{retry:true});
 }
 bindAnalysisControls();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideAnalysisHover();});
window.addEventListener('resize',hideAnalysisHover);
window.CAnalysis={sync:syncAnalysisAnnotations,hide:hideAnalysisHover,start:startDetailedAnalysis,receive:receiveAnalysis,show:showAnalysisReport,get pending(){return analysisPending;}};
