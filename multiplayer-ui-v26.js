// v26: player identity, line/KO counters, host badges, opponent ranks, and battle chat.
(() => {
  const $ = id => document.getElementById(id);
  const remoteProfiles = new Map();
  const greeted = new Set();
  const HOST_ROOMS_KEY = 'tb_party_host_rooms';
  let roundLines = 0;
  let aiLines = 0;
  let unread = 0;

  // Old SEND stack is intentionally retired. Garbage now travels directly from real line clears.
  $('outgoingAttackMeter')?.remove();

  function rankNow(){
    try { return window.getTetrisRank?.() || {rank:1,stars:0,goal:5,title:'Newbie'}; }
    catch { return {rank:1,stars:0,goal:5,title:'Newbie'}; }
  }
  function playerName(){ return ($('playerName')?.value || 'Player').trim().slice(0,16) || 'Player'; }
  function roomCode(){ return String(window.TBMultiplayer?.room || '').toUpperCase(); }
  function hostRooms(){
    try { return new Set(JSON.parse(localStorage.getItem(HOST_ROOMS_KEY) || '[]').map(x=>String(x).toUpperCase())); }
    catch { return new Set(); }
  }
  function rememberHostRoom(code){
    const set=hostRooms(); set.add(String(code||'').toUpperCase());
    localStorage.setItem(HOST_ROOMS_KEY, JSON.stringify([...set].slice(-30)));
  }

  // Capture Party creator as host without changing the Firebase room protocol.
  if (window.TBMultiplayer?.createParty) {
    const originalCreateParty = TBMultiplayer.createParty;
    TBMultiplayer.createParty = async function(...args){
      const res = await originalCreateParty.apply(this,args);
      if (res?.ok && res.room) rememberHostRoom(res.room);
      return res;
    };
  }

  function duelIds(){
    const ids=[];
    if(window.TBMultiplayer?.playerId) ids.push(TBMultiplayer.playerId);
    if(window.TBLiveGrid?.remotes) for(const id of TBLiveGrid.remotes.keys()) ids.push(id);
    return [...new Set(ids)].sort();
  }
  // Online 2P uses a deterministic match host so both clients display the same HOST badge.
  function duelHostId(){ const ids=duelIds(); return ids.length>=2 ? ids[0] : ''; }
  function localIsHost(){
    if(gameMode==='party') return !!roomCode() && hostRooms().has(roomCode());
    if(gameMode==='duel' && !window.TBAIMode) return duelHostId()===window.TBMultiplayer?.playerId;
    return false;
  }

  function profilePayload(){
    const r=rankNow();
    return {
      name:playerName(), mode:gameMode, lines:roundLines,
      rank:Number(r.rank||1), rankTitle:String(r.title||'Newbie'), stars:Number(r.stars||0), goal:Number(r.goal||5),
      host:localIsHost()
    };
  }
  function announceProfile(){
    if(gameMode==='solo' || window.TBAIMode || !window.TBMultiplayer?.room) return;
    TBMultiplayer.send('player_profile', profilePayload());
  }
  function announceLineClear(lines){
    const n=Math.max(0,Number(lines)||0);
    if(!n || gameMode==='solo' || window.TBAIMode || !window.TBMultiplayer?.room) return;
    TBMultiplayer.send('line_clear', {...profilePayload(), cleared:n, totalLines:roundLines});
  }

  // Count actual completed rows. This wrapper is after the battle engine, so it observes the same line clear that drives garbage.
  const priorClearLines = clearLines;
  clearLines = function(){
    const cleared = Array.isArray(board) ? board.reduce((n,row)=>n+(row.every(Boolean)?1:0),0) : 0;
    const out = priorClearLines();
    if(cleared>0){
      roundLines += cleared;
      announceLineClear(cleared);
      pulseLocalCounter();
    }
    return out;
  };

  const priorStartGame = startGame;
  startGame = function(){
    roundLines=0; aiLines=0;
    const out=priorStartGame();
    setTimeout(announceProfile,180);
    return out;
  };

  const priorOpenGame = openGame;
  openGame = function(code){
    const out=priorOpenGame(code);
    setTimeout(announceProfile,550);
    return out;
  };

  if(window.TBMultiplayer){
    TBMultiplayer.onMessage(msg=>{
      const p=msg.payload||{};
      if(msg.type==='player_left'){
        remoteProfiles.delete(msg.playerId); greeted.delete(msg.playerId); return;
      }
      if(msg.type==='player_profile'){
        remoteProfiles.set(msg.playerId,{...(remoteProfiles.get(msg.playerId)||{}),...p,seen:Date.now()});
      }
      if(msg.type==='line_clear'){
        const prior=remoteProfiles.get(msg.playerId)||{};
        remoteProfiles.set(msg.playerId,{...prior,...p,lines:Number(p.totalLines ?? prior.lines ?? 0),seen:Date.now()});
        setTimeout(()=>pulseRemoteCounter(msg.playerId),20);
      }
      if(['hello','live_state','ready_state'].includes(msg.type) && msg.playerId && msg.playerId!==TBMultiplayer.playerId && !greeted.has(msg.playerId)){
        greeted.add(msg.playerId);
        setTimeout(announceProfile,120);
      }
      if(msg.type==='chat_message') addChatMessage(p.name||'Player',p.text||'',false);
    });
  }

  window.addEventListener('tb-ai-lines',e=>{
    aiLines=Number(e.detail?.total||0);
    pulseAI();
  });

  function ensurePlayerUI(tile){
    if(!tile) return null;
    const head=tile.querySelector('.live-player-head'); if(!head)return null;
    let profile=tile.querySelector('.player-profile-row');
    if(!profile){
      profile=document.createElement('div');profile.className='player-profile-row';
      profile.innerHTML='<span class="host-chip hidden">HOST</span><span class="rank-chip">RANK 1 · NEWBIE</span><span class="star-chip">★ 0/5</span>';
      head.insertAdjacentElement('afterend',profile);
    }
    let counters=tile.querySelector('.player-counters');
    if(!counters){
      counters=document.createElement('div');counters.className='player-counters';
      counters.innerHTML='<div class="line-counter"><span>LINES</span><b class="line-value">0</b></div><div class="ko-counter"><span>KO</span><b class="ko-value">0 / 5</b></div><div class="party-score-counter hidden"><span>SCORE</span><b class="score-value">0</b></div>';
      profile.insertAdjacentElement('afterend',counters);
    }
    return {profile,counters};
  }

  function setTileUI(tile,data){
    const ui=ensurePlayerUI(tile); if(!ui)return;
    const {rank=1,rankTitle='Newbie',stars=0,goal=5,host=false,lines=0,ko=0,score=0,ai=false}=data;
    ui.profile.querySelector('.rank-chip').textContent=ai?`AI RANK ${rank} · ${String(rankTitle).toUpperCase()}`:`RANK ${rank} · ${String(rankTitle).toUpperCase()}`;
    ui.profile.querySelector('.star-chip').textContent=ai?'ADAPTIVE':`★ ${stars}/${goal}`;
    ui.profile.querySelector('.host-chip').classList.toggle('hidden',!host);
    ui.counters.querySelector('.line-value').textContent=Number(lines||0);
    ui.counters.querySelector('.ko-value').textContent=`${Number(ko||0)} / 5`;
    ui.counters.querySelector('.score-value').textContent=Number(score||0).toLocaleString();
    ui.counters.querySelector('.ko-counter').classList.toggle('hidden',gameMode==='party');
    ui.counters.querySelector('.party-score-counter').classList.toggle('hidden',gameMode!=='party');
  }

  function decorateTiles(){
    if(gameMode==='solo'){
      document.querySelectorAll('.player-profile-row,.player-counters').forEach(el=>el.classList.add('hidden'));
      return;
    }
    document.querySelectorAll('.player-profile-row,.player-counters').forEach(el=>el.classList.remove('hidden'));
    const r=rankNow();
    setTileUI($('localLiveTile'),{rank:r.rank,rankTitle:r.title,stars:r.stars,goal:r.goal,host:localIsHost(),lines:roundLines,ko:Number($('myKO')?.textContent||0),score:Number(score||0)});

    if(window.TBLiveGrid?.remotes){
      for(const [id,state] of TBLiveGrid.remotes){
        const tile=$(`live-${id}`); if(!tile)continue;
        const p=remoteProfiles.get(id)||{};
        const host=gameMode==='duel'?duelHostId()===id:!!p.host;
        setTileUI(tile,{rank:Number(p.rank||1),rankTitle:p.rankTitle||'Newbie',stars:Number(p.stars||0),goal:Number(p.goal||5),host,lines:Number(p.lines||0),ko:Number(state.ko||0),score:Number(state.score||0)});
      }
    }
    if(window.TBAIMode && $('live-ai-rival')){
      setTileUI($('live-ai-rival'),{rank:18,rankTitle:'Expert',stars:3,goal:5,host:false,lines:aiLines,ko:Number($('rivalKO')?.textContent||0),score:0,ai:true});
    }
  }

  function pulse(el){if(!el)return;el.animate?.([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:280,easing:'ease-out'});}
  function pulseLocalCounter(){pulse($('localLiveTile')?.querySelector('.line-counter'));}
  function pulseRemoteCounter(id){pulse($(`live-${id}`)?.querySelector('.line-counter'));}
  function pulseAI(){pulse($('live-ai-rival')?.querySelector('.line-counter'));}
  setInterval(decorateTiles,120);

  // ---------------- Battle chat ----------------
  const chat=document.createElement('section');
  chat.id='battleChat';chat.className='battle-chat hidden collapsed';
  chat.innerHTML=`
    <div class="chat-head"><strong>💬 BATTLE CHAT <span id="chatUnread" class="chat-unread hidden">0</span></strong><button id="chatToggle" type="button">＋</button></div>
    <div id="chatMessages" class="chat-messages"><div class="chat-message"><b>SYSTEM</b>Keep it friendly. Good luck!</div></div>
    <div class="chat-input-row"><input id="chatInput" maxlength="120" autocomplete="off" placeholder="Type a message…"><button id="chatSend" type="button">SEND</button></div>
    <div class="chat-quick"><button data-chat="GLHF!">GLHF!</button><button data-chat="Nice!">Nice!</button><button data-chat="GG!">GG!</button><button data-chat="Again?">Again?</button></div>`;
  document.body.appendChild(chat);

  function chatAvailable(){return gameMode!=='solo'&&!window.TBAIMode&&!game.classList.contains('hidden')&&!!window.TBMultiplayer?.room;}
  function syncChat(){chat.classList.toggle('hidden',!chatAvailable());}
  function addChatMessage(name,text,mine){
    const clean=String(text||'').trim().slice(0,120);if(!clean)return;
    const wrap=document.createElement('div');wrap.className=`chat-message${mine?' mine':''}`;
    const who=document.createElement('b');who.textContent=mine?'YOU':String(name||'Player').slice(0,16).toUpperCase();
    const body=document.createElement('span');body.textContent=clean;
    wrap.append(who,body);$('chatMessages').appendChild(wrap);
    while($('chatMessages').children.length>31)$('chatMessages').children[1]?.remove();
    $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
    if(!mine&&chat.classList.contains('collapsed')){unread++;$('chatUnread').textContent=unread;$('chatUnread').classList.remove('hidden');}
  }
  function sendChat(text){
    const clean=String(text||'').trim().slice(0,120);if(!clean||!chatAvailable())return;
    addChatMessage(playerName(),clean,true);
    TBMultiplayer.send('chat_message',{name:playerName(),text:clean,mode:gameMode});
    if($('chatInput'))$('chatInput').value='';
  }
  $('chatToggle').addEventListener('click',()=>{
    chat.classList.toggle('collapsed');
    $('chatToggle').textContent=chat.classList.contains('collapsed')?'＋':'−';
    if(!chat.classList.contains('collapsed')){unread=0;$('chatUnread').classList.add('hidden');$('chatInput')?.focus();}
  });
  $('chatSend').addEventListener('click',()=>sendChat($('chatInput').value));
  $('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendChat(e.currentTarget.value);}});
  chat.querySelectorAll('[data-chat]').forEach(b=>b.addEventListener('click',()=>sendChat(b.dataset.chat)));
  setInterval(syncChat,250);

  window.TBArcadeUI={announceProfile,decorateTiles,addChatMessage};
})();
