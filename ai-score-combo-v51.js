// v51: AI score tracking, score tiebreak, and stronger combo/scoring feedback.
(() => {
  const $ = id => document.getElementById(id);
  let aiScore = 0;
  let lastAIEventTotal = 0;

  function num(v){ return Number(v || 0); }
  function activeDuelRemote(){
    if(!window.TBLiveGrid?.remotes) return null;
    const now = Date.now();
    return [...TBLiveGrid.remotes.entries()].find(([,p]) => p?.mode === 'duel' && now - num(p.seen) < 7000) || null;
  }

  function exposeAI(){
    window.TBAIStats = window.TBAIStats || {};
    window.TBAIStats.score = aiScore;
    window.TBAIStats.linesSent = num(window.TBAIStats.linesSent);
    window.KODuelStats = window.KODuelStats || {};
    window.KODuelStats.aiScore = aiScore;
    patchAIVisuals();
    patchAIRecap();
  }

  function patchAIVisuals(){
    const tile = $('live-ai-rival');
    if(!tile) return;
    const small = tile.querySelector('.live-player-head small');
    if(small) small.textContent = `${aiScore.toLocaleString()} pts · CPU`;
    const status = tile.querySelector('.remote-status-row b');
    if(status) status.textContent = `${aiScore.toLocaleString()} pts`;
  }

  function patchAIRecap(){
    const rows = [...document.querySelectorAll('#duelRoundRanking .ranking-row')];
    const row = rows.find(r => /AI\s*RIVAL/i.test(r.querySelector('span')?.textContent || ''));
    if(!row) return;
    const stats = row.querySelectorAll('em');
    const scoreCell = stats[stats.length - 1];
    if(scoreCell) scoreCell.innerHTML = `<small>SCORE</small>${aiScore.toLocaleString()}`;
  }

  // The AI already emits its real cleared-line total. Give those clears a real score too.
  // We intentionally score only real clears here: Single 100, Double 300, Triple 500, Tetris 800.
  window.addEventListener('tb-ai-lines', event => {
    const total = num(event.detail?.total);
    const cleared = num(event.detail?.cleared);
    if(total === 0 && !cleared){
      aiScore = 0;
      lastAIEventTotal = 0;
    } else if(cleared > 0){
      const base = [0,100,300,500,800][Math.min(4,cleared)] || 800;
      aiScore += base;
      lastAIEventTotal = total;
    } else {
      lastAIEventTotal = total;
    }
    exposeAI();
  });

  // New AI battle = fresh rival score.
  document.addEventListener('click', event => {
    if(event.target?.closest?.('#battleAIBtn') || (window.TBAIMode && event.target?.closest?.('#startBtn,#duelResultAnother'))){
      aiScore = 0;
      lastAIEventTotal = 0;
      exposeAI();
    }
  }, true);

  // Score is the next 1v1 tiebreak after KO and Lines Sent. If score also ties,
  // the existing lower-stack tiebreak remains the final fallback.
  if(typeof endGame === 'function'){
    const priorEndGame = endGame;
    endGame = function(reason){
      if(reason === 'time' && gameMode === 'duel' && gameRunning){
        const myKO = num(window.TBBattle?.myKO ?? $('myKO')?.textContent);
        const rivalKO = num(window.TBBattle?.rivalKO ?? $('rivalKO')?.textContent);
        const mySent = num(window.TBBattle?.totalSent);
        let rivalSent = 0;
        let rivalScore = null;
        if(window.TBAIMode){
          rivalSent = num(window.TBAIStats?.linesSent);
          rivalScore = num(window.TBAIStats?.score);
        } else {
          const remote = activeDuelRemote();
          rivalSent = num(remote?.[1]?.totalSent);
          rivalScore = remote ? num(remote[1]?.score) : null;
        }
        const myScore = num(typeof score !== 'undefined' ? score : 0);
        if(myKO === rivalKO && mySent === rivalSent && rivalScore != null && myScore !== rivalScore){
          const win = myScore > rivalScore;
          try {
            if(!window.TBAIMode && window.TBMultiplayer?.room){
              window.TBMultiplayer.send?.('match_end', {
                result: win ? 'win' : 'lose', myKO, rivalKO, score: myScore,
                totalSent: mySent, reason: 'score-tiebreak'
              });
            }
          } catch {}
          if(typeof toast === 'function') toast(win ? 'TIEBREAK WIN!' : 'TIEBREAK LOSS', `Score ${myScore.toLocaleString()} vs ${rivalScore.toLocaleString()}`);
          return priorEndGame(win ? 'win' : 'lose');
        }
      }
      return priorEndGame(reason);
    };
  }

  // Stronger local scoring feedback. This does not invent hidden attack bonuses;
  // it surfaces the score that the engine is already awarding for clears, combos and perfect clears.
  const fxLayer = document.createElement('div');
  fxLayer.id = 'scoreTriggerLayer';
  fxLayer.className = 'score-trigger-layer';
  document.body.appendChild(fxLayer);

  function triggerScoreFX(label, delta, level = 1){
    const card = document.createElement('div');
    card.className = `score-trigger score-trigger-${Math.min(4,Math.max(1,level))}`;
    card.innerHTML = `<strong>${label}</strong><span>+${Math.max(0,delta).toLocaleString()} PTS</span>`;
    fxLayer.appendChild(card);
    const scoreBox = $('score')?.closest('.hud-box');
    scoreBox?.classList.remove('score-pulse');
    void scoreBox?.offsetWidth;
    scoreBox?.classList.add('score-pulse');
    const local = $('localLiveTile') || $('arenaCard');
    local?.classList.remove('combo-impact');
    void local?.offsetWidth;
    local?.classList.add('combo-impact');
    if(typeof tone === 'function' && typeof sfxOn !== 'undefined' && sfxOn){
      const root = 740 + Math.min(5,level) * 110;
      tone(root,.09,'triangle',.07,0,'sfx');
      tone(root*1.25,.11,'sine',.065,.06,'sfx');
    }
    setTimeout(() => card.remove(), 1050);
    setTimeout(() => scoreBox?.classList.remove('score-pulse'), 700);
    setTimeout(() => local?.classList.remove('combo-impact'), 700);
  }

  if(typeof clearLines === 'function'){
    const priorClearLines = clearLines;
    clearLines = function(...args){
      const completed = Array.isArray(board) ? board.reduce((n,row) => n + (row.every(Boolean) ? 1 : 0), 0) : 0;
      const before = num(typeof score !== 'undefined' ? score : 0);
      const out = priorClearLines.apply(this,args);
      if(completed > 0 && gameRunning){
        const after = num(typeof score !== 'undefined' ? score : 0);
        const delta = Math.max(0,after-before);
        const perfect = Array.isArray(board) && board.every(row => row.every(cell => !cell));
        const chain = num(typeof combo !== 'undefined' ? combo : 0) + 1;
        if(perfect) triggerScoreFX('PERFECT CLEAR!', delta, 4);
        else if(completed >= 4) triggerScoreFX('TETRIS!', delta, 4);
        else if(chain >= 5) triggerScoreFX(`${chain}× COMBO · ON FIRE!`, delta, 4);
        else if(chain >= 3) triggerScoreFX(`${chain}× COMBO · HOT STREAK!`, delta, 3);
        else if(chain >= 2) triggerScoreFX(`${chain}× COMBO!`, delta, 2);
        else triggerScoreFX(completed === 3 ? 'TRIPLE!' : completed === 2 ? 'DOUBLE!' : 'LINE CLEAR!', delta, 1);
      }
      return out;
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    .score-trigger-layer{position:fixed;inset:0;z-index:14900;pointer-events:none;display:grid;place-items:center;overflow:hidden}
    .score-trigger{position:absolute;top:23%;min-width:190px;padding:12px 18px;border-radius:16px;text-align:center;background:linear-gradient(180deg,rgba(42,36,104,.97),rgba(19,18,55,.97));border:2px solid #6de9ff;box-shadow:0 14px 38px rgba(0,0,0,.42),0 0 28px rgba(92,224,255,.24);animation:scoreTriggerPop 1.05s ease both}
    .score-trigger strong{display:block;color:#fff;font-size:clamp(20px,4vw,34px);font-weight:1000;letter-spacing:.02em;text-shadow:0 3px 0 rgba(0,0,0,.25)}
    .score-trigger span{display:block;margin-top:3px;color:#7cecff;font-size:12px;font-weight:1000;letter-spacing:.08em}
    .score-trigger-2{border-color:#9d82ff;box-shadow:0 14px 38px rgba(0,0,0,.42),0 0 32px rgba(149,104,255,.28)}
    .score-trigger-3{border-color:#ff7bc8;box-shadow:0 14px 38px rgba(0,0,0,.42),0 0 38px rgba(255,91,188,.32)}
    .score-trigger-4{border-color:#ffe76d;background:linear-gradient(180deg,rgba(105,66,129,.98),rgba(35,27,76,.98));box-shadow:0 14px 38px rgba(0,0,0,.42),0 0 44px rgba(255,224,83,.36)}
    .score-trigger-4 strong{color:#fff17d}.score-trigger-4 span{color:#fff}
    @keyframes scoreTriggerPop{0%{opacity:0;transform:translateY(24px) scale(.7)}25%{opacity:1;transform:translateY(0) scale(1.09)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-28px) scale(.94)}}
    .score-pulse{animation:scorePulse51 .65s ease!important}@keyframes scorePulse51{0%,100%{transform:scale(1)}35%{transform:scale(1.12);box-shadow:0 0 24px rgba(255,229,96,.48)}}
    .combo-impact{animation:comboImpact51 .6s ease!important}@keyframes comboImpact51{0%,100%{filter:none}35%{filter:brightness(1.17) saturate(1.18)}}
  `;
  document.head.appendChild(style);

  // Result panels are created after gameplay; refresh AI score when they appear.
  new MutationObserver(() => {
    if(window.TBAIMode){ patchAIVisuals(); patchAIRecap(); }
  }).observe(document.body,{childList:true,subtree:false});

  exposeAI();
})();
