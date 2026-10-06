// v29: HOLD-side battle info. Counters live below HOLD, never over the Tetris board.
(() => {
  const $ = id => document.getElementById(id);

  function drawHold(canvas,type){
    if(!canvas)return;
    const c=canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    const bg=c.createLinearGradient(0,0,0,canvas.height);bg.addColorStop(0,'#171742');bg.addColorStop(1,'#090a20');
    c.fillStyle=bg;c.fillRect(0,0,canvas.width,canvas.height);
    if(!type||!window.SHAPES?.[type])return;
    const shape=SHAPES[type], cell=15;
    const w=shape[0].length*cell,h=shape.length*cell;
    const ox=Math.floor((canvas.width-w)/2),oy=Math.floor((canvas.height-h)/2);
    shape.forEach((row,y)=>row.forEach((v,x)=>{
      if(!v)return;
      const color=COLORS[type]||'#7ccfff';
      const px=ox+x*cell,py=oy+y*cell;
      const g=c.createLinearGradient(px,py,px+cell,py+cell);
      g.addColorStop(0,typeof adjust==='function'?adjust(color,32):color);
      g.addColorStop(.5,color);
      g.addColorStop(1,typeof adjust==='function'?adjust(color,-30):color);
      c.fillStyle=g;c.fillRect(px+1,py+1,cell-2,cell-2);
      c.fillStyle='rgba(255,255,255,.28)';c.fillRect(px+2.5,py+2.5,Math.max(2,cell-5),2);
    }));
  }

  function statBlock(){
    const wrap=document.createElement('div');
    wrap.className='hold-battle-stats';
    wrap.innerHTML=`
      <div class="hold-stat ko"><span>KO</span><strong class="hold-ko-value">0</strong></div>
      <div class="hold-stat sent"><span>LINES<br>SENT</span><strong class="hold-sent-value">0</strong></div>`;
    return wrap;
  }

  function ensureLocalStats(){
    const panel=document.querySelector('#localLiveTile .hold-panel')||document.querySelector('.hold-panel');
    if(!panel)return null;
    let stats=panel.querySelector('.hold-battle-stats');
    if(!stats){stats=statBlock();panel.appendChild(stats);}
    return stats;
  }

  function ensureRemoteSide(tile){
    if(!tile)return null;
    let row=tile.querySelector('.remote-stage-with-hold');
    const shell=tile.querySelector('.remote-board-shell');
    if(!shell)return null;
    if(!row){
      row=document.createElement('div');row.className='remote-stage-with-hold';
      shell.parentNode.insertBefore(row,shell);
      const side=document.createElement('aside');side.className='remote-hold-panel';
      side.innerHTML=`<p>HOLD</p><div class="remote-hold-card"><canvas width="80" height="62"></canvas></div>`;
      side.appendChild(statBlock());
      row.appendChild(side);row.appendChild(shell);
    }
    return row.querySelector('.remote-hold-panel');
  }

  function localKO(){
    if(gameMode==='party')return Number(window.TBPartyBattle?.localKOs||0);
    return Number($('myKO')?.textContent||0);
  }
  function localSent(){
    if(gameMode==='party')return Number(window.TBPartyBattle?.localLinesSent||0);
    return Number(window.TBBattle?.totalSent||0);
  }

  function updateLocal(){
    if(gameMode==='solo')return;
    const stats=ensureLocalStats();if(!stats)return;
    stats.querySelector('.hold-ko-value').textContent=localKO();
    stats.querySelector('.hold-sent-value').textContent=localSent();
  }

  function updateRemote(id,state){
    const tile=$(`live-${id}`);if(!tile)return;
    const side=ensureRemoteSide(tile);if(!side)return;
    drawHold(side.querySelector('canvas'),state?.hold||'');
    side.querySelector('.hold-ko-value').textContent=Number(state?.ko||0);
    side.querySelector('.hold-sent-value').textContent=Number(state?.totalSent||0);
  }

  function updateAI(){
    const tile=$('live-ai-rival');if(!tile)return;
    const side=ensureRemoteSide(tile);if(!side)return;
    // Current AI does not use HOLD, so show an honest empty slot instead of faking a held piece.
    drawHold(side.querySelector('canvas'),'');
    side.querySelector('.hold-ko-value').textContent=Number($('rivalKO')?.textContent||0);
    side.querySelector('.hold-sent-value').textContent=Number(window.TBAIStats?.linesSent||0);
  }

  function refresh(){
    document.querySelectorAll('.battle-stat-rail').forEach(el=>el.remove());
    if(gameMode==='solo'){
      document.querySelectorAll('.hold-battle-stats,.remote-hold-panel').forEach(el=>el.classList.add('hidden-battle-side'));
      return;
    }
    document.querySelectorAll('.hold-battle-stats,.remote-hold-panel').forEach(el=>el.classList.remove('hidden-battle-side'));
    updateLocal();
    if(window.TBLiveGrid?.remotes){
      for(const [id,state] of TBLiveGrid.remotes) if(state?.mode===gameMode) updateRemote(id,state);
    }
    if(window.TBAIMode)updateAI();
  }

  const style=document.createElement('style');
  style.textContent=`
    /* Retire v27 floating rail completely. */
    .battle-stat-rail{display:none!important}
    .hidden-battle-side{display:none!important}
    .hold-panel{overflow:visible!important}
    .hold-battle-stats{display:grid;gap:7px;margin-top:9px;width:100%}
    .hold-stat{padding:7px 3px 6px;border-radius:11px;text-align:center;border:2px solid rgba(255,255,255,.33);box-shadow:0 4px 0 rgba(7,8,29,.62),inset 0 1px rgba(255,255,255,.20)}
    .hold-stat.ko{background:linear-gradient(180deg,#ff718b,#cf3c66)}
    .hold-stat.sent{background:linear-gradient(180deg,#5be7ff,#3b81ed)}
    .hold-stat span{display:block;color:#fff;font-size:8px;line-height:1.05;font-weight:1000;letter-spacing:.06em;text-shadow:0 1px 2px rgba(0,0,0,.35)}
    .hold-stat strong{display:block;margin-top:2px;color:#fff;font-size:28px;line-height:1;font-weight:1000;text-shadow:0 3px 0 rgba(0,0,0,.22)}

    .remote-stage-with-hold{display:grid;grid-template-columns:82px minmax(0,300px);gap:7px;align-items:start;justify-content:center;width:100%;margin:0 auto}
    .remote-hold-panel{width:82px;padding:6px;border-radius:13px;background:linear-gradient(180deg,#29245d,#17173a);border:1px solid #554da0;box-sizing:border-box}
    .remote-hold-panel>p{margin:0 0 5px;text-align:center;color:#d8d3ff;font-size:8px;font-weight:1000;letter-spacing:.13em}
    .remote-hold-card{padding:3px;border-radius:9px;background:#0c0d29;border:1px solid #444081}
    .remote-hold-card canvas{display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:6px}
    .remote-hold-panel .hold-battle-stats{margin-top:7px;gap:5px}
    .remote-hold-panel .hold-stat{padding:5px 2px}
    .remote-hold-panel .hold-stat span{font-size:7px}.remote-hold-panel .hold-stat strong{font-size:23px}
    .remote-stage-with-hold>.remote-board-shell{margin:0!important;width:100%!important;max-width:300px!important}

    .live-arena-grid.party .remote-stage-with-hold{grid-template-columns:58px minmax(0,188px);gap:4px}
    .live-arena-grid.party .remote-hold-panel{width:58px;padding:4px;border-radius:10px}
    .live-arena-grid.party .remote-hold-panel>p{font-size:7px;margin-bottom:3px}
    .live-arena-grid.party .remote-hold-panel .hold-stat{padding:4px 1px;border-width:1px}
    .live-arena-grid.party .remote-hold-panel .hold-stat span{font-size:6px}.live-arena-grid.party .remote-hold-panel .hold-stat strong{font-size:18px}
    .live-arena-grid.party .remote-stage-with-hold>.remote-board-shell{max-width:188px!important}

    @media(max-width:720px){
      .hold-battle-stats{gap:4px;margin-top:5px}.hold-stat{padding:5px 1px;border-width:1px}.hold-stat span{font-size:6px}.hold-stat strong{font-size:20px}
      .remote-stage-with-hold{grid-template-columns:50px minmax(0,1fr);gap:3px}.remote-hold-panel{width:50px;padding:3px}.remote-hold-panel .hold-stat strong{font-size:17px}.remote-hold-panel .hold-stat span{font-size:5.5px}
      .live-arena-grid.party .remote-stage-with-hold{grid-template-columns:46px minmax(0,1fr)}.live-arena-grid.party .remote-hold-panel{width:46px}
    }
  `;
  document.head.appendChild(style);

  window.addEventListener('tb-hold-change',()=>{window.TBLiveGrid?.sendState?.();refresh();});
  setInterval(refresh,120);
  refresh();
})();
