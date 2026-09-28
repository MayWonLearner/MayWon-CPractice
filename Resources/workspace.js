'use strict';
window.CWorkspace=(()=>{
 const levels={starter:'从零入门',practice:'巩固与应用',competition:'算法与竞赛'};
 let expanded=false,fullscreen=false,initialized=false;
 const experienced=()=>!!(state.history?.length||Object.keys(state.progress||{}).length||Object.keys(state.drafts||{}).length||lessonReadIDs().length||state.lessonLast);
 const level=()=>state.learningProfile?.level||'practice';
 function questionnaire(){
  const profile=state.learningProfile||{};
  const question=(name,title,choices)=>`<fieldset><legend>${title}</legend>${choices.map(([value,label])=>`<label><input type="radio" name="${name}" value="${value}" ${profile[name]===value?'checked':''} required> ${label}</label>`).join('')}</fieldset>`;
  $('#main').innerHTML=`<div class="page onboarding"><div class="eyebrow">WELCOME TO C PRACTICE</div><h1>从适合你的地方开始</h1><p class="subtitle">三个选择帮助安排首页入口。所有教程和题库都可使用，之后也能重新选择。</p><form id="learning-profile">${question('experience','1. 你学过 C 语言吗？',[['new','完全没学过'],['some','学过语法，还不能独立写程序'],['confident','可以独立编程，想练习算法']])}${question('goal','2. 你希望达到什么目标？',[['basics','理解基础，完成入门课程'],['application','独立编写程序，解决实际问题'],['contest','准备信息学或算法竞赛']])}${question('pace','3. 你希望怎样开始？',[['guided','先读教程，再做配套题'],['practice','以练习为主，遇到问题再补知识']])}<button class="button primary" type="submit">保存并开始学习 →</button>${profile.level?'<button class="button quiet" type="button" id="profile-cancel">取消</button>':''}</form></div>`;
  $('#learning-profile').onsubmit=e=>{
   e.preventDefault();const form=new FormData(e.currentTarget),experience=form.get('experience'),goal=form.get('goal'),pace=form.get('pace');
   if(!experience||!goal||!pace)return;
   state.learningProfile={experience,goal,pace,level:experience==='new'?'starter':goal==='contest'?'competition':'practice'};
   persist();render();
  };
  if($('#profile-cancel'))$('#profile-cancel').onclick=()=>render();
 }
 function home(){
  if(!state.learningProfile&&!experienced()){questionnaire();return;}
  const profile=state.learningProfile,mod=state.lessonLast?.module||1,m=modules[mod-1]||modules[0];
  const primary=profile?.pace==='practice'&&level()!=='starter';
  $('#main').innerHTML=`<div class="page compact-home"><div class="home-heading"><div><div class="eyebrow">C PRACTICE</div><h1>今天，从这里继续。</h1></div><button class="button quiet" id="edit-profile">${profile?esc(levels[level()]):'设置学习目标'}</button></div><section class="hero"><div class="hero-copy"><div class="hero-label">${primary?'动手练习':'循序渐进的学习路径'}</div><h2>${esc(primary?(byID(state.last)?.title||'开始练习'):m.title)}</h2><p>${primary?'编写程序，运行检查点，再根据反馈复习。':'先阅读章节教程，再逐一理解基础点，最后完成配套练习。'}</p><button class="button primary" id="continue-button">${primary?'继续练习':'继续学习'} →</button></div></section><div class="home-actions"><button class="button quiet" data-coursebook="P01">编程前的准备</button><button class="button quiet" id="all-problems">${level()==='starter'?'本章配套练习':'浏览题库'}</button><button class="button quiet" id="home-review">错题与复习</button>${level()==='competition'?'<button class="button quiet" data-coursebook="A01">算法与竞赛课程</button>':''}</div><details class="home-catalog"><summary>全部学习章节 · 15 章</summary><div class="module-grid">${modules.map(x=>`<button class="module-card" data-module="${x.id}"><span class="module-no">CHAPTER ${String(x.id).padStart(2,'0')}</span><h3>${esc(x.title)}</h3><p>${esc(x.subtitle)}</p></button>`).join('')}</div></details><p class="muted">已完成 ${problems.filter(p=>completed(p.id)).length} 道题 · ${state.history.length} 次验证。更多工具可从左侧“展开全部功能”进入。</p></div>`;
  $('#continue-button').onclick=()=>primary?openProblem(state.last||'C001'):resumeTutorial();
  $('#edit-profile').onclick=questionnaire;
  $('#all-problems').onclick=()=>navigate('library',level()==='starter'?m.id:0);
  $('#home-review').onclick=()=>navigate('mistakes');
  $$('.module-card').forEach(b=>b.onclick=()=>openTutorial(+b.dataset.module));bindCoursebookEntries();
 }
 function normalizeWidth(value){return value<160?0:Math.max(180,Math.min(360,Number(value)||226));}
 function sidebar(value,save=false){
  const width=normalizeWidth(value);document.body.classList.toggle('sidebar-collapsed',width===0);
  document.body.style.setProperty('--sidebar-width',`${width||226}px`);
  const handle=$('#sidebar-resize');if(handle)handle.setAttribute('aria-valuenow',width);
  const toggle=$('#sidebar-toggle');if(toggle){toggle.setAttribute('aria-expanded',String(width!==0));toggle.title=width?'收起侧栏':'展开侧栏';}
  if(save){state.workspaceLayout={sidebarWidth:width};persist();}
 }
 function init(){
  if(initialized)return;initialized=true;
  const aside=$('.sidebar'),handle=document.createElement('div');handle.id='sidebar-resize';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-label','调整侧栏宽度；方向键调整，Home 收起，End 最大化');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','360');aside.after(handle);
  const toggle=document.createElement('button');toggle.id='sidebar-toggle';toggle.className='button quiet small';toggle.textContent='☰';toggle.setAttribute('aria-label','展开或收起侧栏');$('.topbar').prepend(toggle);
  toggle.onclick=()=>sidebar(document.body.classList.contains('sidebar-collapsed')?226:0,true);
  let dragging=false,lastWidth=226;
  handle.onpointerdown=e=>{if(e.button!==0)return;dragging=true;lastWidth=state.workspaceLayout?.sidebarWidth??226;handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing-sidebar');e.preventDefault();};
  handle.onpointermove=e=>{if(dragging){lastWidth=normalizeWidth(e.clientX);sidebar(lastWidth);}};
  const end=()=>{if(!dragging)return;dragging=false;document.body.classList.remove('resizing-sidebar');sidebar(lastWidth,true);};
  handle.onpointerup=end;handle.onpointercancel=end;handle.onlostpointercapture=end;
  handle.onkeydown=e=>{const width=state.workspaceLayout?.sidebarWidth??226;const next=e.key==='Home'?0:e.key==='End'?360:e.key==='ArrowLeft'?width-20:e.key==='ArrowRight'?(width||160)+20:null;if(next!==null){e.preventDefault();sidebar(next,true);}};
  const more=document.createElement('button');more.id='more-features';more.className='button quiet small';$('#primary-nav').after(more);more.onclick=()=>{expanded=!expanded;refresh();};
  document.addEventListener('keydown',shortcut);
 }
 function refresh(){
  init();sidebar(state.workspaceLayout?.sidebarWidth??226);
  const basic=['home','tutorial','library','agent','connection'];
  const practice=[...basic,'learning','mistakes','comprehensive'];
  const visible=level()==='starter'?basic:level()==='competition'?[...practice,'sports','olympiad']:practice;
  $$('#primary-nav [data-page]').forEach(b=>b.hidden=!(expanded||visible.includes(b.dataset.page)||b.dataset.page===page));
  $('#more-features').textContent=expanded?'收起更多功能':'展开全部功能';$('#more-features').setAttribute('aria-expanded',String(expanded));
  if(!['tutorial','coursebook'].includes(page))setFullscreen(false);
 }
 function setFullscreen(value){fullscreen=!!value;document.body.classList.toggle('reading-fullscreen',fullscreen);$$('[data-reading-fullscreen]').forEach(b=>b.innerHTML=`${fullscreen?'退出全屏':'全屏阅读'} <kbd>Ctrl / ⌘ + Shift + F</kbd>`);}
 function readingControls(host){
  const heading=host.querySelector('.tutorial-heading');if(!heading)return;
  const embedded=!!host.querySelector('.embedded-tutorial');
  const toolbar=document.createElement('div');toolbar.className='reading-toolbar';toolbar.setAttribute('data-no-annotate','');
  toolbar.innerHTML=`<button class="button quiet small" data-reading-fullscreen>${fullscreen?'退出全屏':'全屏阅读'} <kbd>Ctrl / ⌘ + Shift + F</kbd></button>${page==='tutorial'||embedded?'<button class="button quiet small" data-reading-next>下一节 <kbd>Alt + →</kbd></button><button class="button quiet small" data-reading-chapter>下一章 <kbd>Alt + Shift + →</kbd></button>':''}`;
  heading.after(toolbar);
  toolbar.querySelector('[data-reading-fullscreen]').onclick=()=>{if(embedded){const mod=tutorialModule,index=tutorialIndex,foundation=tutorialFoundationID;openTutorial(mod,index);if(foundation)tutorialSelect(index,foundation);}setFullscreen(!fullscreen);};
  if(page==='tutorial'||embedded){
   toolbar.querySelector('[data-reading-next]').onclick=tutorialNext;
   toolbar.querySelector('[data-reading-chapter]').onclick=tutorialNextChapter;
   toolbar.querySelector('[data-reading-chapter]').disabled=tutorialModule===tutorials.length;
   const points=foundationPoints(),atEnd=tutorialModule===tutorials.length&&(tutorialFoundationID?points.at(-1)?.id===tutorialFoundationID:tutorialIndex===tutorials[tutorialModule-1].lessons.length-1&&!points.length);
   toolbar.querySelector('[data-reading-next]').disabled=atEnd;
   if(host.querySelector('#next-lesson'))host.querySelector('#next-lesson').disabled=atEnd;
   if(tutorialFoundationID){const footer=toolbar.cloneNode(true);footer.classList.add('reading-footer');const article=host.querySelector('.lesson-article');article.append(footer);footer.querySelector('[data-reading-next]').onclick=tutorialNext;footer.querySelector('[data-reading-chapter]').onclick=tutorialNextChapter;footer.querySelector('[data-reading-fullscreen]').onclick=()=>setFullscreen(!fullscreen);}
  }else if(page==='coursebook'){
   const next=host.querySelector('#course-next');if(next)next.innerHTML='下一节 → <kbd>Alt + →</kbd>';
  }
 }
 function shortcut(e){
  if(e.isComposing||!['tutorial','coursebook'].includes(page)||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable="true"],.monaco-editor'))return;
  if(e.key==='Escape'&&fullscreen){e.preventDefault();setFullscreen(false);}
  else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();setFullscreen(!fullscreen);}
  else if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.key==='ArrowRight'){
   e.preventDefault();if(page==='tutorial'){e.shiftKey?tutorialNextChapter():tutorialNext();}
   else if(!e.shiftKey){const next=$('#course-next');if(next&&!next.disabled)next.click();}
  }
 }
 return {home,refresh,readingControls,normalizeWidth,questionnaire,shortcut};
})();
