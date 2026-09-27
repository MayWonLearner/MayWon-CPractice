'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['ready','save','run','judge','stop','language','analyze','cancelAnalysis','studyAsk','cancelStudy','remedialGenerate','cancelRemedial','codexStatus','codexLogin','cancelCodexLogin','import','export','backup','restoreBackup','openURL','openVSCode','openFlowchart','reloadVSCode','runtimeStatus']);
contextBridge.exposeInMainWorld('cpracticeDesktop',{
 platform:process.platform,
 post(body){if(body&&allowed.has(body.action))ipcRenderer.send('cpractice:action',body);},
 subscribe(callback){ipcRenderer.on('cpractice:message',(_event,message)=>callback(message));},
 onClosing(callback){ipcRenderer.on('cpractice:closing',()=>{callback();ipcRenderer.send('cpractice:flushed');});}
});
