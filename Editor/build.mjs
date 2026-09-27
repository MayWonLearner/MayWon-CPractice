import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
await build({entryPoints:[path.join(root,'Editor/editor.js')],outfile:path.join(root,'Resources/editor.bundle.js'),bundle:true,minify:true,format:'iife',loader:{'.ttf':'dataurl'},plugins:[{name:'worker',setup(b){b.onResolve({filter:/editor\.worker\.js$/},async args=>({path:requireResolve(args.path,args.resolveDir),namespace:'worker-string'}));b.onLoad({filter:/.*/,namespace:'worker-string'},async args=>{const r=await build({entryPoints:[args.path],bundle:true,write:false,minify:true,format:'iife'});return {contents:'export default '+JSON.stringify(r.outputFiles[0].text),loader:'js'};});}}]});
function requireResolve(p,dir){return import.meta.resolve(p).replace('file://','');}
