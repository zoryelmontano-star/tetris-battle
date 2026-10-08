// v50: accurate AI lines-sent stats + opponent/round ranking recaps without polling.
(() => {
  const $ = id => document.getElementById(id);
  let aiLinesSent = 0;
  let lastDuelKey = '';
  let lastPartyPayload = null;

  function num(v){ return Number(v || 0); }
  function esc(v){ const d=document.createElement('div'); d.textContent=String(v ?? ''); return d.innerHTML; }
  function ordinal(n){
    const v=n%100;
    if(v>=11&&v<=13) return `${n}TH`;
    return `${n}${n%10===1?'ST':n%10===2?'ND':n%10===3?'RD':'TH'}`;
  }

  function exposeAI(total){
    aiLinesSent = Math.max(0,num(total));
    window.TBAIStats = window.TBAIStats || {};
    window.TBAIStats.linesSent = aiLinesSent;
    window.KODuelStats = window.KODuelStats || {};
    window.KODuelStats.aiLinesSent = aiLinesSent;
    const aiTile=$('live-ai-rival');
    const sent=aiTile?.querySelector('.hold-sent-value');
    if(sent) sent.textContent=aiLinesSent;
  }

  window.addEventListener('tb-ai-lines', e => exposeAI(e.detail?.total));
  document.addEventListener('click', e => {
    if(e.target?.closest?.('#battleAIBtn') || (window.TBAIMode && e.target?.closest?.('#startBtn'))) exposeAI(0);
  }, true);
  exposeAI(0);

  function activeDuelRemote(){
    if(!window.TBLiveGrid?.remotes) return null;
    const now=Date.now();
    return [...TBLiveGrid.remotes.entries()].find(([,p]) => p?.mode==='duel' && now-num(p.seen)<7000) || null;
  }

  function duelSnapshots(){
    const me={
      id:'local',
      name:($('playerName')?.value || 'You').trim() || 'You',
      ko:num(window.TBBattle?.myKO ?? $('myKO')?.textContent),
      sent:num(window.TBBattle?.totalSent),
      score:num(typeof score!=='undefined' ? score : 0),
      isMe:true
    };
    let rival;
    if(window.TBAIMode){
      rival={id:'ai',name:'AI Rival',ko:num(window.TBBattle?.rivalKO ?? $('rivalKO')?.textContent),sent:aiLinesSent,score:null,isMe:false};
    } else {
      const remote=activeDuelRemote();
      const p=remote?.[1] || {};
      rival={id:remote?.[0] || 'rival',name:p.name || $('rivalName')?.textContent || 'Rival',ko:num(p.ko ?? window.TBBattle?.rivalKO ?? $('rivalKO')?.textContent),sent:num(p.totalSent),score:remote ? num(p.score) : null,isMe:false};
    }
    return [me,rival];
  }

  function duelOrder(title){
    const rows=duelSnapshots();
    if(title==='YOU WIN') return rows;
    if(title==='YOU LOSE') return [rows[1],rows[0]];
    return rows.sort((a,b)=>(b.ko-a.ko)||(b.sent-a.sent)||((b.score??-1)-(a.score??-1)));
  }

  function ensureDuelRanking(){
    const card=$('duelHighlightPanel')?.querySelector('.duel-highlight-card');
    if(!card) return null;
    let box=$('duelRoundRanking');
    if(!box){
      box=document.createElement('section');
      box.id='duelRoundRanking';
      box.className='round-ranking-box';
      const action=card.querySelector('#duelResultAnother,#duelResultContinue,#duelResultQuit');
      if(action) card.insertBefore(box,action); else card.appendChild(box);
    }
    return box;
  }

  function renderDuelRanking(){
    if(gameMode!=='duel') return;
    const title=String($('duelHighlightTitle')?.textContent || $('overlayTitle')?.textContent || '').trim().toUpperCase();
    if(!['YOU WIN','YOU LOSE'].includes(title)) return;
    const rows=duelOrder(title);
    const key=title+'|'+rows.map(r=>`${r.name}:${r.ko}:${r.sent}:${r.score}`).join('|');
    if(key===lastDuelKey && $('duelRoundRanking')) return;
    lastDuelKey=key;
    const box=ensureDuelRanking();
    if(!box) return;
    const leader=rows[0];
    box.innerHTML=`
      <div class="ranking-heading"><span>ROUND RANKING</span><strong>CURRENT TOP PLAYER · ${esc(leader.name)}</strong></div>
      <div class="ranking-table">
        ${rows.map((r,i)=>`<div class="ranking-row ${r.isMe?'you':''} ${i===0?'leader':''}">
          <b>${ordinal(i+1)}</b><span>${esc(r.name)}${r.isMe?' <small>YOU</small>':''}</span>
          <em><small>KO</small>${r.ko}</em><em><small>LINES SENT</small>${r.sent}</em><em><small>SCORE</small>${r.score==null?'—':r.score.toLocaleString()}</em>
        </div>`).join('')}
      </div>`;
    if(window.TBAIMode && window.KOVersusStats){
      const s=window.KOVersusStats;
      const breakdown=document.createElement('div');
      breakdown.className='attack-breakdown';
      breakdown.innerHTML='<span><b>YOU</b> generated '+num(s.localGenerated)+' · cancelled '+num(s.localCancelled)+' · sent '+num(s.localSent)+'</span><span><b>AI</b> generated '+num(s.aiGenerated)+' · cancelled '+num(s.aiCancelled)+' · sent '+num(s.aiSent)+'</span>';
      box.appendChild(breakdown);
    }
  }

  function partyNameScores(){
    const map=new Map();
    const localName=(($('playerName')?.value||'You').trim()||'You').toLowerCase();
    map.set(localName,num(typeof score!=='undefined'?score:0));
    if(window.TBLiveGrid?.remotes){
      for(const [,p] of TBLiveGrid.remotes){ if(p?.mode==='party') map.set(String(p.name||'Player').trim().toLowerCase(),num(p.score)); }
    }
    return map;
  }

  function partyRowsFromPayload(){
    const board=Array.isArray(lastPartyPayload?.leaderboard)?lastPartyPayload.leaderboard:[];
    if(!board.length) return [];
    return board.map((r,i)=>({place:i+1,name:r.name||'Player',ko:num(r.kos),sent:num(r.linesSent),score:num(r.score),wins:null}));
  }

  function partyRowsFromDOM(){
    const scoreMap=partyNameScores();
    return [...document.querySelectorAll('#partyLeaderboard .party-result-row')].map((row,i)=>{
      const name=(row.querySelector('span')?.childNodes?.[0]?.textContent || 'Player').trim();
      const winsText=row.querySelector('strong')?.textContent||'0';
      const em=[...row.querySelectorAll('em')].map(x=>x.textContent||'');
      return {place:i+1,name,wins:num(winsText.replace(/\D/g,'')),ko:num((em[0]||'').replace(/\D/g,'')),sent:num((em[1]||'').replace(/\D/g,'')),score:scoreMap.get(name.toLowerCase()) ?? 0};
    });
  }

  function ensurePartyExtras(){
    const card=$('partyResultPanel')?.querySelector('.party-result-card');
    if(!card) return null;
    let top=$('partyCurrentTop');
    if(!top){
      top=document.createElement('div'); top.id='partyCurrentTop'; top.className='party-current-top';
      const leaderboard=$('partyLeaderboard');
      leaderboard?.insertAdjacentElement('beforebegin',top);
    }
    let label=$('partyRankingLabel');
    if(!label){
      label=document.createElement('div'); label.id='partyRankingLabel'; label.className='party-ranking-label'; label.textContent='ROUND RANKING';
      $('partyLeaderboard')?.insertAdjacentElement('beforebegin',label);
    }
    return {top,label};
  }

  function renderPartyRanking(){
    if(gameMode!=='party' || !$('partyResultPanel') || $('partyResultPanel').classList.contains('hidden')) return;
    const payloadRows=partyRowsFromPayload();
    const domRows=partyRowsFromDOM();
    const rows=payloadRows.length ? payloadRows.map((r,i)=>({...r,wins:domRows[i]?.wins ?? 0})) : domRows;
    if(!rows.length) return;
    const extras=ensurePartyExtras();
    const sessionLeader=[...rows].sort((a,b)=>(num(b.wins)-num(a.wins))||(a.place-b.place))[0];
    extras.top.innerHTML=`<span>CURRENT TOP PLAYER</span><strong>${esc(sessionLeader.name)}</strong><small>${num(sessionLeader.wins)} session win${num(sessionLeader.wins)===1?'':'s'} · ${ordinal(sessionLeader.place)} this round</small>`;

    const leaderboard=$('partyLeaderboard');
    if(!leaderboard) return;
    [...leaderboard.querySelectorAll('.party-result-row')].forEach((row,i)=>{
      const r=rows[i]; if(!r) return;
      const place=row.querySelector('b'); if(place) place.textContent=ordinal(i+1);
      let scoreEl=row.querySelector('.party-result-score');
      if(!scoreEl){scoreEl=document.createElement('em');scoreEl.className='party-result-score';row.appendChild(scoreEl);}
      scoreEl.textContent=`${num(r.score).toLocaleString()} PTS`;
    });
  }

  if(window.TBMultiplayer){
    TBMultiplayer.onMessage(msg=>{
      if(msg.type==='party_round_result'){
        lastPartyPayload=msg.payload||null;
        setTimeout(renderPartyRanking,40);
        setTimeout(renderPartyRanking,180);
      }
    });
  }

  const bodyObserver=new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(!(node instanceof HTMLElement)) continue;
        if(node.id==='duelHighlightPanel') setTimeout(renderDuelRanking,20);
        if(node.id==='partyResultPanel') setTimeout(renderPartyRanking,20);
      }
    }
  });
  bodyObserver.observe(document.body,{childList:true});

  const overlayTitle=$('overlayTitle');
  if(overlayTitle) new MutationObserver(()=>{
    const t=String(overlayTitle.textContent||'').trim().toUpperCase();
    if(gameMode==='duel'&&['YOU WIN','YOU LOSE'].includes(t)){
      setTimeout(renderDuelRanking,900);
      setTimeout(renderDuelRanking,1150);
    }
    if(gameMode==='party'&&['YOU WIN','YOU LOSE'].includes(t)) setTimeout(renderPartyRanking,120);
  }).observe(overlayTitle,{childList:true,characterData:true,subtree:true});

  const style=document.createElement('style');
  style.textContent=`
    .round-ranking-box{margin:11px 0 2px;padding:10px;border-radius:15px;background:#121331;border:1px solid #45417e;text-align:left}
    .ranking-heading{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.ranking-heading span,.party-ranking-label{color:#8eeaff;font-size:8px;font-weight:1000;letter-spacing:.13em}.ranking-heading strong{color:#fff080;font-size:9px;text-align:right}
    .ranking-table{display:grid;gap:5px}.ranking-row{display:grid;grid-template-columns:42px minmax(90px,1fr) 54px 72px 78px;gap:5px;align-items:center;padding:7px;border-radius:10px;background:#1c1c48;border:1px solid #3e3c76}.ranking-row.leader{border-color:#ffe36b;background:linear-gradient(90deg,#3b315e,#232253)}.ranking-row>b{color:#72eaff;font-size:10px}.ranking-row>span{color:#fff;font-size:10px;font-weight:1000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ranking-row>span small{color:#9d97cb;font-size:6px}.ranking-row em{font-style:normal;text-align:right;color:#fff;font-size:11px;font-weight:1000}.ranking-row em small{display:block;color:#8e89bb;font-size:6px;font-weight:900}
    .attack-breakdown{display:grid;gap:3px;margin-top:7px;padding:7px 8px;border-radius:10px;background:#17183b;border:1px solid #35366b;color:#a9a5cf;font-size:7px;line-height:1.45}.attack-breakdown b{color:#fff}.attack-breakdown span:first-child b{color:#76e9ff}.attack-breakdown span:last-child b{color:#ff9ab6}\n    .party-current-top{margin:8px 0;padding:10px 12px;border-radius:13px;background:linear-gradient(90deg,#4a3970,#2d2868);border:1px solid #ffe16a;text-align:left}.party-current-top span{display:block;color:#ffe36f;font-size:8px;font-weight:1000;letter-spacing:.13em}.party-current-top strong{display:block;color:#fff;font-size:20px}.party-current-top small{color:#c8c2e8;font-size:9px}.party-ranking-label{margin:9px 0 6px;text-align:left}.party-result-row{grid-template-columns:45px minmax(110px,1fr) 46px 58px 70px 78px!important}.party-result-score{color:#79e9ff!important}
    @media(max-width:620px){.ranking-row{grid-template-columns:36px minmax(74px,1fr) 39px 55px 61px;padding:6px 4px}.ranking-row em{font-size:9px}.party-result-row{grid-template-columns:38px minmax(78px,1fr) 34px 42px 49px 58px!important}.party-result-row em{font-size:6.5px!important}}
  `;
  document.head.appendChild(style);
})();
