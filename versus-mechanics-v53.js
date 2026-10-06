// v53: modern KO Blocks versus rules.
// Attack table: Single 0, Double 1, Triple 2, Tetris 4, T-Spin 2/4/6,
// Perfect Clear +10, B2B +1, combo ladder 0/1/1/2/2/3/3/4/4/5.
(() => {
  const $ = id => document.getElementById(id);

  const BASE_ATTACK={single:0,double:1,triple:2,tetris:4,tspin1:2,tspin2:4,tspin3:6};
  const comboBonus=c=>c>=10?5:c>=8?4:c>=6?3:c>=4?2:c>=2?1:0;
  const freshState=()=>({consecutive:0,b2b:false});

  function resolveClear(lines,{tSpin=false,perfect=false,state}={}){
    state=state||freshState();
    lines=Math.max(0,Number(lines)||0);
    if(!lines){state.consecutive=0;return{lines:0,combo:0,comboBonus:0,base:0,b2bBonus:0,perfectBonus:0,attack:0,difficult:false,tSpin:false,perfect:false,label:''};}
    state.consecutive+=1;
    const combo=Math.max(0,state.consecutive-1);
    const difficult=!!tSpin||lines===4;
    const key=tSpin?`tspin${Math.min(3,lines)}`:lines===1?'single':lines===2?'double':lines===3?'triple':'tetris';
    const base=Number(BASE_ATTACK[key]||0);
    const b2bBonus=difficult&&state.b2b?1:0;
    const cBonus=comboBonus(combo);
    const perfectBonus=perfect?10:0;
    const attack=base+b2bBonus+cBonus+perfectBonus;
    // No-clear pieces preserve B2B; basic Single/Double/Triple clears break it.
    state.b2b=difficult;
    const label=tSpin?`T-SPIN ${lines===1?'SINGLE':lines===2?'DOUBLE':'TRIPLE'}`:lines===4?'TETRIS':lines===3?'TRIPLE':lines===2?'DOUBLE':'SINGLE';
    return{lines,combo,comboBonus:cBonus,base,b2bBonus,perfectBonus,attack,difficult,tSpin:!!tSpin,perfect:!!perfect,label};
  }
  window.KOVersusRules={BASE_ATTACK,comboBonus,resolveClear};

  let localState=freshState(),aiState=freshState();
  let localSent=0,aiSent=0,aiScore=0,pendingAIAttack=0;
  let currentClearOverride=null,lastActionRotate=false;
  let localIncoming=[],aiIncoming=[];
  const remoteSent=new Map();
  const localId=()=>String(window.TBMultiplayer?.playerId||'local');
  const randomHole=()=>Math.floor(Math.random()*10);
  const totalQueued=q=>q.reduce((n,b)=>n+Math.max(0,Number(b.lines)||0),0);

  function queueBatch(queue,lines,fromId='',fromName=''){
    lines=Math.max(0,Number(lines)||0);if(!lines)return;
    queue.push({lines,hole:randomHole(),fromId:String(fromId||''),fromName:String(fromName||'')});
  }
  function cancelQueue(queue,attack){
    let power=Math.max(0,Number(attack)||0),cancelled=0;
    while(power>0&&queue.length){const b=queue[0],hit=Math.min(power,b.lines);b.lines-=hit;power-=hit;cancelled+=hit;if(b.lines<=0)queue.shift();}
    return{outbound:power,cancelled};
  }
  function addBatchToLocal(batch){
    let overflow=false;const hole=Math.max(0,Math.min(9,Number(batch.hole)||0));
    for(let i=0;i<batch.lines;i++){if(board[0]?.some(Boolean))overflow=true;board.shift();board.push(Array.from({length:10},(_,x)=>x===hole?'':'G'));}
    if(typeof COLORS!=='undefined')COLORS.G=COLORS.G||'#777177';
    try{draw();}catch{}
    return overflow;
  }
  function applyLocalIncoming(){
    if(!localIncoming.length)return;let overflow=false;
    while(localIncoming.length){if(addBatchToLocal(localIncoming.shift()))overflow=true;}
    updateIncomingUI();
    if(overflow){try{endGame('lose');}catch{}}
  }

  const nativeDispatch=window.dispatchEvent.bind(window);
  let aiTankTimer=0;
  function scheduleAITank(){
    clearTimeout(aiTankTimer);
    aiTankTimer=setTimeout(()=>{
      if(!aiIncoming.length||!window.TBAIMode)return;
      while(aiIncoming.length){const b=aiIncoming.shift();nativeDispatch(new CustomEvent('tb-ai-garbage',{detail:{lines:b.lines,koV53Applied:true}}));}
    },2600);
  }

  function updateIncomingUI(){
    const n=totalQueued(localIncoming);
    if($('incomingCount'))$('incomingCount').textContent=n;
    if($('incomingMeter'))$('incomingMeter').style.width=`${Math.min(100,n*8)}%`;
    let strip=$('koIncomingStrip');
    if(!strip&&$('arenaCard')){strip=document.createElement('div');strip.id='koIncomingStrip';strip.className='ko-incoming-strip hidden';strip.innerHTML='<span>INCOMING</span><strong>0</strong><small>clear lines to cancel</small>';$('arenaCard').appendChild(strip);}
    if(strip){strip.classList.toggle('hidden',n<=0);strip.querySelector('strong').textContent=n;}
  }

  // T-Spin = T piece, last successful manipulation was a rotation, 3+ pivot corners occupied.
  function tPivot(piece){
    if(!piece||piece.type!=='T'||!Array.isArray(piece.shape))return null;
    let best=null,bestN=-1;
    for(let y=0;y<piece.shape.length;y++)for(let x=0;x<piece.shape[y].length;x++){
      if(!piece.shape[y][x])continue;
      const n=[[1,0],[-1,0],[0,1],[0,-1]].reduce((s,[dx,dy])=>s+(piece.shape[y+dy]?.[x+dx]?1:0),0);
      if(n>bestN){bestN=n;best={x:piece.x+x,y:piece.y+y};}
    }
    return best;
  }
  function detectTSpin(){
    if(!lastActionRotate||!current||current.type!=='T')return false;
    const p=tPivot(current);if(!p)return false;
    const occupied=(x,y)=>x<0||x>=10||y<0||y>=20||!!board[y]?.[x];
    return[[-1,-1],[1,-1],[-1,1],[1,1]].filter(([dx,dy])=>occupied(p.x+dx,p.y+dy)).length>=3;
  }
  if(typeof rotate==='function'){
    const prior=rotate;rotate=function(...a){const before=current?`${current.x}|${JSON.stringify(current.shape)}`:'';const out=prior.apply(this,a);const after=current?`${current.x}|${JSON.stringify(current.shape)}`:'';if(before&&after&&before!==after)lastActionRotate=true;return out;};
  }
  if(typeof move==='function'){
    const prior=move;move=function(...a){const x=current?.x;const out=prior.apply(this,a);if(current&&current.x!==x)lastActionRotate=false;return out;};
  }
  if(typeof softDrop==='function'){
    const prior=softDrop;softDrop=function(...a){const y=current?.y;const out=prior.apply(this,a);if(current&&current.y!==y)lastActionRotate=false;return out;};
  }
  window.addEventListener('tb-hold-change',()=>{lastActionRotate=false;});
  if(typeof lockPiece==='function'){
    const prior=lockPiece;lockPiece=function(...a){window.KOVersusClearContext={tSpin:detectTSpin()};const out=prior.apply(this,a);window.KOVersusClearContext=null;lastActionRotate=false;return out;};
  }

  const fxLayer=document.createElement('div');fxLayer.id='koSpecialFxLayer';fxLayer.className='ko-special-fx-layer';document.body.appendChild(fxLayer);
  function showSpecial(res,{cancelled=0,outbound=0,scoreDelta=0}={}){
    if(!res||!res.lines)return;
    const special=res.tSpin||res.perfect||res.difficult||res.combo>=1||res.b2bBonus>0;if(!special)return;
    const bits=[res.perfect?'PERFECT CLEAR':res.label];
    if(res.b2bBonus)bits.push('BACK-TO-BACK');
    if(res.combo>0)bits.push(`${res.combo}-COMBO`);
    const sub=[];if(res.attack>0)sub.push(`${res.attack} attack`);if(cancelled>0)sub.push(`${cancelled} cancelled`);if(outbound>0)sub.push(`${outbound} sent`);if(scoreDelta>0)sub.push(`+${scoreDelta.toLocaleString()} pts`);
    const tier=res.perfect||res.tSpin||res.attack>=6?4:res.combo>=5?3:res.combo>=2?2:1;
    const el=document.createElement('div');el.className=`ko-special-fx tier-${tier}`;el.innerHTML=`<strong>${bits.join(' · ')}</strong><span>${sub.join(' · ')}</span>`;fxLayer.appendChild(el);
    const tile=$('localLiveTile')||$('arenaCard');tile?.classList.remove('ko-combo-impact');void tile?.offsetWidth;tile?.classList.add('ko-combo-impact');
    if(typeof tone==='function'&&typeof sfxOn!=='undefined'&&sfxOn){const root=720+tier*130;tone(root,.10,'triangle',.075,0,'sfx');tone(root*1.25,.13,'sine',.07,.06,'sfx');}
    setTimeout(()=>el.remove(),1250);setTimeout(()=>tile?.classList.remove('ko-combo-impact'),650);
  }

  function sendFallback(lines,ov){
    if(lines<=0)return;
    if(ov.mode==='duel'&&window.TBAIMode){
      localSent+=lines;ov.sent=true;queueBatch(aiIncoming,lines,'local',$('playerName')?.value||'Player');scheduleAITank();exposeStats();return;
    }
    if(!window.TBMultiplayer?.room)return;
    if(ov.mode==='duel'){
      localSent+=lines;ov.sent=true;exposeStats();
      TBMultiplayer.send('ko_garbage_v53',{lines,totalSent:localSent,fromName:$('playerName')?.value||'Player'});
    }
  }

  if(typeof clearLines==='function'){
    const prior=clearLines;
    clearLines=function(...a){
      const lines=Array.isArray(board)?board.reduce((n,row)=>n+(row.every(Boolean)?1:0),0):0;
      const ctx=window.KOVersusClearContext||{};
      const perfect=lines>0&&board.every(row=>row.every(Boolean)||row.every(cell=>!cell));
      const res=resolveClear(lines,{tSpin:!!ctx.tSpin,perfect,state:localState});
      const defence=cancelQueue(localIncoming,res.attack);
      currentClearOverride={mode:gameMode,res,outbound:defence.outbound,cancelled:defence.cancelled,sent:false};
      const beforeScore=Number(typeof score!=='undefined'?score:0);
      const out=prior.apply(this,a);
      const afterScore=Number(typeof score!=='undefined'?score:0);
      if((gameMode==='duel'||gameMode==='party')&&lines>0&&!currentClearOverride.sent&&currentClearOverride.outbound>0)sendFallback(currentClearOverride.outbound,currentClearOverride);
      if(!lines)applyLocalIncoming();
      updateIncomingUI();showSpecial(res,{cancelled:defence.cancelled,outbound:defence.outbound,scoreDelta:Math.max(0,afterScore-beforeScore)});
      currentClearOverride=null;
      if((gameMode==='duel'||gameMode==='party')&&typeof attack!=='undefined')attack=localSent;
      try{updateHud();}catch{}
      return out;
    };
  }

  if(window.TBMultiplayer&&typeof TBMultiplayer.send==='function'){
    const priorSend=TBMultiplayer.send.bind(TBMultiplayer);
    TBMultiplayer.send=function(type,payload={}){
      if(type==='garbage'&&currentClearOverride?.mode==='duel'){
        const n=currentClearOverride.outbound;currentClearOverride.sent=true;if(n<=0)return;
        localSent+=n;exposeStats();
        return priorSend('ko_garbage_v53',{...payload,lines:n,totalSent:localSent,fromName:$('playerName')?.value||'Player'});
      }
      if(type==='party_garbage'&&currentClearOverride?.mode==='party'){
        const n=currentClearOverride.outbound;currentClearOverride.sent=true;if(n<=0)return;
        localSent+=n;exposeStats();
        return priorSend('ko_party_garbage_v53',{...payload,lines:n,totalSent:localSent,fromName:payload.fromName||$('playerName')?.value||'Player'});
      }
      if(type==='party_final_stats')payload={...payload,linesSent:localSent};
      if(type==='party_round_result'&&Array.isArray(payload?.leaderboard))payload={...payload,leaderboard:payload.leaderboard.map(r=>String(r.id)===localId()?{...r,linesSent:localSent,score:Number(typeof score!=='undefined'?score:r.score||0)}:r)};
      return priorSend(type,payload);
    };
    TBMultiplayer.onMessage(msg=>{
      const p=msg.payload||{};
      if(msg.type==='ko_garbage_v53'&&gameMode==='duel'){
        queueBatch(localIncoming,p.lines,msg.playerId,p.fromName||'Rival');remoteSent.set(String(msg.playerId||'rival'),Number(p.totalSent||0));updateIncomingUI();
      }
      if(msg.type==='ko_party_garbage_v53'&&gameMode==='party'&&String(p.targetId)===localId()){
        queueBatch(localIncoming,p.lines,msg.playerId,p.fromName||'Player');remoteSent.set(String(msg.playerId||''),Number(p.totalSent||0));updateIncomingUI();
      }
    });
  }

  // Intercept legacy player->AI garbage. Count the authoritative outbound amount once and queue it.
  window.dispatchEvent=function(event){
    if(event?.type==='tb-ai-garbage'&&window.TBAIMode&&!event.detail?.koV53Applied){
      const n=currentClearOverride?currentClearOverride.outbound:Number(event.detail?.lines||0);
      if(currentClearOverride)currentClearOverride.sent=true;
      if(n>0){localSent+=n;queueBatch(aiIncoming,n,'local',$('playerName')?.value||'Player');scheduleAITank();exposeStats();}
      return true;
    }
    return nativeDispatch(event);
  };

  // AI sends its resolved attack, not simply the number of rows it cleared.
  if(window.TBBattle?.aiAttack){
    window.TBBattle.aiAttack=function(){const n=Math.max(0,Number(pendingAIAttack)||0);pendingAIAttack=0;if(n>0){queueBatch(localIncoming,n,'ai','AI Rival');aiSent+=n;updateIncomingUI();exposeStats();}};
  }
  window.addEventListener('tb-ai-lines',event=>{
    const lines=Math.max(0,Number(event.detail?.cleared)||0),total=Math.max(0,Number(event.detail?.total)||0);
    if(total===0&&!lines){aiState=freshState();aiSent=0;aiScore=0;pendingAIAttack=0;aiIncoming=[];clearTimeout(aiTankTimer);exposeStats();return;}
    if(!lines)return;
    const res=resolveClear(lines,{tSpin:false,perfect:false,state:aiState});
    const defence=cancelQueue(aiIncoming,res.attack);pendingAIAttack=defence.outbound;
    const base=[0,100,300,500,800][Math.min(4,lines)]||800;aiScore+=base+res.combo*75;
    if(aiIncoming.length)scheduleAITank();else clearTimeout(aiTankTimer);
    exposeStats();
  });

  function patchAIRecap(){
    const row=[...document.querySelectorAll('#duelRoundRanking .ranking-row')].find(r=>/AI\s*RIVAL/i.test(r.querySelector('span')?.textContent||''));if(!row)return;
    const stats=row.querySelectorAll('em');if(stats[1])stats[1].innerHTML=`<small>LINES SENT</small>${aiSent}`;if(stats[2])stats[2].innerHTML=`<small>SCORE</small>${aiScore.toLocaleString()}`;
  }
  function exposeStats(){
    window.TBAIStats=window.TBAIStats||{};window.TBAIStats.linesSent=aiSent;window.TBAIStats.score=aiScore;
    window.KOVersusStats={localSent,aiSent,aiScore,localIncoming:totalQueued(localIncoming),aiIncoming:totalQueued(aiIncoming),remoteSent};
    try{if(window.TBBattle)Object.defineProperty(window.TBBattle,'totalSent',{configurable:true,get:()=>localSent});}catch{}
    try{if(window.TBPartyBattle)Object.defineProperty(window.TBPartyBattle,'localLinesSent',{configurable:true,get:()=>localSent});}catch{}
    const tile=$('live-ai-rival');if(tile){const sent=tile.querySelector('.hold-sent-value');if(sent)sent.textContent=aiSent;const small=tile.querySelector('.live-player-head small');if(small)small.textContent=`${aiScore.toLocaleString()} pts · CPU`;const status=tile.querySelector('.remote-status-row b');if(status)status.textContent=`${aiScore.toLocaleString()} pts`;}
    patchAIRecap();
  }

  // Match resolution hierarchy: KO -> actual Lines Sent -> Score -> legacy final fallback.
  function activeDuelRemote(){
    if(!window.TBLiveGrid?.remotes)return null;const now=Date.now();
    return[...TBLiveGrid.remotes.entries()].find(([,p])=>p?.mode==='duel'&&now-Number(p.seen||0)<7000)||null;
  }
  if(typeof endGame==='function'){
    const prior=endGame;
    endGame=function(reason){
      if(reason==='time'&&gameMode==='duel'&&gameRunning){
        const myKO=Number((window.TBBattle?.myKO ?? $('myKO')?.textContent) || 0);
        const rivalKO=Number((window.TBBattle?.rivalKO ?? $('rivalKO')?.textContent) || 0);
        let rivalSent=0,rivalScore=null;
        if(window.TBAIMode){rivalSent=aiSent;rivalScore=aiScore;}else{const r=activeDuelRemote();rivalSent=Number(r?.[1]?.totalSent||0);rivalScore=r?Number(r[1]?.score||0):null;}
        const myScore=Number(typeof score!=='undefined'?score:0);let forced=null,why='';
        if(myKO===rivalKO&&localSent!==rivalSent){forced=localSent>rivalSent?'win':'lose';why='Lines Sent';}
        else if(myKO===rivalKO&&localSent===rivalSent&&rivalScore!=null&&myScore!==rivalScore){forced=myScore>rivalScore?'win':'lose';why='Score';}
        if(forced){try{toast(forced==='win'?'TIEBREAK WIN!':'TIEBREAK LOSS',`${why} decided the round`);}catch{}return prior(forced);}
      }
      return prior(reason);
    };
  }

  if(typeof startGame==='function'){
    const prior=startGame;
    startGame=function(...a){localState=freshState();localSent=0;localIncoming=[];lastActionRotate=false;if(window.TBAIMode){aiState=freshState();aiSent=0;aiScore=0;aiIncoming=[];pendingAIAttack=0;clearTimeout(aiTankTimer);}const out=prior.apply(this,a);exposeStats();updateIncomingUI();return out;};
  }

  const style=document.createElement('style');
  style.textContent=`
    .ko-incoming-strip{position:absolute;right:12px;top:82px;z-index:42;min-width:104px;padding:7px 9px;border-radius:11px;background:linear-gradient(180deg,#77304e,#461f3c);border:1px solid #ff809e;text-align:center;box-shadow:0 5px 18px rgba(0,0,0,.3)}.ko-incoming-strip.hidden{display:none!important}.ko-incoming-strip span,.ko-incoming-strip small{display:block;color:#ffc2d0;font-size:7px;font-weight:1000;letter-spacing:.1em}.ko-incoming-strip strong{display:block;color:#fff;font-size:23px;line-height:1.05}
    .ko-special-fx-layer{position:fixed;inset:0;z-index:14950;pointer-events:none;display:grid;place-items:center;overflow:hidden}.ko-special-fx{position:absolute;top:18%;max-width:min(92vw,520px);padding:13px 20px;border-radius:17px;text-align:center;background:linear-gradient(180deg,rgba(43,38,106,.97),rgba(17,18,52,.97));border:2px solid #70e8ff;box-shadow:0 16px 44px rgba(0,0,0,.46),0 0 30px rgba(92,224,255,.24);animation:koSpecialPop 1.25s ease both}.ko-special-fx strong{display:block;color:#fff;font-size:clamp(20px,4vw,36px);font-weight:1000;text-shadow:0 3px 0 rgba(0,0,0,.28)}.ko-special-fx span{display:block;margin-top:4px;color:#8cecff;font-size:11px;font-weight:1000}.ko-special-fx.tier-2{border-color:#a98aff}.ko-special-fx.tier-3{border-color:#ff82c9;box-shadow:0 16px 44px rgba(0,0,0,.46),0 0 40px rgba(255,91,188,.3)}.ko-special-fx.tier-4{border-color:#ffe66d;background:linear-gradient(180deg,rgba(104,61,129,.98),rgba(34,26,75,.98));box-shadow:0 16px 44px rgba(0,0,0,.46),0 0 48px rgba(255,225,89,.38)}.ko-special-fx.tier-4 strong{color:#fff17d}.ko-special-fx.tier-4 span{color:#fff}
    @keyframes koSpecialPop{0%{opacity:0;transform:translateY(28px) scale(.68)}22%{opacity:1;transform:translateY(0) scale(1.1)}72%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-34px) scale(.93)}}.ko-combo-impact{animation:koImpact53 .62s ease!important}@keyframes koImpact53{0%,100%{filter:none}28%{filter:brightness(1.2) saturate(1.25);transform:scale(1.008)}55%{filter:brightness(1.08)}}
    @media(max-width:720px){.ko-incoming-strip{top:66px;right:6px;min-width:78px;padding:5px}.ko-incoming-strip strong{font-size:18px}.ko-special-fx{top:12%;padding:10px 14px}}
  `;document.head.appendChild(style);

  setInterval(()=>{if(window.TBAIMode&&!game?.classList.contains('hidden'))exposeStats();},350);
  new MutationObserver(()=>{if(window.TBAIMode)patchAIRecap();}).observe(document.body,{childList:true});
  exposeStats();updateIncomingUI();
})();
