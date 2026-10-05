// v24: visible outgoing garbage stack for online and AI 2P battles.
(() => {
  const $ = id => document.getElementById(id);
  let lastAttack = Number($('attack')?.textContent || 0);
  let pendingVisual = 0;
  let clearTimer = null;

  function duelActive() {
    return gameMode === 'duel' && !game.classList.contains('hidden');
  }

  function meterHost() {
    const next = $('localLiveTile')?.querySelector('.next-panel') || document.querySelector('#arenaCard .next-panel');
    const crown = next?.querySelector('.streak-box');
    return { next, crown };
  }

  function ensureMeter() {
    const { next, crown } = meterHost();
    if (!next) return null;
    let meter = $('outgoingAttackMeter');
    if (!meter) {
      meter = document.createElement('div');
      meter.id = 'outgoingAttackMeter';
      meter.className = 'outgoing-attack-meter hidden';
      meter.innerHTML = `
        <div class="outgoing-top"><span class="outgoing-label">SEND</span><b class="outgoing-count" id="outgoingAttackCount">0</b></div>
        <div class="outgoing-stack" id="outgoingAttackStack" aria-label="Outgoing garbage lines"></div>`;
    }
    if (meter.parentElement !== next) {
      if (crown) crown.insertAdjacentElement('afterend', meter);
      else next.appendChild(meter);
    }
    return meter;
  }

  function renderMeter() {
    const meter = ensureMeter();
    if (!meter) return;
    const visible = duelActive() && (gameRunning || pendingVisual > 0 || window.TBAIMode);
    meter.classList.toggle('hidden', !visible);
    if (!visible) return;

    const count = $('outgoingAttackCount');
    const stack = $('outgoingAttackStack');
    if (!count || !stack) return;
    count.textContent = pendingVisual > 0 ? `+${pendingVisual}` : '0';
    stack.innerHTML = '';

    const cells = Math.min(12, pendingVisual);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('i');
      cell.className = i < cells ? 'filled' : '';
      stack.appendChild(cell);
    }
    meter.classList.toggle('hot', pendingVisual >= 4);
    meter.classList.toggle('danger', pendingVisual >= 8);
  }

  function resetVisual() {
    pendingVisual = 0;
    clearTimeout(clearTimer);
    renderMeter();
  }

  function showOutgoing(lines) {
    const n = Math.max(0, Number(lines) || 0);
    if (!n || gameMode !== 'duel') return;
    pendingVisual += n;
    renderMeter();
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      pendingVisual = 0;
      renderMeter();
    }, 1650);
  }

  const attackEl = $('attack');
  if (attackEl) {
    new MutationObserver(() => {
      const next = Number(attackEl.textContent || 0);
      if (gameMode !== 'duel') {
        lastAttack = next;
        resetVisual();
        return;
      }
      if (next < lastAttack) {
        lastAttack = next;
        resetVisual();
        return;
      }
      const delta = next - lastAttack;
      lastAttack = next;
      if (delta > 0) showOutgoing(delta);
    }).observe(attackEl, {childList:true, characterData:true, subtree:true});
  }

  const style = document.createElement('style');
  style.textContent = `
    .outgoing-attack-meter{position:static!important;width:100%;margin-top:7px;padding:7px;border-radius:11px;background:linear-gradient(180deg,#171318,#0f0d10);border:1px solid rgba(229,190,111,.28);box-shadow:inset 0 1px rgba(255,255,255,.035);pointer-events:none}
    .outgoing-attack-meter.hidden{display:none!important}
    .outgoing-top{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:5px}
    .outgoing-label{font-size:7px;font-weight:1000;letter-spacing:.12em;color:#bcae9b}
    .outgoing-count{font-size:13px;line-height:1;font-weight:1000;color:#eed18d;text-shadow:0 2px 6px rgba(0,0,0,.45)}
    .outgoing-stack{display:flex;flex-direction:column-reverse;gap:2px;height:72px}
    .outgoing-stack i{flex:1;min-height:3px;border-radius:2px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.04);transition:background .12s ease,transform .12s ease,box-shadow .12s ease}
    .outgoing-stack i.filled{background:linear-gradient(90deg,#b88b46,#e3c574);border-color:rgba(255,230,162,.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 5px rgba(218,171,84,.16);transform:scaleX(1.03)}
    .outgoing-attack-meter.hot .outgoing-stack i.filled{background:linear-gradient(90deg,#ba665c,#dc9b70)}
    .outgoing-attack-meter.danger .outgoing-stack i.filled{background:linear-gradient(90deg,#a94d60,#df7f84);box-shadow:0 0 7px rgba(215,91,108,.22)}
    @media(max-width:720px){
      .live-arena-grid.duel .local-live-tile .next-panel{display:block!important;width:100%!important;max-width:300px!important;margin:7px auto 0!important}
      .live-arena-grid.duel .local-live-tile .next-panel .next-card{display:none!important}
      .outgoing-stack{height:54px}
    }
  `;
  document.head.appendChild(style);

  $('startBtn')?.addEventListener('click', () => {
    lastAttack = 0;
    resetVisual();
    setTimeout(renderMeter, 50);
  }, true);
  $('quitBtn')?.addEventListener('click', resetVisual, true);
  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => setTimeout(() => {
    lastAttack = Number($('attack')?.textContent || 0);
    if (gameMode !== 'duel') resetVisual();
    else renderMeter();
  }, 180)));

  setInterval(renderMeter, 350);
  window.TBOutgoingMeter = { showOutgoing, reset:resetVisual, render:renderMeter };
})();
