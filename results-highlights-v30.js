// v30: clear stale WIN/LOSE overlays before a new countdown and show ranked match highlights after 1v1 games.
(() => {
  const $ = id => document.getElementById(id);
  let roundStartRank = null;
  let resultTimer = null;
  let lastResultKey = '';

  function rankSnapshot(){
    try {
      const r = window.getTetrisRank?.();
      return r ? {rank:Number(r.rank||1), stars:Number(r.stars||0), goal:Number(r.goal||5), title:String(r.title||'Newbie')} : null;
    } catch { return null; }
  }

  function totalRankXP(r){
    if(!r) return 0;
    let xp = 0;
    for(let rank=1; rank<Math.max(1,Number(r.rank||1)); rank++) xp += (rank>=101?50:5)*100;
    xp += Math.max(0,Number(r.stars||0))*100;
    return xp;
  }

  function clearBoardResults(){
    document.querySelectorAll('.board-result-overlay').forEach(el=>el.remove());
    clearTimeout(resultTimer);
    $('duelHighlightPanel')?.classList.add('hidden');
    $('partyResultPanel')?.classList.add('hidden');
    lastResultKey='';
  }

  // Capture rank state at the real beginning of every round.
  const priorStartGame = startGame;
  startGame = function(...args){
    clearBoardResults();
    roundStartRank = rankSnapshot();
    return priorStartGame.apply(this,args);
  };

  function ensurePanel(){
    let panel=$('duelHighlightPanel');
    if(panel) return panel;
    panel=document.createElement('section');
    panel.id='duelHighlightPanel';
    panel.className='duel-highlight-panel hidden';
    panel.innerHTML=`
      <div class="duel-highlight-card">
        <div class="result-burst" id="duelResultBurst">★</div>
        <p class="duel-result-kicker">MATCH RESULTS</p>
        <h2 id="duelHighlightTitle">YOU WIN</h2>
        <div class="xp-result-block">
          <span id="duelXpLabel">RANK XP</span>
          <strong id="duelXpDelta">+100 XP</strong>
          <div class="xp-progress"><i id="duelXpProgress"></i></div>
          <small id="duelXpSub">300 / 500 XP toward the next rank</small>
        </div>
        <div class="duel-highlight-grid">
          <div><span>KO</span><strong id="resultKO">0</strong></div>
          <div><span>LINES SENT</span><strong id="resultLines">0</strong></div>
          <div><span>SCORE</span><strong id="resultScore">0</strong></div>
          <div><span>WIN STREAK</span><strong id="resultStreak">0</strong></div>
        </div>
        <div class="result-rank-line"><b id="resultRank">RANK 1 · NEWBIE</b><span id="resultStars">★ 0 / 5</span></div>
        <button id="duelResultContinue" type="button">CONTINUE</button>
      </div>`;
    document.body.appendChild(panel);
    $('duelResultContinue').addEventListener('click',()=>panel.classList.add('hidden'));
    return panel;
  }

  function formatSigned(n){ return `${n>0?'+':''}${n.toLocaleString()} XP`; }

  function showDuelHighlights(result){
    if(gameMode!=='duel') return;
    const panel=ensurePanel();
    const after=rankSnapshot() || roundStartRank || {rank:1,stars:0,goal:5,title:'Newbie'};
    const before=roundStartRank || after;
    const delta=totalRankXP(after)-totalRankXP(before);
    const currentXP=Math.max(0,Number(after.stars||0))*100;
    const goalXP=Math.max(1,Number(after.goal||5))*100;
    const maxed=String(after.title)==='God of Tetris';
    const kos=Number(window.TBBattle?.myKO || $('myKO')?.textContent || 0);
    const lines=Number(window.TBBattle?.totalSent || 0);
    const streak=typeof winStreak!=='undefined' ? Number(winStreak||0) : Number(localStorage.getItem('tb_streak')||0);

    panel.classList.remove('win','lose');
    panel.classList.add(result==='win'?'win':'lose');
    $('duelHighlightTitle').textContent=result==='win'?'YOU WIN':'YOU LOSE';
    $('duelResultBurst').textContent=result==='win'?'♛':'✦';
    $('duelXpLabel').textContent=maxed?'MAX RANK':'RANK XP CHANGE';
    $('duelXpDelta').textContent=maxed?'MAX':formatSigned(delta);
    $('duelXpDelta').classList.toggle('negative',delta<0);
    $('duelXpProgress').style.width=maxed?'100%':`${Math.min(100,(currentXP/goalXP)*100)}%`;
    $('duelXpSub').textContent=maxed?'God of Tetris achieved':`${currentXP.toLocaleString()} / ${goalXP.toLocaleString()} XP at this rank`;
    $('resultKO').textContent=kos;
    $('resultLines').textContent=lines;
    $('resultScore').textContent=Number(score||0).toLocaleString();
    $('resultStreak').textContent=streak;
    $('resultRank').textContent=`RANK ${after.rank} · ${String(after.title).toUpperCase()}`;
    $('resultStars').textContent=maxed?'★ MAX':`★ ${after.stars} / ${after.goal}`;
    panel.classList.remove('hidden');
  }

  function onResultTitle(){
    const title=String($('overlayTitle')?.textContent||'').trim().toUpperCase();
    if(['READY','READY?','3','2','1','GO!','GO'].includes(title)){
      clearBoardResults();
      return;
    }
    if(gameMode!=='duel' || !['YOU WIN','YOU LOSE'].includes(title)) return;
    const key=`${title}-${Date.now()>>8}`;
    if(lastResultKey===key) return;
    lastResultKey=key;
    clearTimeout(resultTimer);
    // Let the large board WIN/LOSE message land first, then reveal the detailed result card.
    resultTimer=setTimeout(()=>showDuelHighlights(title==='YOU WIN'?'win':'lose'),850);
  }

  // Clear immediately when a new match is initiated, before the countdown animation begins.
  ['startBtn','readyBtn','hostStartBtn'].forEach(id=>{
    document.addEventListener('click',e=>{ if(e.target?.id===id) clearBoardResults(); },true);
  });

  const title=$('overlayTitle');
  if(title) new MutationObserver(onResultTitle).observe(title,{childList:true,characterData:true,subtree:true});

  const field=$('fieldCountValue');
  if(field) new MutationObserver(()=>{
    const word=String(field.textContent||'').trim().toUpperCase();
    if(['READY','READY?','3','2','1','GO!','GO'].includes(word)) clearBoardResults();
  }).observe(field,{childList:true,characterData:true,subtree:true});

  const style=document.createElement('style');
  style.textContent=`
    .duel-highlight-panel{position:fixed;inset:0;z-index:14500;display:grid;place-items:center;padding:18px;background:rgba(7,8,28,.78);backdrop-filter:blur(8px)}
    .duel-highlight-panel.hidden{display:none!important}
    .duel-highlight-card{width:min(560px,95vw);padding:23px;border-radius:25px;text-align:center;background:linear-gradient(180deg,#3a3082,#211d59 38%,#141536);border:2px solid #6cdfff;box-shadow:0 26px 75px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.15)}
    .duel-highlight-panel.win .duel-highlight-card{border-color:#ffe873;box-shadow:0 26px 75px rgba(0,0,0,.58),0 0 34px rgba(255,224,84,.14),inset 0 1px rgba(255,255,255,.15)}
    .duel-highlight-panel.lose .duel-highlight-card{border-color:#ff7696}
    .result-burst{width:58px;height:58px;margin:0 auto 8px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(145deg,#ffe96d,#f3a33f);color:#472352;font-size:30px;font-weight:1000;box-shadow:0 6px 0 #8c4e43,0 0 22px rgba(255,222,83,.25)}
    .duel-highlight-panel.lose .result-burst{background:linear-gradient(145deg,#ff7a9d,#d84979);color:#fff;box-shadow:0 6px 0 #7b2d5a}
    .duel-result-kicker{margin:0;color:#8deaff;font-size:9px;font-weight:1000;letter-spacing:.2em}.duel-highlight-card h2{margin:3px 0 14px;color:#fff07a;font-size:35px;line-height:1;font-weight:1000;text-shadow:0 4px 0 rgba(0,0,0,.28)}.duel-highlight-panel.lose h2{color:#ff91aa}
    .xp-result-block{padding:13px;border-radius:16px;background:#171742;border:1px solid #474397}.xp-result-block>span{display:block;color:#9892cb;font-size:8px;font-weight:1000;letter-spacing:.13em}.xp-result-block>strong{display:block;margin:3px 0 8px;color:#72eeff;font-size:28px;font-weight:1000}.xp-result-block>strong.negative{color:#ff8aa7}.xp-progress{height:10px;border-radius:999px;overflow:hidden;background:#090b29;border:1px solid #403c82}.xp-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,#54e5ff,#9b6cff,#ff66bd);transition:width .55s ease}.xp-result-block small{display:block;margin-top:6px;color:#aba5d7;font-size:9px}
    .duel-highlight-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}.duel-highlight-grid>div{padding:9px 5px;border-radius:13px;background:linear-gradient(180deg,#2d2868,#1a1947);border:1px solid #4d4891}.duel-highlight-grid span{display:block;color:#aaa4d6;font-size:7px;font-weight:1000;letter-spacing:.08em}.duel-highlight-grid strong{display:block;margin-top:3px;color:#fff;font-size:21px}.duel-highlight-grid>div:nth-child(1) strong{color:#ff809c}.duel-highlight-grid>div:nth-child(2) strong{color:#63e8ff}.duel-highlight-grid>div:nth-child(4) strong{color:#ffe56f}
    .result-rank-line{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 11px;border-radius:12px;background:#191944;border:1px solid #3f3c80;color:#fff}.result-rank-line b{font-size:10px}.result-rank-line span{color:#ffe56e;font-size:10px;font-weight:1000}.duel-highlight-card button{width:100%;margin-top:12px;padding:12px;border-radius:12px;background:linear-gradient(180deg,#61eaff,#3d8df0);border:1px solid #b7f8ff;color:#10275d;font-weight:1000;box-shadow:0 4px 0 #245ba8}
    @media(max-width:560px){.duel-highlight-grid{grid-template-columns:repeat(2,1fr)}.duel-highlight-card{padding:17px}.duel-highlight-card h2{font-size:30px}}
  `;
  document.head.appendChild(style);

  roundStartRank=rankSnapshot();
})();
