'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),c=JSON.parse(fs.readFileSync(path.join(root,'Resources/curriculum.json')));
const context={window:{},tutorials:c.tutorials,current:null,codeFor:p=>p.code,esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))};
vm.createContext(context);for(const f of ['diagnostic-guides.js','diagnostics.js'])vm.runInContext(fs.readFileSync(path.join(root,'Resources',f),'utf8'),context);
const D=context.window.CDiagnostics,checks=[];
function test(name,fn){try{fn();checks.push({name,ok:true});}catch(e){checks.push({name,ok:false,error:e.message});}}
const messages={
 'array-assignment':"array type 'int[3]' is not assignable",readonly:"cannot assign to variable 'x' with const-qualified type 'const int'",'not-assignable':'expression is not assignable',semicolon:"expected ';' after expression",brace:"expected '}'",parenthesis:"expected ')'",expression:'expected expression',identifier:'expected identifier',scope:"use of undeclared identifier 'x'",prototype:"call to undeclared function 'foo'",pointer:'incompatible pointer types',format:"format specifies type 'int *' but the argument has type 'int'",'extra-format':'data argument not used by format string',uninitialized:"variable 'x' is uninitialized when used here",unused:"unused variable 'x'",redefinition:"redefinition of 'x'",array:'array index 4 is past the end of the array',argument:'too few arguments to function call',return:'non-void function does not return a value','division-by-zero':'division by zero is undefined',header:"'fake.h' file not found",linker:'Undefined symbols for architecture arm64',struct:"no member named 'foo'",condition:'using the result of an assignment as a condition',conversion:'comparison of integers of different signs',string:"missing terminating '"+'"'+"' character",dereference:"indirection requires pointer operand ('int' invalid)"};
for(const [key,msg]of Object.entries(messages))test('classify-'+key,()=>assert.equal(D.translate(msg).key,key));
for(const [key,g]of Object.entries(context.window.DIAGNOSTIC_GUIDES))test('guide-and-anchor-'+key,()=>{
 assert(g.plain.length>20&&g.mechanism.length>20&&g.steps.length>=2&&g.verify.length>20);
 const link=D.reviewLink(+g.lesson.slice(1,3),0,key);
 if(key==='unknown'){assert.equal(link,null);return;}
 const lesson=c.tutorials[link.module-1].lessons[link.index];assert.equal(lesson.id,g.lesson);assert(lesson.reviewQuotes.some(q=>q.id===link.anchor&&q.text===link.text));
});
const code='int main(void) {\n    max>=sumPower?max+=0:max=sumPower,istart=i;\n}';
const entry={problemID:'S001',code,result:{status:'compile_error',diagnostics:'main.c:2:33: error: expression is not assignable\n',checks:[]}};
test('specific-conditional-and-comma',()=>{const html=D.cards(entry);assert(html.includes('istart=i 无条件执行'));assert(html.includes('第 2 行，第 33 列'));assert(html.includes('对应教程原文'));assert(!html.includes('覆盖数组元素'));assert(html.includes('L02-3-diagnostic-not-assignable'));});
test('unknown-does-not-invent-quote',()=>{const html=D.cards({...entry,result:{status:'compile_error',diagnostics:'main.c:2:1: error: exotic diagnostic',checks:[]}});assert(!html.includes('data-reviewlesson'));assert(html.includes('尚未找到'));});
test('normal-lvalue-error-does-not-invent-ternary',()=>{const html=D.cards({...entry,code:'int x;\n(x+1)=3;'});assert(!html.includes('这行代码为什么报错'));});
test('edited-code-snapshot-not-current-location',()=>{context.current={id:'S001',code:'changed'};const html=D.cards(entry);assert(!html.includes('data-diagline'));assert(html.includes('上次运行的代码快照'));context.current=null;});
test('html-escaped-source-and-diagnostic',()=>{const html=D.cards({...entry,code:'\n<script>alert(1)</script>',result:{status:'compile_error',diagnostics:'main.c:2:1: error: <img src=x onerror=alert(1)>',checks:[]}});assert(!html.includes('<script>'));assert(!html.includes('<img'));});
test('first-different-output-token',()=>{const html=D.cards({code:'',result:{status:'failed',checks:[{status:'wrong_answer',name:'parallel',actual:'6 4',expected:'6 3'}]}});assert(html.includes('第 2 项首先不同'));assert(html.includes('尚不能确定代码根因'));});
test('runtime-and-timeout-are-hypotheses',()=>{for(const status of ['runtime_error','timeout']){const html=D.cards({code:'',result:{status:'failed',checks:[{status,name:'case'}]}});assert(html.includes('验证'));assert(!html.includes('覆盖数组元素'));}});
test('warnings-retain-severity',()=>{const html=D.cards({...entry,result:{status:'ran',diagnostics:"main.c:2:1: warning: unused variable 'x'",checks:[]}});assert(html.includes('编译警告'));});
for(const p of c.problems)test('independent-of-problem-chapter-'+p.id,()=>{context.current={...p,code};const html=D.cards({...entry,problemID:p.id});assert(html.includes('L02-3-diagnostic-not-assignable'));context.current=null;});
fs.writeFileSync(path.join(root,'tests/reports/v41-diagnostics.json'),JSON.stringify(checks,null,2)+'\n');console.log(`${checks.filter(x=>x.ok).length}/${checks.length} diagnostic tests passed`);for(const x of checks.filter(x=>!x.ok))console.log(x);if(checks.some(x=>!x.ok))process.exitCode=1;
