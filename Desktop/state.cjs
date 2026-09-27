'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
function validateState(s){
 if(!s||typeof s!=='object'||Array.isArray(s))throw Error('备份不是有效的学习记录。');
 for(const k of ['drafts','progress','reviews'])if(s[k]!==undefined&&(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k])))throw Error('备份字段无效：'+k);
 for(const k of ['history','favorites','studyArchives','annotations','remedialExercises','remedialJobs'])if(s[k]!==undefined&&!Array.isArray(s[k]))throw Error('备份字段无效：'+k);
 if(!s.drafts||!s.progress||!Array.isArray(s.history))throw Error('备份缺少草稿、进度或历史记录。');
 if(Buffer.byteLength(JSON.stringify(s))>134217728)throw Error('学习记录超过128MB，请先整理照片存档。');return s;
}
class StateStore{
 constructor(dir){this.dir=dir;this.file=path.join(dir,'state.json');this.queue=Promise.resolve();}
 async load(){try{return JSON.parse(await fs.readFile(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw Error('学习记录无法读取，已保留原文件；请从备份恢复。');}}
 save(value){const text=JSON.stringify(validateState(value),null,2);this.queue=this.queue.catch(()=>{}).then(async()=>{await fs.mkdir(this.dir,{recursive:true});await fs.writeFile(this.file+'.tmp',text,{mode:0o600});await fs.rename(this.file+'.tmp',this.file);});return this.queue;}
}
module.exports={StateStore,validateState};
