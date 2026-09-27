'use strict';
const path=require('node:path'),fs=require('node:fs'),{launch}=require('./smoke-launcher.cjs');
const root=path.resolve(__dirname,'..');
const executable=process.platform==='darwin'?`dist/${process.arch==='arm64'?'mac-arm64':'mac'}/CPractice.app/Contents/MacOS/CPractice`:process.platform==='win32'?'dist/win-unpacked/CPractice.exe':'dist/linux-unpacked/cpractice';
const report=path.join(root,'tests/reports/packaged-smoke.json');
const resources=process.platform==='darwin'?path.resolve(root,executable,'../../Resources'):path.join(root,path.dirname(executable),'resources');
for(const name of ['Electron-LICENSE.txt','Ajv-LICENSE.txt','LICENSES.chromium.html'])if(!fs.existsSync(path.join(resources,'ThirdParty',name)))throw Error('Missing packaged notice: '+name);
launch(path.join(root,executable),['--smoke-test'],report);
console.log('Packaged application resources, editor and C judge verified.');
