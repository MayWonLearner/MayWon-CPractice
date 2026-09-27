'use strict';
// Isolated UI/model regressions. No native launch, localStorage or user files.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'Resources', name), 'utf8');
const results = [];
function harness() {
    const catalog = JSON.parse(read('curriculum.json'));
    const existing = new Set(catalog.problems.map(p => p.id));
    catalog.problems.push(...JSON.parse(read('chapter-additions.json')).filter(p => !existing.has(p.id)));
    const nodes = new Map(), cache = new Map(), clock = {now: 1800000000000};
    const makeNode = () => ({isConnected:true,querySelector:selector=>element(selector),querySelectorAll:selector=>list(selector),innerHTML:'',textContent:'',value:'',style:{},dataset:{},scrollTop:0,scrollLeft:0,selectionStart:0,selectionEnd:0,disabled:false,hidden:false,
        classList:{add(){},remove(){},toggle(){}},remove(){},focus(){},select(){},showModal(){},close(){},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},click(){if(!this.disabled)this.onclick?.({target:this,preventDefault(){},stopPropagation(){}});}});
    const element = selector => {if(!nodes.has(selector))nodes.set(selector,makeNode());return nodes.get(selector);};
    const list = selector => {
        const html=element('#main').innerHTML;
        if(cache.get(selector)?.html===html)return cache.get(selector).nodes;
        let found=[];
        if(selector==='[data-answer]')found=[...html.matchAll(/<button class="quiz-option ([^"]*)" data-answer="(\d+)"([^>]*)>/g)].map(m=>Object.assign(makeNode(),{dataset:{answer:m[2]},disabled:/\bdisabled\b/.test(m[3]),className:m[1]}));
        if(selector==='[data-history]')found=[...html.matchAll(/data-history="(\d+)"/g)].map(m=>Object.assign(makeNode(),{dataset:{history:m[1]}}));
        cache.set(selector,{html,nodes:found});return found;
    };
    class ClockDate extends Date {constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}}
    const context={console,queueMicrotask:fn=>fn(),Date:ClockDate,setTimeout:()=>0,clearTimeout(){},window:{CURRICULUM:catalog,webkit:{messageHandlers:{native:{postMessage(){}}}},addEventListener(){}},document:{querySelector:element,querySelectorAll:list,addEventListener(){}}};
    vm.createContext(context);
    for(const file of ['coursebook.js','tutorials.js','learning.js','complexity.js','diagnostic-guides.js','diagnostics.js','collections.js','analysis.js','study.js','remedial.js','app.js'])vm.runInContext(read(file),context,{filename:file});
    vm.runInContext('persist=()=>{};flush=()=>{};',context);
    return {context,run:source=>vm.runInContext(source,context),element,list,clock};
}
function check(name, fn) {try {fn();results.push({name,ok:true});}catch(error){results.push({name,ok:false,error:error.message});}}
function reveal(h) {h.run("openProblem('C003');statementTab='solution';renderStatement();");h.element('#reveal-solution').click();}
function reset(h) {h.element('#reset-button').click();h.element('#confirm-reset').click();}
function result(h) {h.run("window.receiveNative({type:'result',payload:{problemID:'C003',mode:'judge',code:codeFor(byID('C003')),result:{status:'passed',checks:byID('C003').tests.map(()=>({status:'passed'})),diagnostics:''}}});");}
check('reference marker survives navigation',()=>{const h=harness();reveal(h);h.run("navigate('home');openProblem('C003');startRun('judge');");assert.equal(h.run('busy.assisted'),true);});
check('independent retry hides reference solution',()=>{const h=harness();reveal(h);reset(h);assert.equal(h.run("!!state.assistedProblems?.C003"),false);assert.equal(h.element('#statement').innerHTML.includes('一种可行的实现'),false,'reference code remains visible after assisted flag is cleared');});
check('due quiz hides old answer and records independent first response',()=>{const h=harness();h.run("state.quizAnswers={'L01-1':tutorials[0].lessons.find(l=>l.id==='L01-1').quiz.answer};state.memory={'L01-1':{due:Date.now()-1,last:Date.now()-DAY,streak:1,attempts:1,stability:3}};openTutorial(1,tutorials[0].lessons.findIndex(l=>l.id==='L01-1'));");assert.equal(h.list('[data-answer]').some(b=>b.disabled||b.className.includes('correct')),false);h.list('[data-answer]')[h.run('lessonNow().quiz.answer')].click();assert.equal(h.run("state.evidence['L01-1'].assisted"),false);assert.equal(h.list('[data-answer]').every(b=>b.disabled),true);});
check('retry after seeing quiz feedback remains assisted',()=>{const h=harness();h.run('openTutorial(1,tutorials[0].lessons.findIndex(l=>l.id==="L01-1"));');const correct=h.run('lessonNow().quiz.answer');h.list('[data-answer]')[(correct+1)%3].click();h.list('[data-answer]')[correct].click();assert.equal(h.run("state.evidence['L01-1'].score"),.4);});
check('problem result reenables tutorial example button',()=>{const h=harness();h.run("openProblem('C003');startRun('judge');openTutorial(1,tutorials[0].lessons.findIndex(l=>l.id==='L01-1'));");assert.equal(h.element('#run-example').disabled,true);result(h);assert.equal(h.element('#run-example').disabled,false);});
check('grid shortest path maps to BFS',()=>{const h=harness();assert.equal(h.run("lessonForProblem(byID('C060')).lesson.id"),'L15-3');});
check('linked-list traversal does not map to tree traversal',()=>{const h=harness();assert.equal(h.run("lessonForProblem(byID('B210')).lesson.id"),'L14-1');});
check('restoring an assisted snapshot preserves assistance provenance',()=>{const h=harness();reveal(h);h.run("$('#code').value=current.solution;editorChanged();startRun('judge');");result(h);reset(h);h.run("navigate('history');");h.list('[data-history]')[0].click();h.element('#restore-snapshot').click();h.run("startRun('judge');");assert.equal(h.run('busy.assisted'),true,'known assisted code is restored but graded as independent');});
check('chapter opens with basic functions before original lessons',()=>{const h=harness();h.run('openTutorial(1);');assert.equal(h.run('lessonNow().id'),'L01-6');assert.equal(h.run('state.lessonLast.lessonID'),'L01-6');});
check('legacy and stable bookmarks survive introductory insertion',()=>{const h=harness();for(let index=0;index<5;index++){h.run(`state.lessonLast={module:1,index:${index}};navigate('tutorial');`);assert.equal(h.run('lessonNow().id'),'L01-'+(index+1));}h.run("state.lessonLast={module:1,index:0,lessonID:'L01-9'};navigate('tutorial');");assert.equal(h.run('lessonNow().id'),'L01-9');h.run("navigate('tutorial');");assert.equal(h.run('lessonNow().id'),'L01-9');});
check('input review recommendations retain original lesson identity',()=>{const h=harness();assert.equal(h.run("lessonForProblem({module:1,title:'输入一个整数',description:'',tags:[]}).lesson.id"),'L01-3');});
console.log(JSON.stringify(results,null,2));
console.log(`${results.filter(r=>r.ok).length}/${results.length} review regressions passed`);
if(results.some(r=>!r.ok))process.exitCode=1;
