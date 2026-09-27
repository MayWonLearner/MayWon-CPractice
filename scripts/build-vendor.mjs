// Run: cd Vendor && npm ci && cd .. && node scripts/build-vendor.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modules=path.join(root,'Vendor/node_modules');
const vendor=path.join(root,'Resources/vendor');
await fs.mkdir(vendor,{recursive:true});
for(const [from,to] of [
 ['marked/lib/marked.umd.js','marked.js'],
 ['dompurify/dist/purify.min.js','purify.js'],
 ['katex/dist/katex.min.js','katex.js'],
 ['katex/dist/katex.min.css','katex.css'],
 ['katex/dist/contrib/auto-render.min.js','auto-render.js']
]) await fs.copyFile(path.join(modules,from),path.join(vendor,to));
await fs.cp(path.join(modules,'katex/dist/fonts'),path.join(vendor,'fonts'),{recursive:true});
await fs.mkdir(path.join(root,'ThirdParty'),{recursive:true});
for(const [from,to] of [['marked/LICENSE','Marked-LICENSE.txt'],['dompurify/LICENSE','DOMPurify-LICENSE.txt'],['katex/LICENSE','KaTeX-LICENSE.txt']])
 await fs.copyFile(path.join(modules,from),path.join(root,'ThirdParty',to));
console.log('Copied pinned Markdown, HTML sanitizer, LaTeX assets and licenses.');
