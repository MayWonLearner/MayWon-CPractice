'use strict';
// Text anchors are independent of HTML markup; ambiguous or changed quotations are never guessed.
window.CAnnotations=(()=>{
 const views=new Map(),pending=new Set();
 const records=()=>{if(!Array.isArray(state.annotations))state.annotations=[];return state.annotations;};
 const uid=()=>globalThis.crypto?.randomUUID?.()??`note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 function textNodes(root){const out=[],walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=walk.nextNode()))if(!n.parentElement.closest('button,input,textarea,select,script,style,.katex,math,svg,[data-no-annotate]'))out.push(n);return out;}
 function source(root){let offset=0;const nodes=textNodes(root).map(node=>{const start=offset;offset+=node.data.length;return {node,start,end:offset};});return {nodes,text:nodes.map(n=>n.node.data).join('')};}
 function locate(text,a){
  if(!a.quote)return null;
  if(text.slice(a.start,a.end)===a.quote&&(!a.prefix||text.slice(Math.max(0,a.start-a.prefix.length),a.start)===a.prefix)&&(!a.suffix||text.slice(a.end,a.end+a.suffix.length)===a.suffix))return {start:a.start,end:a.end};
  const matches=[];let start=text.indexOf(a.quote);while(start!==-1){const end=start+a.quote.length;if((!a.prefix||text.slice(Math.max(0,start-a.prefix.length),start)===a.prefix)&&(!a.suffix||text.slice(end,end+a.suffix.length)===a.suffix))matches.push({start,end});start=text.indexOf(a.quote,start+1);}
  return matches.length===1?matches[0]:null;
 }
 function anchorSelection(root,selection){
  if(!selection||selection.rangeCount!==1||selection.isCollapsed)return null;
  const range=selection.getRangeAt(0);if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return null;
  if(range.commonAncestorContainer.nodeType===1&&range.commonAncestorContainer.closest?.('[data-no-annotate]'))return null;
  const src=source(root);let start,end;
  // A browser selection may have element boundaries (Select All), so use DOM ranges for comparison.
  for(const part of src.nodes){if(!range.intersectsNode(part.node))continue;
   if(start===undefined)start=part.start+(range.startContainer===part.node?range.startOffset:0);
   end=part.start+(range.endContainer===part.node?range.endOffset:part.node.length);
  }
  if(start===undefined||end<=start)return null;
  const quote=src.text.slice(start,end);if(!quote.trim())return null;
  return {quote,start,end,prefix:src.text.slice(Math.max(0,start-32),start),suffix:src.text.slice(end,end+32)};
 }
 function unwrap(content){content.querySelectorAll('mark[data-annotation-id]').forEach(mark=>mark.replaceWith(...mark.childNodes));content.normalize();}
 function decorate(view){
  unwrap(view.content);const src=source(view.content),entries=records().filter(a=>a.docID===view.docID);view.unmatched=[];
  // Split each text node only once, also supporting overlapping highlights without nested markup.
  const spans=entries.map(a=>{const pos=locate(src.text,a);if(!pos)view.unmatched.push(a.id);return pos&&{...pos,a};}).filter(Boolean);
  for(const part of src.nodes){const here=spans.filter(s=>s.start<part.end&&s.end>part.start);if(!here.length)continue;const points=[0,part.node.length,...here.flatMap(s=>[Math.max(0,s.start-part.start),Math.min(part.node.length,s.end-part.start)])].sort((a,b)=>a-b);const fragment=document.createDocumentFragment();
   [...new Set(points)].forEach((from,i,all)=>{if(i===all.length-1)return;const to=all[i+1],active=here.filter(s=>s.start<part.start+to&&s.end>part.start+from),text=part.node.data.slice(from,to);if(!active.length){fragment.append(document.createTextNode(text));return;}const mark=document.createElement('mark');mark.dataset.annotationId=active.map(s=>s.a.id).join(' ');mark.className=active.some(s=>s.a.style==='highlight')?'annotation-highlight':'annotation-underline';mark.tabIndex=0;mark.setAttribute('role','button');mark.setAttribute('aria-label','查看这段文字的笔记或问答');mark.textContent=text;fragment.append(mark);});part.node.replaceWith(fragment);
  }
 }
 function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function button(label,action,cls='button quiet small'){const b=node('button',cls,label);b.type='button';b.onclick=action;return b;}
 function message(view,text){view.panel.replaceChildren(node('p','annotation-hint',text));}
 function safeAnswer(text){const body=node('div','annotation-answer');if(window.CStudy?.renderMarkdown)body.innerHTML=window.CStudy.renderMarkdown(String(text??''));else body.textContent=String(text??'');window.CStudy?.bindMarkdown?.(body);return body;}
 function quoteBox(text){return node('blockquote','annotation-quote',text);}
 function renderIndex(view){
  const entries=records().filter(a=>a.docID===view.docID);view.index.replaceChildren();
  const title=node('div','annotation-list-title',`本页标注 · ${entries.length}`);view.index.append(title);
  entries.forEach(a=>{const b=button(`${view.unmatched.includes(a.id)?'⚠ 原文已变化 · ':''}${a.note?'✎ ':a.replies?.length?'◈ ':'▰ '}${a.quote.slice(0,45)}`,()=>show(view,a),'annotation-list-item');b.title=a.quote;view.index.append(b);});
 }
 function refresh(docID){for(const view of views.values()){if(!view.root.isConnected){views.delete(view.root);continue;}if(view.docID!==docID)continue;decorate(view);renderIndex(view);if(view.activeID){const a=records().find(a=>a.id===view.activeID);if(a)show(view,a);}}}
 function placePanel(view,anchor){if(view.root.clientWidth>=620){if(view.rail.parentElement!==view.root)view.root.append(view.rail);return;}let block=anchor?.nodeType===3?anchor.parentElement:anchor;while(block&&block.parentElement!==view.content)block=block.parentElement;if(block&&block!==view.rail)view.content.insertBefore(view.rail,block.nextSibling);}
 function close(view){if(view.onAsk){view.rail.hidden=true;view.root.classList.add('annotation-idle');}view.activeID=null;view.selection=null;message(view,'选中正文，可高亮、划线、做笔记或向 GPT-5.6-Sol High 提问。点击已有标注可再次查看。');}
 function controls(view,title){view.rail.hidden=false;view.root.classList.remove('annotation-idle');view.panel.replaceChildren();const header=node('div','annotation-card-head');header.append(node('strong','',title),button('×',()=>close(view),'annotation-close'));header.lastChild.setAttribute('aria-label','关闭笔记小窗');view.panel.append(header);}
 function request(view,a,question){
  if(!question.trim())return;const payload={quote:a.quote,question:question.trim(),context:view.context,docID:view.docID,annotationID:a.id};
  if(view.onAsk){try{const result=view.onAsk(payload);result?.catch?.(error=>message(view,error.message??String(error)));close(view);}catch(error){message(view,error.message??String(error));}return;}
  if(!window.CStudy?.askSelection){message(view,'暂时无法连接问答服务，请先在“连接 Codex”页面完成设置。');return;}
  if(pending.has(a.id))return;
  a.replies??=[];a.replies.push({id:uid(),question:payload.question,answer:'',status:'pending',time:new Date().toISOString()});pending.add(a.id);persist();show(view,a);
  try{const result=window.CStudy.askSelection(payload);if(result?.then)result.then(answer=>{if(answer!==undefined)receive(typeof answer==='string'?{annotationID:a.id,answer}:{...answer,annotationID:a.id});}).catch(error=>receive({annotationID:a.id,error:error.message??String(error)}));}
  catch(error){receive({annotationID:a.id,error:error.message??String(error)});}
 }
 function askBox(view,a){const form=node('form','annotation-ask'),label=node('label','','向 GPT-5.6-Sol High 提问'),input=node('textarea');input.placeholder='例如：为什么这里用 int 保存 getchar()？';input.rows=3;input.setAttribute('aria-label','关于选中文字的问题');label.append(input);const send=button(pending.has(a.id)?'正在回答…':'发送问题',()=>{});send.type='submit';send.disabled=pending.has(a.id);form.append(label,send);if(pending.has(a.id))form.append(button('取消本次回答',()=>post('cancelStudy')));form.onsubmit=e=>{e.preventDefault();request(view,a,input.value);};view.panel.append(form);}
 function show(view,a){
  view.activeID=a.id;view.selection=null;const mark=[...view.content.querySelectorAll('mark[data-annotation-id]')].find(m=>m.dataset.annotationId.split(' ').includes(a.id));placePanel(view,mark);controls(view,'这段文字的笔记');const overlapping=[...new Set([...view.content.querySelectorAll('mark[data-annotation-id]')].filter(m=>m.dataset.annotationId.split(' ').includes(a.id)).flatMap(m=>m.dataset.annotationId.split(' ')))].map(id=>records().find(x=>x.id===id)).filter(Boolean);if(overlapping.length>1){const choices=node('div','annotation-actions');choices.append(node('small','','此处有重叠标注：'));overlapping.forEach((item,i)=>{const choice=button(`笔记 ${i+1}${item.id===a.id?'（当前）':''}`,()=>show(view,item));choice.title=item.note||item.quote;choices.append(choice);});view.panel.append(choices);}view.panel.append(quoteBox(a.quote));
  if(view.unmatched.includes(a.id))view.panel.append(node('p','annotation-warning','原文已变化或位置不唯一，未在正文强行标记。此处保留原摘录和笔记。'));
  const note=node('textarea','annotation-note');note.value=a.note??'';note.placeholder='写下你自己的理解…';note.rows=4;note.setAttribute('aria-label','我的批注笔记');note.oninput=()=>{a.note=note.value;a.updatedAt=new Date().toISOString();persist();renderIndex(view);};view.panel.append(note);
  const actions=node('div','annotation-actions');actions.append(button('保存笔记',()=>{a.note=note.value;a.updatedAt=new Date().toISOString();persist();renderIndex(view);note.setAttribute('aria-label','我的批注笔记，已保存');}),button(a.style==='highlight'?'改为划线':'改为高亮',()=>{a.style=a.style==='highlight'?'underline':'highlight';persist();refresh(view.docID);}),button('删除标注',()=>{state.annotations=records().filter(x=>x.id!==a.id);view.activeID=null;persist();refresh(view.docID);close(view);}));view.panel.append(actions);
  for(const reply of a.replies??[]){const turn=node('section','annotation-turn');turn.append(node('div','annotation-question',reply.question));if(reply.status==='pending')turn.append(node('p','annotation-hint',pending.has(a.id)?'GPT-5.6-Sol High 正在回答…':'上次回答中断，请重新提问。'));else if(reply.status==='error')turn.append(node('p','annotation-warning',reply.error));else turn.append(safeAnswer(reply.answer));view.panel.append(turn);}
  askBox(view,a);
 }
 function saveSelection(view,style){if(!view.selection)return null;const a={id:uid(),docID:view.docID,...view.selection,style,note:'',replies:[],createdAt:new Date().toISOString()};records().push(a);persist();window.getSelection()?.removeAllRanges();view.activeID=a.id;refresh(view.docID);return a;}
 function selectionTools(view){controls(view,'选中文字');view.panel.append(quoteBox(view.selection.quote));const actions=node('div','annotation-actions');actions.append(button('高亮',()=>saveSelection(view,'highlight')),button('划线',()=>saveSelection(view,'underline')),button('添加笔记',()=>{saveSelection(view,'underline');view.panel.querySelector('.annotation-note')?.focus();}));view.panel.append(actions);
  const form=node('form','annotation-ask'),input=node('textarea');input.rows=3;input.placeholder='针对这段内容提问…';input.setAttribute('aria-label','针对选中文字提问');const send=button('提问 · GPT-5.6-Sol High',()=>{});send.type='submit';form.append(input,send);form.onsubmit=e=>{e.preventDefault();const question=input.value.trim();if(!question){input.focus();return;}const a=saveSelection(view,'underline');if(a)request(view,a,question);};view.panel.append(form);
 }
 function mount(root,{docID,context='',onAsk}={}){
  if(!root||!docID)return null;if(views.has(root)){const v=views.get(root);decorate(v);renderIndex(v);return v;}
  for(const [old] of views)if(!old.isConnected)views.delete(old);
  const content=node('div','annotation-content');content.append(...root.childNodes);const rail=node('aside','annotation-rail');rail.setAttribute('aria-label','笔记与选段问答');rail.dataset.noAnnotate='true';const sticky=node('div','annotation-sticky'),panel=node('div','annotation-panel'),index=node('div','annotation-index');sticky.append(panel,index);rail.append(sticky);root.classList.add('annotated-document');root.append(content,rail);
  const view={root,content,rail,panel,index,docID,context,onAsk,selection:null,activeID:null,unmatched:[]};views.set(root,view);decorate(view);renderIndex(view);close(view);
  const selected=()=>{const a=anchorSelection(content,window.getSelection());if(a){view.selection=a;view.activeID=null;placePanel(view,window.getSelection().getRangeAt(0).endContainer);selectionTools(view);}};content.addEventListener('mouseup',()=>queueMicrotask(selected));content.addEventListener('keyup',e=>{if(e.key==='Shift')selected();});
  content.addEventListener('click',e=>{if(!window.getSelection()?.isCollapsed)return;const mark=e.target.closest('mark[data-annotation-id]');if(!mark)return;const a=records().find(a=>a.id===mark.dataset.annotationId.split(' ')[0]);if(a)show(view,a);});content.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('mark[data-annotation-id]')){e.preventDefault();const a=records().find(a=>a.id===e.target.dataset.annotationId.split(' ')[0]);if(a)show(view,a);}});return view;
 }
 function receive({annotationID,answer,error}={}){const a=records().find(a=>a.id===annotationID);if(!a)return false;const reply=[...(a.replies??[])].reverse().find(r=>r.status==='pending');if(!reply)return false;pending.delete(a.id);Object.assign(reply,error?{status:'error',error:String(error)}:{status:'complete',answer:String(answer??'')});persist();refresh(a.docID);return true;}
 return {mount,receive,refresh,locate,anchorSelection};
})();
