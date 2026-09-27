'use strict';
if(window.cpracticeDesktop){
 window.webkit={messageHandlers:{native:{postMessage:body=>window.cpracticeDesktop.post(body)}}};
 window.cpracticeDesktop.subscribe(message=>window.receiveNative?.(message));
 window.cpracticeDesktop.onClosing(()=>window.CPracticeTest&&window.webkit.messageHandlers.native.postMessage({action:'save',state:window.CPracticeTest.snapshot()}));
 document.documentElement.dataset.platform=window.cpracticeDesktop.platform;
}
window.CPlatform={isMac:(window.cpracticeDesktop?.platform??(/Mac/.test(navigator.platform)?'darwin':'other'))==='darwin',desktop:!!window.cpracticeDesktop};
window.addEventListener('DOMContentLoaded',()=>{
 if(!window.CPlatform.isMac){
  function adapt(root){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(!node.parentElement.closest('pre,code,script,style,.monaco-editor,textarea')){const next=node.data.replaceAll('⌘','Ctrl').replaceAll('⇧','Shift').replaceAll('Apple Clang','GCC / Clang');if(next!==node.data)node.data=next;}}
  adapt(document.body);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)adapt(node);}).observe(document.body,{childList:true,subtree:true});
 }
});
