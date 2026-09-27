'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx={window:{},state:{annotations:[]},persist(){}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../Resources/annotations.js'),'utf8'),ctx);const A=ctx.window.CAnnotations,tests=[];
function test(name,fn){try{fn();tests.push({name,ok:true});}catch(e){tests.push({name,ok:false,error:e.message});}}
const a={quote:'getchar()',start:6,end:15,prefix:'请使用变量 ',suffix:' 保存输入'};
test('exact-anchor',()=>assert.equal(A.locate('请使用变量 getchar() 保存输入',a).start,6));
test('safe-shift-after-inserted-text',()=>assert.equal(A.locate('新增说明。请使用变量 getchar() 保存输入',a).start,11));
test('changed-quote-does-not-highlight-wrong-text',()=>assert.equal(A.locate('请使用变量 scanf() 保存输入',a),null));
test('ambiguous-repeated-context-is-not-guessed',()=>assert.equal(A.locate('X请使用变量 getchar() 保存输入 请使用变量 getchar() 保存输入',{...a,start:100,end:109}),null));
test('context-distinguishes-repeated-quote',()=>assert.equal(A.locate('getchar()。请使用变量 getchar() 保存输入',{...a,start:100,end:109}).start,16));
test('empty-quote-is-rejected',()=>assert.equal(A.locate('abc',{quote:'',start:1,end:1}),null));
test('late-answer-cannot-create-phantom-record',()=>{assert.equal(A.receive({annotationID:'absent',answer:'text'}),false);assert.equal(ctx.state.annotations.length,0);});
console.log(`${tests.filter(x=>x.ok).length}/${tests.length} text anchor checks passed`);for(const t of tests.filter(x=>!x.ok))console.error(t);fs.writeFileSync(path.join(__dirname,'reports/v5-annotation-anchors.json'),JSON.stringify(tests,null,2));if(tests.some(x=>!x.ok))process.exitCode=1;
