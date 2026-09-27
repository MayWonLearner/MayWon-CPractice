'use strict';
const DIAGNOSTIC_RULES=[
 [/array type .* is not assignable|assignment to expression with array type/,'array-assignment'],
 [/read-only variable|const-qualified|read-only location/,'readonly'],
 [/expression is not assignable|lvalue required|cannot assign to.*rvalue/,'not-assignable'],
 [/expected ';'/,'semicolon'],[/expected '\}'/,'brace'],[/expected '\)'/,'parenthesis'],
 [/expected expression/,'expression'],[/expected identifier/,'identifier'],
 [/undeclared identifier/,'scope'],[/undeclared function|implicit declaration of function/,'prototype'],
 [/incompatible.*pointer|incompatible integer to pointer|incompatible pointer to integer/,'pointer'],
 [/format specifies type|format .* expects|more '%' conversions/,'format'],[/data argument not used by format/,'extra-format'],
 [/uninitialized/,'uninitialized'],[/unused variable|unused parameter/,'unused'],[/redefinition/,'redefinition'],
 [/array index|out of bounds/,'array'],[/too few arguments|too many arguments/,'argument'],
 [/non-void function does not return|control reaches end/,'return'],[/division by zero|remainder by zero/,'division-by-zero'],
 [/file not found/,'header'],[/Undefined symbols|undefined reference|linker command failed/,'linker'],
 [/no member named/,'struct'],[/assignment.*condition|using the result of an assignment/,'condition'],
 [/comparison of integers of different signs/,'conversion'],[/missing terminating/,'string'],
 [/indirection requires pointer|invalid type argument of unary/,'dereference']
];
const diagnosticGuides=window.DIAGNOSTIC_GUIDES;
// The quote shown on a diagnostic is also present, word for word, at this tutorial anchor.
for(const [key,g] of Object.entries(diagnosticGuides)){
 const lesson=tutorials.flatMap(t=>t.lessons).find(l=>l.id===g.lesson);
 if(!lesson)throw Error('Missing diagnostic lesson: '+g.lesson);
 lesson.reviewQuotes??=[];
 const id=g.lesson+'-diagnostic-'+key;
 if(!lesson.reviewQuotes.some(q=>q.id===id))lesson.reviewQuotes.push({id,text:g.quote,section:g.title,keys:['diagnostic-'+key]});
}
function translateDiagnostic(message){
 const key=DIAGNOSTIC_RULES.find(([re])=>re.test(message))?.[1]??'unknown',g=diagnosticGuides[key];
 const module=+g.lesson.slice(1,3),index=tutorials[module-1].lessons.findIndex(l=>l.id===g.lesson);
 return {message:g.title+'。'+g.plain,module,index,key};
}
function reviewLink(module,index=0,key){
 if(!key||key==='unknown')return null;
 const guide=diagnosticGuides[key];
 const choices=tutorials.flatMap(t=>t.lessons.flatMap((l,i)=>(l.reviewQuotes??[]).filter(q=>q.keys?.includes(guide?'diagnostic-'+key:key)).map(q=>({t,l,i,q}))));
 const match=choices.find(x=>x.t.module===module)||choices[0];
 return match?{module:match.t.module,index:match.i,title:match.l.title,anchor:match.q.id,text:match.q.text}:null;
}
function diagnosticItems(entry){
 const r=entry.result,items=[];
 for(const line of (r.diagnostics??'').split('\n')){
  const match=line.match(/main\.c:(\d+):(\d+):\s*(?:fatal )?(error|warning):\s*(.*)/);
  if(match)items.push({...translateDiagnostic(match[4]),line:+match[1],col:+match[2],raw:match[4],severity:match[3]});
 }
 if(!items.length&&r.diagnostics&&r.status==='compile_error')items.push({...translateDiagnostic(r.diagnostics),raw:r.diagnostics,severity:'error'});
 const bad=r.checks?.find(c=>!['passed','ran'].includes(c.status));
 if(bad){const key=bad.status==='timeout'?'timeout':bad.status==='runtime_error'?'runtime':bad.status==='wrong_answer'?'wrong-answer':'unknown';items.push({key,raw:bad.stderr||bad.fileMessage||bad.name,check:bad});}
 return items;
}
function sourceContext(code,line){
 if(!line||typeof code!=='string')return '';
 const lines=code.split('\n');return lines.slice(Math.max(0,line-2),line+1).map((s,i)=>`${Math.max(1,line-1)+i} | ${s}`).join('\n');
}
function conditionalAssignmentContext(item,code){
 const line=(code??'').split('\n')[item.line-1]??'';
 if(item.key!=='not-assignable')return '';
 // Only explain the specific unparenthesized pattern actually visible on the reported line.
 const m=line.match(/^\s*([A-Za-z_]\w*)\s*>=\s*([A-Za-z_]\w*)\s*\?\s*\1\s*\+=\s*0\s*:\s*\1\s*=\s*\2\s*,\s*([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*;\s*$/);
 if(m){const[,best,sum,start,i]=m;return `这里把 ?:、+=、=、逗号放在了一行。你想让冒号后执行 ${best}=${sum}，但没有括号保护，Clang 在 ${best}>=${sum}?${best}+=0:${best} 这个条件表达式后遇到 =，于是试图给它的结果赋值并拒绝编译。严格地说原句不是合法的 C 赋值语法；这里解释的是编译器报错的分组线索。即便仅给 ${best}=${sum} 加括号，后面的逗号仍会使 ${start}=${i} 无条件执行。应把两次更新放进同一个 if (${sum} > ${best}) 块。`;}
 return line.includes('?')&&line.includes(':')?'本行含有三目运算符。请先核对冒号后是否直接混入未加括号的赋值；仅凭这一行的字符不能确定全部语法归属，应结合原始箭头检查。':'';
}
function outputDifference(check){
 if(!check||check.status!=='wrong_answer')return '';
 const a=(check.actual??'').trim().split(/\s+/).filter(Boolean),e=(check.expected??'').trim().split(/\s+/).filter(Boolean);
 const n=Math.max(a.length,e.length);let i=0;while(i<n&&a[i]===e[i])i++;
 return i<n?`按空白分隔后，第 ${i+1} 项首先不同：期望 ${JSON.stringify(e[i]??'（缺少此项）')}，实际 ${JSON.stringify(a[i]??'（缺少此项）')}。这能定位输出差异，但尚不能确定代码根因。`:'标准输出按空白分隔未发现差异；继续查看文件输出或检查点的具体诊断。';
}
function diagnosticCards(entry,expanded=false){
 const items=diagnosticItems(entry),stale=!!current&&entry.problemID===current.id&&entry.code!==codeFor(current);
 const popup=items.length&&!expanded?`<button class="button quiet small" data-diag-review="${esc(entry.problemID)}">在大窗中阅读本次复盘 ↗</button>`:'';
 return popup+items.slice(0,6).map((item,i)=>{
  const g=diagnosticGuides[item.key],link=reviewLink(+g.lesson.slice(1,3),0,item.key),context=sourceContext(entry.code,item.line),specific=conditionalAssignmentContext(item,entry.code),diff=outputDifference(item.check);
  return `<article class="chinese-diagnostic"><div class="diagnosis-title"><strong>${item.severity==='warning'?'编译警告':'规则提示（非模型分析）'}${item.line?' · 第 '+item.line+' 行，第 '+item.col+' 列':''} · ${esc(g.title)}</strong>${item.line&&!stale?`<button class="text-btn" data-diagline="${item.line}" data-diagcol="${item.col}">定位代码 ↗</button>`:''}</div>${stale?'<p>代码已修改：以下分析对应上次运行的代码快照，请重新运行确认新结果。</p>':''}${context?`<pre class="diagnostic-source">${esc(context)}</pre>`:''}<p><b>小白解释：</b>${esc(g.plain)}</p>${specific?`<p><b>这行代码为什么报错：</b>${esc(specific)}</p>`:''}${diff?`<p><b>本次可确认的差异：</b>${esc(diff)}</p>`:''}<details><summary>展开原因、修改步骤和验证方法</summary><p><b>专业解释：</b>${esc(g.mechanism)}</p><h4>怎样修改与排查</h4><ol>${g.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><h4>写法示例（需结合你的变量和题意）</h4><pre>${esc(g.example)}</pre><p><b>改完怎样验证：</b>${esc(g.verify)}</p>${link?`<h4>对应教程原文</h4><blockquote>${esc(link.text)}</blockquote><p>这段引用对应本类问题的规则；不是仅按题目所在章节推荐。</p><button class="text-btn" data-reviewlesson="${link.module},${link.index},${esc(link.anchor)}">复习引用 · 第 ${link.module} 章 / ${esc(link.title)} →</button>`:'<p>尚未找到能可靠解释该诊断的教程引用；这里不推荐可能无关的知识点。</p>'}</details><details><summary>原始诊断 / 检查点信息</summary><pre>${esc(item.raw)}</pre></details></article>`;
 }).join('')+(items.length>6?`<p class="muted">共 ${items.length} 条诊断，先展示前 6 条。建议先修最早的错误，再重新编译；完整信息见编译器输出。</p>`:'');
}
function bindDiagnosticLinks(){
 $$('[data-diag-review]').forEach(b=>b.onclick=()=>{const entry=lastResults[b.dataset.diagReview];if(entry)showModal('本次错误复盘',diagnosticCards(entry,true),bindDiagnosticLinks);});
 $$('[data-diagline]').forEach(b=>b.onclick=()=>{$('#modal')?.close();jumpTo(+b.dataset.diagline,+b.dataset.diagcol);});
 $$('[data-reviewlesson]').forEach(b=>b.onclick=()=>{const[m,i,anchor]=b.dataset.reviewlesson.split(',');$('#modal')?.close();openTutorial(+m,+i);requestAnimationFrame(()=>{const el=document.getElementById(anchor);el?.scrollIntoView({block:'center'});el?.classList.add('review-highlight');});});
}
window.CDiagnostics={translate:translateDiagnostic,reviewLink,items:diagnosticItems,cards:diagnosticCards};
