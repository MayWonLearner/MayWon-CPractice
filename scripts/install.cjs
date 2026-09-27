#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
async function main(){
 const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),platform=process.platform;
 const source=platform==='darwin'?path.join(dist,process.arch==='arm64'?'mac-arm64':'mac','CPractice.app'):platform==='win32'?path.join(dist,process.arch==='arm64'?'win-arm64-unpacked':'win-unpacked'):path.join(dist,process.arch==='arm64'?'linux-arm64-unpacked':'linux-unpacked');
 const dest=platform==='darwin'?path.join(os.homedir(),'Applications/CPractice.app'):platform==='win32'?path.join(process.env.LOCALAPPDATA,'Programs/CPractice'):path.join(os.homedir(),'.local/opt/cpractice');
 try{await fs.access(source);}catch{throw Error('未找到当前系统构建产物，请先运行 npm run pack。');}
 await fs.mkdir(path.dirname(dest),{recursive:true});const staging=dest+'.installing-'+process.pid;
 await fs.cp(source,staging,{recursive:true});
 try{await fs.access(dest);await fs.rename(dest,dest+'.previous-'+Date.now());}catch(e){if(e.code!=='ENOENT')throw Error('请先退出旧版应用再安装：'+e.message);}
 await fs.rename(staging,dest);
 if(platform==='win32'){
  const script='$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath("Desktop"),"CPractice.lnk")); $s.TargetPath=[IO.Path]::Combine($env:CPRACTICE_INSTALL_DIR,"CPractice.exe"); $s.WorkingDirectory=$env:CPRACTICE_INSTALL_DIR; $s.Save()';
  spawnSync('powershell.exe',['-NoProfile','-Command',script],{env:{...process.env,CPRACTICE_INSTALL_DIR:dest},stdio:'inherit'});
 }else if(platform==='linux'){
  const apps=path.join(os.homedir(),'.local/share/applications');await fs.mkdir(apps,{recursive:true});
  const escape=s=>s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('`','\\`').replaceAll('$','\\$');
  await fs.writeFile(path.join(apps,'cpractice.desktop'),`[Desktop Entry]\nType=Application\nName=CPractice\nComment=C language learning studio\nExec="${escape(path.join(dest,'cpractice'))}"\nIcon=${path.join(dest,'resources/learning/AppIcon.png')}\nTerminal=false\nCategories=Education;Development;\n`);
 }
 console.log('安装完成：'+dest+'\n学习记录保存在独立的数据目录中。旧安装若存在，已保留为 .previous 备份。');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
