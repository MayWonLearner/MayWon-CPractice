import * as monaco from 'monaco-editor/editor/editor.api.js';
import { DefaultLinesDiffComputer } from 'monaco-editor/editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.js';
import './contributions.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js';
import workerSource from 'monaco-editor/editor/editor.worker.js';

window.MonacoEnvironment = {getWorker(){return new Worker(URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'})));}};
monaco.languages.register({id:'c17',extensions:['.c','.h']});
monaco.languages.setLanguageConfiguration('c17',{
 comments:{lineComment:'//',blockComment:['/*','*/']},brackets:[['{','}'],['[',']'],['(',')']],
 autoClosingPairs:[{open:'{',close:'}'},{open:'[',close:']'},{open:'(',close:')'},{open:'"',close:'"',notIn:['string']},{open:"'",close:"'",notIn:['string','comment']}],
 surroundingPairs:[{open:'{',close:'}'},{open:'[',close:']'},{open:'(',close:')'},{open:'"',close:'"'},{open:"'",close:"'"}],
 indentationRules:{increaseIndentPattern:/^((?!\/\/).)*\{[^}"']*$/,decreaseIndentPattern:/^\s*\}/},
 onEnterRules:[{beforeText:/^\s*.*\{\s*$/,afterText:/^\s*\}/,action:{indentAction:monaco.languages.IndentAction.IndentOutdent}},{beforeText:/^\s*(if|for|while)\s*\(.*\)\s*$/,action:{indentAction:monaco.languages.IndentAction.Indent}}]
});
monaco.languages.setMonarchTokensProvider('c17',{
 keywords:['if','else','for','while','do','switch','case','default','break','continue','return','goto'],
 types:['int','char','long','short','float','double','void','unsigned','signed','_Bool','size_t','FILE','bool'],
 modifiers:['const','static','extern','volatile','restrict','auto','register','typedef','struct','union','enum','sizeof','inline','_Alignof','_Atomic','_Static_assert'],
 tokenizer:{root:[[/\/\*/, 'comment','@comment'],[/\/\/.*$/,'comment'],[/^\s*#\s*\w+/,'preprocessor'],[/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[uUlLfF]*\b/,'number'],[/"/,'string','@string'],[/'(?:\\.|[^'\\])'/,'string'],[/[a-zA-Z_]\w*/,{cases:{'@keywords':'keyword.control','@types':'type','@modifiers':'keyword','@default':'identifier'}}],[/[{}()[\]]/,'@brackets'],[/[;,.]/,'delimiter'],[/[+\-*\/%=<>!&|^~?:]+/,'operator']],comment:[[/[^*]+/,'comment'],[/\*\//,'comment','@pop'],[/\*/,'comment']],string:[[/[^\\"%]+/,'string'],[/%[-+ #0]*\d*(?:\.\d+)?(?:hh|ll|[hlLjzt])?[diuoxXfFeEgGaAcspn%]/,'string.format'],[/\\./,'string.escape'],[/"/,'string','@pop'],[/%/,'string']]}
});
monaco.editor.defineTheme('cpractice',{base:'vs-dark',inherit:true,rules:[{token:'type',foreground:'73CBE7'},{token:'keyword.control',foreground:'D4A5F5'},{token:'keyword',foreground:'8AB4F8'},{token:'string',foreground:'B8D99A'},{token:'string.format',foreground:'FFCA80',fontStyle:'bold'},{token:'string.escape',foreground:'E99EA5'},{token:'number',foreground:'ECB38B'},{token:'comment',foreground:'778E81'},{token:'preprocessor',foreground:'93B8EE'}],colors:{'editor.background':'#12181f','editorLineNumber.foreground':'#506273','editorLineNumber.activeForeground':'#AADCB8','editor.selectionBackground':'#344E61','editor.lineHighlightBackground':'#1A242E','editorCursor.foreground':'#A4E8B5','editorIndentGuide.background1':'#263641'}});
let editor=null,model=null,element=null,pending=new Map(),seq=0,changeTimer=null,analysisData=null,analysisMarks=null,analysisZone=null,analysisNode=null,aiHoverActive=false;
const native=()=>!!window.webkit?.messageHandlers?.native;
function post(action,data){window.webkit?.messageHandlers?.native.postMessage({action,...data});}
function rpc(method,params={}){
 if(!native())return Promise.resolve(null);
 const requestID=++seq;
 return new Promise(resolve=>{const timeout=setTimeout(()=>{pending.delete(requestID);resolve(null)},5000);pending.set(requestID,{resolve,timeout});post('language',{requestID,method,params,code:model?.getValue()??'',version:model?.getVersionId()??0});});
}
function pos(p){return {line:p.lineNumber-1,character:p.column-1};}
function range(r){return r?{startLineNumber:r.start.line+1,startColumn:r.start.character+1,endLineNumber:r.end.line+1,endColumn:r.end.character+1}:undefined;}
function contents(c){if(!c)return [];return (Array.isArray(c)?c:[c]).map(x=>({value:typeof x==='string'?x:x.value??'',isTrusted:false}));}
monaco.languages.registerCompletionItemProvider('c17',{triggerCharacters:['.','>'],async provideCompletionItems(m,p){
 const result=await rpc('textDocument/completion',{position:pos(p)}),items=Array.isArray(result)?result:result?.items??[];
 const word=m.getWordUntilPosition(p),fallback=new monaco.Range(p.lineNumber,word.startColumn,p.lineNumber,word.endColumn);
 const mapped=items.map(x=>({label:x.label,kind:({1:18,2:0,3:1,4:2,5:3,6:4,7:5,8:7,9:8,10:9,11:12,12:13,13:15,14:17,15:27,16:19,17:20,18:21,19:16,20:14,21:6,22:10,23:11,24:24,25:25}[x.kind]??18),detail:x.detail,documentation:typeof x.documentation==='string'?x.documentation:x.documentation?.value,insertText:x.textEdit?.newText??x.insertText??x.label,insertTextRules:x.insertTextFormat===2?monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet:undefined,range:range(x.textEdit?.range)??fallback,sortText:x.sortText,filterText:x.filterText,additionalTextEdits:x.additionalTextEdits?.map(e=>({range:range(e.range),text:e.newText}))}));
 const snippets=[['for','for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${0}\n}','计数循环'],['if','if (${1:condition}) {\n    ${0}\n}','条件分支'],['main','#include <stdio.h>\n\nint main(void) {\n    ${0}\n    return 0;\n}','完整 C 程序'],['printf','printf("${1:%d}\\n", ${2:value});','格式化输出'],['scanf','if (scanf("${1:%d}", &${2:value}) != 1) {\n    return 1;\n}','检查输入是否成功']];
 return {suggestions:[...mapped,...snippets.map(([label,insertText,detail])=>({label,insertText,detail,kind:monaco.languages.CompletionItemKind.Snippet,insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,range:fallback}))]};
}});
monaco.languages.registerHoverProvider('c17',{async provideHover(m,p){const r=await rpc('textDocument/hover',{position:pos(p)});return r?{contents:contents(r.contents),range:range(r.range)}:null;}});
monaco.languages.registerDefinitionProvider('c17',{async provideDefinition(m,p){const r=await rpc('textDocument/definition',{position:pos(p)});return (Array.isArray(r)?r:r?[r]:[]).filter(x=>x.uri===window.CEditor.uri).map(x=>({uri:m.uri,range:range(x.range)}));}});
monaco.languages.registerReferenceProvider('c17',{async provideReferences(m,p){const r=await rpc('textDocument/references',{position:pos(p),context:{includeDeclaration:true}});return (r??[]).filter(x=>x.uri===window.CEditor.uri).map(x=>({uri:m.uri,range:range(x.range)}));}});
monaco.languages.registerDocumentSymbolProvider('c17',{async provideDocumentSymbols(){const r=await rpc('textDocument/documentSymbol');return (r??[]).map(x=>({name:x.name,detail:x.detail??'',kind:Math.max(0,(x.kind??1)-1),range:range(x.range??x.location?.range),selectionRange:range(x.selectionRange??x.range??x.location?.range),children:[]}));}});
monaco.languages.registerSignatureHelpProvider('c17',{signatureHelpTriggerCharacters:['(', ','],async provideSignatureHelp(m,p){const r=await rpc('textDocument/signatureHelp',{position:pos(p)});return r?{value:r,dispose(){}}:null;}});
monaco.languages.registerRenameProvider('c17',{async provideRenameEdits(m,p,newName){const r=await rpc('textDocument/rename',{position:pos(p),newName});return {edits:Object.entries(r?.changes??{}).filter(([uri])=>uri===window.CEditor.uri).flatMap(([,edits])=>edits.map(e=>({resource:m.uri,versionId:m.getVersionId(),textEdit:{range:range(e.range),text:e.newText}})))};}});
monaco.languages.registerDocumentFormattingEditProvider('c17',{async provideDocumentFormattingEdits(m){const text=await rpc('format');if(typeof text!=='string'&&window.CPracticeTest)window.CPracticeTest.notice?.('格式化服务不可用，请检查 Command Line Tools。');return typeof text==='string'?[{range:m.getFullModelRange(),text}]:[];}});
function clearAnalysis(){
 analysisData?.hide();analysisMarks?.clear();analysisMarks=null;
 if(analysisZone&&editor)editor.changeViewZones(accessor=>accessor.removeZone(analysisZone));
 analysisZone=null;analysisNode=null;analysisData=null;
 if(aiHoverActive){editor?.updateOptions({hover:{enabled:true}});aiHoverActive=false;}
}
function moveAnalysisFooter(){
 if(!analysisZone||!editor||!model)return;
 editor.changeViewZones(accessor=>{accessor.removeZone(analysisZone);analysisZone=accessor.addZone({afterLineNumber:model.getLineCount(),heightInPx:46,domNode:analysisNode,suppressMouseDown:false});});
}
window.CEditor={
 mount(el,id){this.dispose();element=el;const container=document.createElement('div');container.id='monaco-editor';container.addEventListener('dragover',ev=>{if(ev.dataTransfer?.types.includes('Files'))ev.preventDefault();},true);container.addEventListener('drop',ev=>{if(ev.dataTransfer?.files.length){ev.stopPropagation();el.ondrop?.(ev);}},true);el.closest('.editor-shell').appendChild(container);el.closest('.editor-shell').classList.add('monaco-mounted');model=monaco.editor.createModel(el.value,'c17',monaco.Uri.parse('inmemory://cpractice/'+id+'.c'));editor=monaco.editor.create(container,{model,theme:'cpractice',automaticLayout:true,fontFamily:'Menlo, monospace',fontSize:13,lineHeight:23,tabSize:4,insertSpaces:true,autoIndent:'full',formatOnPaste:true,autoClosingBrackets:'always',autoClosingQuotes:'always',bracketPairColorization:{enabled:true},guides:{indentation:true,bracketPairs:true},minimap:{enabled:false},scrollBeyondLastLine:false,wordWrap:'off',smoothScrolling:true,accessibilitySupport:'auto',padding:{top:12},fixedOverflowWidgets:true});
 editor.onDidChangeModelContent(()=>{element.value=model.getValue();window.CPracticeTest?.editorChanged();queueMicrotask(moveAnalysisFooter);clearTimeout(changeTimer);changeTimer=setTimeout(()=>rpc('sync'),400);});
 editor.onMouseMove(e=>{
 const line=e.target.position?.lineNumber;
 const issue=analysisData?.issues.some(x=>x.line===line);
 if(issue&&!e.event.browserEvent.buttons){
  if(!aiHoverActive){editor.updateOptions({hover:{enabled:false}});aiHoverActive=true;}
  const rect=editor.getDomNode().getBoundingClientRect(),visible=editor.getScrolledVisiblePosition({lineNumber:line,column:1});
  if(visible)analysisData.hoverIssue(line,{left:rect.left+editor.getLayoutInfo().contentLeft,top:rect.top+visible.top,bottom:rect.top+visible.top+visible.height});
 }else if(!analysisNode?.contains(e.target.element)){
  if(aiHoverActive){editor.updateOptions({hover:{enabled:true}});aiHoverActive=false;}
  analysisData?.leave();
 }
 });
 editor.onMouseLeave(()=>analysisData?.leave());
 editor.onDidScrollChange(()=>analysisData?.hide());
 editor.onDidChangeCursorPosition(e=>{const s=document.querySelector('#cursor-position');if(s)s.textContent=`Ln ${e.position.lineNumber}, Col ${e.position.column}`;});
 editor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.Enter,()=>window.CPracticeTest?.startRun('run'));editor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyMod.Shift|monaco.KeyCode.Enter,()=>window.CPracticeTest?.startRun('judge'));rpc('sync');
 },dispose(){clearAnalysis();clearTimeout(changeTimer);editor?.dispose();model?.dispose();editor=null;model=null;element=null;},
 mapAnalysisIssues(code,issues){
 if(!model||!model.getValue().trim())return [];
 const oldLines=code.split(/\r\n|\r|\n/),newLines=model.getLinesContent();
 const diff=new DefaultLinesDiffComputer().computeDiff(oldLines,newLines,{ignoreTrimWhitespace:false,maxComputationTimeMs:40,computeMoves:false});
 // Never guess a line when the diff could not finish. The full report remains in the footer.
 if(diff.hitTimeout)return [];
 return issues.flatMap(issue=>{
  let line=issue.line,offset=0;
  for(const change of diff.changes){
   const a=change.original,b=change.modified;
   if(line<a.startLineNumber)break;
   if(line<a.endLineNumberExclusive){
    const count=b.endLineNumberExclusive-b.startLineNumber;
    if(!count)return [];
    line=b.startLineNumber+Math.min(line-a.startLineNumber,count-1);offset=0;break;
   }
   offset=b.endLineNumberExclusive-a.endLineNumberExclusive;
  }
  line+=offset;
  return line>=1&&line<=newLines.length?[{...issue,originalLine:issue.line,line}]:[];
 });
 },
 setAnalysis(data){
 clearAnalysis();if(!editor||!model||!data)return;analysisData=data;
 analysisMarks=editor.createDecorationsCollection(data.issues.filter(x=>x.line>=1&&x.line<=model.getLineCount()).map(x=>({range:new monaco.Range(x.line,1,x.line,model.getLineMaxColumn(x.line)),options:{isWholeLine:true,className:data.stale?'ai-problem-line-pending':'ai-problem-line',linesDecorationsClassName:data.stale?'ai-problem-gutter-pending':'ai-problem-gutter',overviewRuler:{color:data.stale?'#b9a0e0':'#d87b96',position:monaco.editor.OverviewRulerLane.Left},stickiness:monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges}})));
 analysisNode=document.createElement('div');analysisNode.className='ai-end-zone'+(data.stale?' ai-end-stale':'');
 const button=document.createElement('button');button.className='ai-end-label';button.textContent=data.label;button.setAttribute('aria-label',data.label);analysisNode.appendChild(button);
 button.onmouseenter=()=>data.hoverSummary(button.getBoundingClientRect());button.onmouseleave=data.leave;
 button.onfocus=()=>data.hoverSummary(button.getBoundingClientRect(),true);button.onclick=()=>data.hoverSummary(button.getBoundingClientRect(),true);
 analysisNode.onmouseleave=data.leave;
 editor.changeViewZones(accessor=>{analysisZone=accessor.addZone({afterLineNumber:model.getLineCount(),heightInPx:46,domNode:analysisNode,suppressMouseDown:false});});
 },
 revealAnalysis(){if(!editor||!analysisNode)return;editor.setScrollTop(editor.getScrollHeight());requestAnimationFrame(()=>{if(analysisNode)analysisData?.hoverSummary(analysisNode.querySelector('button').getBoundingClientRect(),true);});},
 changed(el){if(model&&model.getValue()!==el.value){editor.executeEdits('app',[{range:model.getFullModelRange(),text:el.value}]);editor.pushUndoStop();}},
 font(size){editor?.updateOptions({fontSize:size});},find(){editor?.getAction('actions.find').run();},format(){editor?.getAction('editor.action.formatDocument').run();},command(){editor?.getAction('editor.action.quickCommand').run();},
 jump(lineNumber,column=1){editor?.setPosition({lineNumber,column});editor?.revealLineInCenter(lineNumber);editor?.focus();},
 receive(payload){if(payload.requestID){const item=pending.get(payload.requestID);if(item){clearTimeout(item.timeout);pending.delete(payload.requestID);item.resolve(payload.result??null);}}else if(payload.diagnostics&&model&&payload.version===model.getVersionId()){
 const translated=payload.diagnostics.map(d=>({...range(d.range),message:(window.CDiagnostics?.translate(d.message)?.message??'')+'\n'+d.message,severity:d.severity===1?monaco.MarkerSeverity.Error:monaco.MarkerSeverity.Warning,source:'Clangd',code:String(d.code??'')}));monaco.editor.setModelMarkers(model,'clangd',translated);
 }if(payload.uri)this.uri=payload.uri;},
 request:rpc,get instance(){return editor;},get model(){return model;},monaco
};
