const {spawnSync}=require('node:child_process');const fs=require('node:fs');
fs.mkdirSync('tests/reports',{recursive:true});
for(const name of ['annotations.test.cjs','analysis.test.cjs','collections.test.cjs','diagnostics.test.cjs','learning.test.cjs','review-regressions.cjs','v5-study-ui.cjs']){const r=spawnSync(process.execPath,['tests/'+name],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
