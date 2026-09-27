const {compiler,findTool}=require('../Desktop/platform.cjs');
console.log('CPractice 环境检测:',process.platform,process.arch,'Node',process.version);
let missing=false;try{const cc=compiler();console.log('C17 编译器:',cc.file);}catch(e){console.log(e.message);missing=true;}
for(const name of ['clangd','clang-format','codex','code'])console.log(name+':',findTool(name)||'未安装（可选，参见 README）');
console.log('教程/题库可离线；Codex 只用于主动请求的 AI 功能。');if(missing)process.exitCode=1;
