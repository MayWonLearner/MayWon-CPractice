'use strict';
const SKILLS=[
 {id:'syntax',name:'语法与表达式',modules:[1,2,12]},
 {id:'flow',name:'逻辑与流程',modules:[3,4]},
 {id:'data',name:'数据与字符串',modules:[5,6,9]},
 {id:'function',name:'函数与分解',modules:[7]},
 {id:'memory',name:'指针与内存',modules:[8,10]},
 {id:'file',name:'文件与工程',modules:[11]},
 {id:'structure',name:'数据结构',modules:[14]},
 {id:'algorithm',name:'算法与效率',modules:[13,15]}
];
const DAY=86400000,INTERVALS=[1,3,7,14,30,60];
let selectedSkill='syntax';
function skillFor(module){return SKILLS.find(s=>s.modules.includes(module));}
function retention(item,now=Date.now()){if(!item)return null;const days=Math.max(0,(now-item.last)/DAY);return Math.exp(-days/Math.max(0.01,item.stability));}
function scheduleMemory(previous,passed,assisted,now=Date.now()){
 // Repeated runs in the same day cannot increase a review interval.
 const prior=previous??{streak:0,attempts:0};
 const spaced=!previous||(new Date(now).toDateString()!==new Date(previous.last).toDateString()&&now-previous.last>=0.75*DAY);
 const streak=passed&&!assisted?(spaced?Math.min(6,prior.streak+1):Math.max(1,prior.streak)):0;
 const interval=passed&&!assisted?INTERVALS[Math.max(0,streak-1)]:0.25;
 return {streak,attempts:prior.attempts+1,last:now,due:now+interval*DAY,stability:interval/-Math.log(0.75),passed:passed&&!assisted,assisted:!!assisted,interval};
}
function recordLearning(id,module,passed,assisted=false,ratio=passed?1:0,now=Date.now()){
 state.memory??={};state.evidence??={};
 state.memory[id]=scheduleMemory(state.memory[id],passed,assisted,now);
 state.evidence[id]={module,skill:skillFor(module).id,score:assisted?Math.min(0.4,ratio):ratio,passed:passed&&!assisted,assisted,time:now};
 state.masteryEvents??={};state.masteryEvents[id]??=[];state.masteryEvents[id].push({time:now,score:state.evidence[id].score,stability:state.memory[id].stability,passed:passed&&!assisted});
}
function skillStats(snapshot=state,now=Date.now()){
 return SKILLS.map(skill=>{
  const entries=Object.entries(snapshot.evidence??{}).filter(([,e])=>e.skill===skill.id),n=entries.length;
  const score=n?entries.reduce((a,[,e])=>a+e.score,0)/n:null;
  const memories=entries.map(([id])=>snapshot.memory?.[id]).filter(Boolean);
  const recall=memories.length?memories.reduce((a,m)=>a+retention(m,now),0)/memories.length:null;
  return {...skill,n,score,recall,due:memories.filter(m=>m.due<=now).length,entries};
 });
}
function migrateLearning(){
 if(state.learningVersion===3)return;
 if(state.learningVersion===2){state.masteryEvents??={};for(const[id,e]of Object.entries(state.evidence??{})){if(!state.masteryEvents[id]&&state.memory?.[id])state.masteryEvents[id]=[{time:e.time,score:e.score,stability:state.memory[id].stability,passed:e.passed}];}state.learningVersion=3;persist();return;}
 state.memory??={};state.evidence??={};
 for(const h of state.history){const p=byID(h.problemID);if(p)recordLearning(p.id,p.module,h.status==='passed',!!h.assisted,h.total?h.passed/h.total:0,Date.parse(h.time));}
 state.learningVersion=3;persist();
}
function recommendations(snapshot=state,now=Date.now(),skillID=null){
 const stats=skillStats(snapshot,now),eligible=problems.filter(p=>!skillID||skillFor(p.module).id===skillID);
 const scored=eligible.map(p=>{
  const evidence=snapshot.evidence?.[p.id],mem=snapshot.memory?.[p.id],skill=stats.find(s=>s.id===skillFor(p.module).id),due=mem&&mem.due<=now;
  let score=0,reason='建立新能力：先读本章教程，再做这道入门练习';
  if(evidence&&!evidence.passed){score=100+(1-evidence.score)*20;reason=evidence.assisted?'参考过答案：建议合上参考解后独立重做':'最近检查未通过，优先修补当前薄弱点';}
  else if(due){score=80+Math.min(15,(now-mem.due)/DAY);reason=`已到复习时间，模型估计保留率 ${Math.round(retention(mem,now)*100)}%`;}
  else if(!evidence){score=30+(skill.score==null?0:(1-skill.score)*25)-(p.module-1)*1.5-({入门:0,基础:4,进阶:10,挑战:18,困难:28}[p.level]??8);if(skill.score!==null)reason=`补强${skill.name}：当前观测正确率 ${Math.round(skill.score*100)}%`;}
  else {score=10*(1-retention(mem,now));reason='巩固已掌握内容，尝试解释边界与复杂度';}
  if(p.bank==='comprehensive'&&!evidence)score-=15;
  return {p,score,reason,lesson:lessonForProblem(p).lesson,lessonIndex:lessonForProblem(p).index};
 });
 return scored.sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id)).slice(0,8);
}
function radarSVG(stats){const center=[210,175],radius=108;const point=(i,r)=>[center[0]+Math.cos(-Math.PI/2+i*Math.PI/4)*r,center[1]+Math.sin(-Math.PI/2+i*Math.PI/4)*r];
 return `<svg viewBox="0 0 420 350" role="img" aria-label="八维学习能力图；无练习数据的维度暂不评分">${[.25,.5,.75,1].map(r=>`<polygon points="${stats.map((s,i)=>point(i,r*radius).join(',')).join(' ')}" fill="none" stroke="#34434d"/>`).join('')}${stats.map((s,i)=>`<line x1="210" y1="175" x2="${point(i,radius)[0]}" y2="${point(i,radius)[1]}" stroke="#34434d"/>`).join('')}<polygon points="${stats.map((s,i)=>point(i,(s.score??0)*radius).join(',')).join(' ')}" fill="#a4e8b52b" stroke="#a4e8b5" stroke-width="2"/>${stats.map((s,i)=>{const[x,y]=point(i,145);return `<text x="${x}" y="${y}" text-anchor="middle" fill="${s.id===selectedSkill?'#a4e8b5':'#91a4b5'}" font-size="11">${esc(s.name)}<tspan x="${x}" dy="17">${s.n?Math.round(s.score*100)+'%':'暂无数据'}</tspan></text>`}).join('')}</svg>`;
}
function renderLearning(){migrateLearning();const stats=skillStats(),skill=stats.find(s=>s.id===selectedSkill),recs=recommendations(state,Date.now(),selectedSkill),allDue=Object.values(state.memory??{}).filter(m=>m.due<=Date.now()).length;
 $('#main').innerHTML=`<div class="page"><div class="eyebrow">LEARNING INSIGHTS</div><h1 class="page-title">知道哪里薄弱，也知道何时复习。</h1><p class="subtitle">从实际作答建立八维画像。每个知识点分别记录复习间隔；数据只保存在本机。</p><div class="insight-grid"><section class="insight-card"><div class="section-head"><h2>学习能力多维图</h2><span class="tag">${Object.keys(state.evidence??{}).length} 个观测项目</span></div>${radarSVG(stats)}<p class="note">每道题和理解题仅取最近一次结果。查看参考解后的通过最多计 40%；未练习不等于能力为零。样本少时请结合实际表现判断。</p></section><section class="insight-card"><div class="section-head"><h2>选择当前要补强的能力</h2><span class="tag">${allDue} 项待复习</span></div><div class="skill-tabs">${stats.map(s=>`<button data-skill="${s.id}" class="${s.id===selectedSkill?'selected':''}">${s.name}</button>`).join('')}</div><h3>${skill.name}</h3><p class="subtitle">${skill.n?`${skill.n} 个已观察项目 · 正确率 ${Math.round(skill.score*100)}%`:'还没有作答记录。从对应章节开始，先读例子，再独立写出解答。'}</p><p class="note">八维图概括已练项目的表现，下方多色曲线同时考虑各板块的学习覆盖率与遗忘。独立通过后的复习间隔为1、3、7、14、30、60天；失败或参考过答案后6小时复习。同日重复运行不拉长间隔。</p><p class="note">从未学习的板块始终为0。蓝色背景是未来日期；只有实际复习完成，才会记入历史曲线的上升或下降。</p></section></div>${renderMasteryPanel()}${dueLessonCards(selectedSkill)}<div class="section-head"><div><h2>为「${skill.name}」安排的下一步</h2><p>失败题 → 到期复习 → 难度合适的新题。每条建议都能回到相关教程。</p></div></div><div class="recommend-grid">${recs.map(({p,reason,lesson,lessonIndex})=>`<article class="recommend-card"><div class="tags"><span class="id-cell">${p.id}</span><span class="badge ${p.level}">${p.level}</span></div><h3>${esc(p.title)}</h3><p>${esc(reason)}</p><div class="recommend-actions"><button class="button primary small" data-practice="${p.id}">开始练习 →</button><button class="text-btn" data-teach="${p.module},${lessonIndex}">复习 · ${esc(lesson.title)}</button></div></article>`).join('')}</div><div class="section-head" style="margin-top:28px"><h2>各能力的证据</h2></div><table class="problem-table"><thead><tr><th>能力</th><th>项目数</th><th>观测正确率</th><th>估计保留率</th><th>到期项目</th></tr></thead><tbody>${stats.map(s=>`<tr><td>${s.name}</td><td>${s.n}</td><td>${s.n?Math.round(s.score*100)+'%':'暂无数据'}</td><td>${s.n?Math.round(s.recall*100)+'%':'—'}</td><td>${s.due}</td></tr>`).join('')}</tbody></table></div>`;
 $$('[data-skill]').forEach(b=>b.onclick=()=>{selectedSkill=b.dataset.skill;renderLearning();});bindMasteryPanel();bindRecommendations();
}
function bindRecommendations(){$$('[data-practice]').forEach(b=>b.onclick=()=>openProblem(b.dataset.practice));$$('[data-teach]').forEach(b=>b.onclick=()=>openTutorial(+b.dataset.teach.split(',')[0],+(b.dataset.teach.split(',')[1]??0)));}
function renderMistakes(){const list=Object.entries(state.evidence??{}).filter(([id,e])=>byID(id)&&!e.passed).map(([id,e])=>({p:byID(id),e})).sort((a,b)=>b.e.time-a.e.time);
 $('#main').innerHTML=`<div class="page"><div class="eyebrow">MISTAKE NOTEBOOK</div><h1 class="page-title">把错误变成下一次的线索。</h1><p class="subtitle">最近未独立通过的题目自动进入错题本。独立通过后自动移出，复盘笔记继续保留。</p>${renderRemedialSection()}<h2>需要复做的原题</h2>${list.length?list.map(({p,e})=>`<article class="recommend-card" style="margin-top:14px"><h3>${p.id} · ${esc(p.title)}</h3><p>${e.assisted?'看过答案后需要独立复做':(p.subtasks?.length?'最近子任务得分 ':'最近检查点通过率 ')+Math.round(e.score*100)+(p.subtasks?.length?'/100':'%')} · ${new Date(e.time).toLocaleString('zh-CN')}</p><p>${esc(state.notes?.[p.id]||'尚未写复盘。进入题目，在“思路提示”页写下错误原因与修正方法。')}</p><button class="button primary small" data-practice="${p.id}">重新练习</button> <button class="text-btn" data-teach="${p.module},${lessonForProblem(p).index}">回看本章教程 →</button></article>`).join(''):'<div class="empty">暂时没有待复做的错题。完成练习后，这里会自动整理需要巩固的内容。</div>'}</div>`;bindRecommendations();bindRemedial();
}
function lessonQuizEvidence(lesson,module,choice,assisted=false){recordLearning(lesson.id,module,choice===lesson.quiz.answer,assisted,choice===lesson.quiz.answer?1:0);persist();}
window.LearningMath={SKILLS,DAY,retention,scheduleMemory,skillStats,recommendations};
const BOARD_COLORS=['#A4E8B5','#80BFFF','#EAAF91','#C0A0F2','#F0D274','#64D1C7','#F393AD','#A3B6E9','#D0CB9B','#EEA15B','#78CADF','#DAA7DF','#A9CE76','#F17676','#A9A9FF','#EEE4D0','#E5BB50','#9C7DE0'];
let visibleBoards=null,curveRange='30';
function masteryBoards(){return [...modules.map((m,i)=>({id:String(m.id),name:m.title,color:BOARD_COLORS[i],ids:[...problems.filter(p=>p.module===m.id&&p.bank!=='comprehensive').map(p=>p.id),...tutorials[i].lessons.map(l=>l.id)]})),{id:'comprehensive',name:'经典综合题',color:BOARD_COLORS[15],ids:problems.filter(p=>p.bank==='comprehensive'&&!p.collection).map(p=>p.id)},{id:'sports',name:'足球与篮球',color:BOARD_COLORS[16],ids:problems.filter(p=>p.collection==='sports').map(p=>p.id)},{id:'olympiad',name:'竞赛困难挑战',color:BOARD_COLORS[17],ids:problems.filter(p=>p.collection==='olympiad').map(p=>p.id)}];}
function masteryAt(board,at,snapshot=state){if(!board.ids.length)return 0;let sum=0;for(const id of board.ids){const events=snapshot.masteryEvents?.[id]??[],event=events.findLast(e=>e.time<=at);if(event)sum+=event.score*Math.exp(-Math.max(0,(at-event.time)/DAY)/event.stability);}return 100*sum/board.ids.length;}
function masteryTimeWindow(now=Date.now(),snapshot=state){const times=Object.values(snapshot.masteryEvents??{}).flat().map(e=>e.time),earliest=times.length?Math.min(...times):now;const start=new Date(curveRange==='all'?earliest:Math.max(earliest,now-30*DAY));start.setHours(0,0,0,0);return {start:start.getTime(),end:now+14*DAY,now};}
function masteryChart(snapshot=state,now=Date.now()){
 const boards=masteryBoards(),active=boards.filter(b=>!visibleBoards||visibleBoards.has(b.id)),window=masteryTimeWindow(now,snapshot),left=52,top=24,w=880,h=255,right=932;
 const x=t=>left+(t-window.start)/(window.end-window.start)*w,y=p=>top+h-p/100*h;
 const sample=new Set(Array.from({length:181},(_,i)=>window.start+(window.end-window.start)*i/180));sample.add(now);
 for(const list of Object.values(snapshot.masteryEvents??{}))for(const e of list){if(e.time>=window.start&&e.time<=window.end){sample.add(e.time-1);sample.add(e.time);}}
 const times=[...sample].sort((a,b)=>a-b),date=t=>new Date(t).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
 const paths=active.map(b=>{const before=times.filter(t=>t<=now),after=times.filter(t=>t>=now),path=arr=>arr.map((t,i)=>`${i?'L':'M'}${x(t).toFixed(2)},${y(masteryAt(b,t,snapshot)).toFixed(2)}`).join(' ');return `<path d="${path(before)}" stroke="${b.color}" fill="none" stroke-width="2"><title>${esc(b.name)} · 今天 ${masteryAt(b,now,snapshot).toFixed(1)}%</title></path><path d="${path(after)}" stroke="${b.color}" fill="none" stroke-width="1.6" stroke-dasharray="5 4"/>`;}).join('');
 const markers=active.flatMap(b=>b.ids.flatMap(id=>(snapshot.masteryEvents?.[id]??[]).filter(e=>e.time>=window.start&&e.time<=now).map(e=>`<circle cx="${x(e.time)}" cy="${y(masteryAt(b,e.time,snapshot))}" r="3" fill="${b.color}"><title>${esc(b.name)} · ${new Date(e.time).toLocaleString('zh-CN')} · ${e.passed?'独立通过':'需再巩固'} · ${masteryAt(b,e.time,snapshot).toFixed(1)}%</title></circle>`))).join('');
 return `<svg class="mastery-chart" viewBox="0 0 970 338" role="img" aria-label="各板块随日期变化的掌握度曲线，纵轴从零到百分之百"><rect x="${x(now)}" y="24" width="${right-x(now)}" height="255" fill="#1d2937"/>${[0,20,40,60,80,100].map(p=>`<line x1="52" y1="${y(p)}" x2="932" y2="${y(p)}" stroke="#32404d"/><text x="42" y="${y(p)+4}" text-anchor="end" fill="#91a5b7" font-size="11">${p}%</text>`).join('')}${Array.from({length:7},(_,i)=>{const t=window.start+(window.end-window.start)*i/6;return `<text x="${x(t)}" y="302" text-anchor="middle" fill="#91a5b7" font-size="11">${date(t)}</text>`}).join('')}<line x1="${x(now)}" y1="24" x2="${x(now)}" y2="279" stroke="#8799ab" stroke-dasharray="3 3"/><text x="${Math.min(855,x(now)+7)}" y="17" fill="#a6b9cc" font-size="11">今天 · 右侧为预测</text>${paths}${markers}<text x="495" y="330" text-anchor="middle" fill="#8397aa" font-size="11">日期（${new Date(window.start).getFullYear()} · 本地时区）</text></svg>`;
}
function renderMasteryPanel(){const boards=masteryBoards();return `<section class="insight-card mastery-panel"><div class="section-head"><div><h2>各板块的遗忘与复习 · 掌握程度曲线</h2><p>实线根据历史作答计算，圆点是学习/复习事件，虚线为停止复习后的估计。</p></div><select id="curve-range" aria-label="曲线日期范围"><option value="30" ${curveRange==='30'?'selected':''}>最近30天 + 未来14天</option><option value="all" ${curveRange==='all'?'selected':''}>全部学习日期 + 未来14天</option></select></div><div id="mastery-chart">${masteryChart()}</div><div class="curve-legend">${boards.map(b=>`<button data-board="${b.id}" class="${!visibleBoards||visibleBoards.has(b.id)?'selected':''}" aria-pressed="${!visibleBoards||visibleBoards.has(b.id)}"><i style="background:${b.color}"></i>${esc(b.name)}<b>${masteryAt(b,Date.now()).toFixed(1)}%</b></button>`).join('')}</div><div style="display:flex;gap:12px;margin:12px 0"><button class="button quiet small" id="boards-all">全部显示</button><button class="button quiet small" id="boards-single">只看当前能力相关板块</button></div><p class="note">未学习项目按 0 计。板块掌握度 = 本板块各题/理解题的“最近观测分值 × 估计保留率”之和 ÷ 项目总数；经典综合、体育综合、竞赛困难三组分别计算，分章题与理解题计入所属章节。完整检查通过计1；竞赛题部分通过按子任务得分/100，其余题按检查点比例，看过答案最多计0.4。复习会重设该项目的遗忘起点与间隔；错误也可能使曲线下降。不同颜色在未学习时共同位于0线上，可点击图例筛选。曲线是学习覆盖度与保持程度的启发式估计，非实际记忆测量。</p></section>`;}
function bindMasteryPanel(){const rerender=()=>{const host=$('.mastery-panel');host.outerHTML=renderMasteryPanel();bindMasteryPanel();};$$('[data-board]').forEach(b=>b.onclick=()=>{visibleBoards??=new Set(masteryBoards().map(b=>b.id));const id=b.dataset.board;visibleBoards.has(id)?visibleBoards.delete(id):visibleBoards.add(id);rerender();});$('#curve-range').onchange=e=>{curveRange=e.target.value;rerender();};$('#boards-all').onclick=()=>{visibleBoards=null;rerender();};$('#boards-single').onclick=()=>{visibleBoards=new Set(SKILLS.find(s=>s.id===selectedSkill).modules.map(String));rerender();};}
window.LearningMath.masteryAt=masteryAt;
function lessonForProblem(p){
 const text=[p.title,p.description,p.topic,...(p.tags??[])].join(' '),rules={
 1:[[/scanf|输入|收据|读取/,2],[/排版|打印|欢迎|输出/,3],[/拆分|换算|时钟|分钟/,4]],
 2:[[/溢出|大整数|乘积/,1],[/const|范围|类型/,3],[/转换|解析|文本/,4],[/表达式|递增|运算符/,2]],
 3:[[/switch|菜单|星期/,2],[/短路|除数|除零/,1],[/边界|合法|验证/,4]],
 4:[[/最大公约|最小公倍/,2],[/矩阵|乘法表|嵌套/,3],[/跳过|哨兵/,4],[/数字|反转|位数/,1]],
 5:[[/前缀|区间|累计/,3],[/频次|计数|出现/,4],[/矩阵|座位|转置/,2],[/遍历|最大|最小|平均/,1]],
 6:[[/读取|整行|空格/,1],[/比较|相等|排序|大小写/,2],[/拼接|格式/,3],[/字段|分隔|单词/,4]],
 7:[[/递归|汉诺|阶乘|斐波/,2],[/作用域|局部|静态/,1],[/声明|多文件/,3],[/断言|调试/,4]],
 8:[[/交换|修改|传地址/,1],[/函数指针|移动|偏移/,2],[/const|只读/,3],[/数组|长度/,4]],
 9:[[/复制|副本|地址/,1],[/枚举|联合/,2],[/排序|名次|关键字/,3],[/状态|订单/,4]],
 10:[[/扩容|realloc/,1],[/释放|所有权/,2],[/calloc|初始化/,3],[/可增长|动态数组/,4]],
 11:[[/EOF|字符|字节数/,1],[/二进制|定位/,2],[/行|记录|日志/,3],[/字节序|编码/,4]],
 12:[[/异或|唯一|抵消/,1],[/宏|最大值|平方/,2],[/头文件|inline/,3],[/集合|标志|权限/,4]],
 13:[[/答案二分|容量|最小.*最大|运输/,4],[/二分|有序.*查|查找|边界|第.*个/,1],[/归并|合并/,3],[/qsort|比较器|结构体/,2]],
 14:[[/链表.*反转|反转.*链表/,1],[/链表/,0],[/二叉树|树节点|祖先|子树|树高|树的/,4],[/队列|排队/,3],[/反转/,1],[/栈|括号|表达式|后缀/,2]],
 15:[[/Dijkstra|带权|非负.*权|网络延迟/,4],[/BFS|网格|迷宫|无权|最短.*步|层次/,2],[/回溯|排列|组合|皇后|子集/,3],[/滑动|窗口|无重复|不重复/,1],[/复杂度/,5]]
 };
 const chapter=tutorials[p.module-1],originalIndex=(rules[p.module]??[]).find(([re])=>re.test(text))?.[1]??0;
 const id='L'+String(p.module).padStart(2,'0')+'-'+(originalIndex+1);
 const found=chapter.lessons.findIndex(l=>l.id===id),index=found>=0?found:0;
 return {lesson:chapter.lessons[index],index};
}
function dueLessonCards(skillID){const skill=SKILLS.find(s=>s.id===skillID),due=tutorials.filter(t=>skill.modules.includes(t.module)).flatMap(t=>t.lessons.map((l,i)=>({l,index:i,module:t.module}))).filter(({l})=>state.memory?.[l.id]?.due<=Date.now()).sort((a,b)=>state.memory[a.l.id].due-state.memory[b.l.id].due).slice(0,4);return due.length?`<div class="section-head"><h2>先复习这些到期知识点</h2></div><div class="recommend-grid" style="margin-bottom:25px">${due.map(({l,index,module})=>`<article class="recommend-card"><span class="id-cell">${l.id}</span><h3>${esc(l.title)}</h3><p>此理解题已到复习时间。旧答案已隐藏，请先独立回忆，再重新作答。</p><button class="button small" data-teach="${module},${index}">回到这一课 →</button></article>`).join('')}</div>`:'';}
