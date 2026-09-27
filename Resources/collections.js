'use strict';
function collectionLabel(p) {
    if (p.collection === 'sports') return p.sport === 'football' ? '足球综合' : '篮球综合';
    if (p.collection === 'olympiad') return '竞赛困难';
    return p.bank === 'comprehensive' ? '经典综合' : '分章练习';
}
function matchesBank(p, filter) {
    if (!filter) return true;
    if (filter === 'classic') return p.bank === 'comprehensive' && !p.collection;
    if (filter === 'football' || filter === 'basketball') return p.collection === 'sports' && p.sport === filter;
    if (filter === 'sports' || filter === 'olympiad') return p.collection === filter;
    return (p.bank ?? 'chapter') === filter;
}
function collectionCards() {
    return `<div class="collection-grid">${[
        ['sports', '球场上的算法', '足球 × 篮球', '把训练、赛程、阵容和战术变成可以求解的问题。', '⚽'],
        ['olympiad', '竞赛困难挑战', '建模 · 证明 · 优化', '从小规模子任务起步，推导正确性与复杂度，再挑战完整约束。', '◇']
    ].map(([id,title,tag,description,icon])=>`<button class="collection-card ${id}" data-collection="${id}"><span class="collection-icon">${icon}</span><div><small>${tag}</small><h3>${title}</h3><p>${description}</p></div><strong>${problems.filter(p=>p.collection===id).length}<small>道题 →</small></strong></button>`).join('')}</div>`;
}
function bindCollectionCards() {
    $$('[data-collection]').forEach(b => b.onclick = () => navigate(b.dataset.collection));
}
function scoreSubtasks(p, result) {
    const groups = (p.subtasks ?? []).map(group => {
        const indices = p.tests.flatMap((test, i) => test.subtask === group.id ? [i] : []);
        const passed = indices.filter(i => result?.checks?.[i]?.status === 'passed').length;
        const complete = result?.status !== 'cancelled' && indices.length > 0 && passed === indices.length;
        return {...group, passed, total: indices.length, earned: complete ? group.points : 0};
    });
    return {groups, earned: groups.reduce((sum, g) => sum + g.earned, 0), total: groups.reduce((sum, g) => sum + g.points, 0)};
}
function judgeRatio(p, result) {
    if (p.subtasks?.length) { const score = scoreSubtasks(p, result); return score.total ? score.earned / score.total : 0; }
    return result.checks.filter(c => c.status === 'passed').length / p.tests.length;
}
function subtaskStatement(p) {
    if (!p.subtasks?.length) return '';
    return `<section class="subtask-section"><h3>子任务与分值</h3><p class="note">每组检查点全部通过才获得该组分值，满分100。这里是本题练习得分，不代表正式竞赛评级；参考过答案仍会降低学习掌握度记分。</p><table class="subtask-table"><thead><tr><th>子任务</th><th>分值</th><th>附加约束</th></tr></thead><tbody>${p.subtasks.map(g=>`<tr><td>${esc(g.name)}</td><td>${g.points}</td><td>${esc(g.constraints)}</td></tr>`).join('')}</tbody></table></section>`;
}
function subtaskResults(p, entry) {
    if (!p.subtasks?.length || entry.mode !== 'judge') return '';
    const score = scoreSubtasks(p, entry.result);
    return `<section class="subtask-result" aria-label="子任务得分"><strong>${score.earned} / ${score.total} 分</strong><span>本次完整检查${entry.code!==codeFor(p)?' · 源码已修改，请重新检查':''}</span><div>${score.groups.map(g=>`<span class="score-group ${g.earned?'pass':''}">${esc(g.name)}：${g.earned}/${g.points} 分 · ${g.passed}/${g.total} 检查点</span>`).join('')}</div></section>`;
}
