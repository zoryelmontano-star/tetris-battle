// Tetris Battle v12: custom room/session names + memorable room codes.
(() => {
  const $ = id => document.getElementById(id);
  const lobbyGrid = document.querySelector('.lobby-grid');
  const createBtn = $('createRoomBtn');
  const joinBtn = $('joinRoomBtn');
  const codeInput = $('roomCode');
  if (!lobbyGrid || !createBtn || !joinBtn || !codeInput || $('roomName')) return;

  const roomNameLabel = document.createElement('label');
  roomNameLabel.className = 'room-name-field';
  roomNameLabel.innerHTML = `Room / Session name<input id="roomName" maxlength="30" placeholder="Montano Family Night" />`;
  lobbyGrid.insertBefore(roomNameLabel, lobbyGrid.firstChild);

  codeInput.maxLength = 12;
  codeInput.placeholder = 'MONTANO or leave blank';
  codeInput.closest('label')?.classList.add('room-code-field');

  const help = document.createElement('div');
  help.className = 'room-code-help';
  help.textContent = 'Choose your own easy room code, like MONTANO or TEAM5. If blank, one is generated for you.';
  lobbyGrid.appendChild(help);

  const style = document.createElement('style');
  style.textContent = `
    .room-code-help{grid-column:1/-1;color:#887b84;font-size:10px;margin-top:-5px}
    .room-title-tag{display:inline-block;margin-right:7px;color:#ead7bd;font-weight:900;max-width:190px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom;white-space:nowrap}
  `;
  document.head.appendChild(style);

  function cleanCode(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,12); }
  codeInput.addEventListener('input', () => codeInput.value = cleanCode(codeInput.value));

  function roomNameFor(code) {
    return $('roomName')?.value.trim().slice(0,30) || `Room ${code}`;
  }

  function showRoomTitle(name, code) {
    const pill = document.querySelector('.room-pill');
    const codeEl = $('roomCodeDisplay');
    if (!pill || !codeEl) return;
    let tag = pill.querySelector('.room-title-tag');
    if (!tag) { tag = document.createElement('span'); tag.className = 'room-title-tag'; pill.insertBefore(tag, codeEl); }
    tag.textContent = name;
    codeEl.textContent = code;
  }

  function saveRecent(name, code) {
    const recent = JSON.parse(localStorage.getItem('tb_recent_rooms') || '[]').filter(x => x.code !== code);
    recent.unshift({name, code, at: Date.now()});
    localStorage.setItem('tb_recent_rooms', JSON.stringify(recent.slice(0,8)));
  }

  const freshCreate = createBtn.cloneNode(true);
  createBtn.replaceWith(freshCreate);
  const freshJoin = joinBtn.cloneNode(true);
  joinBtn.replaceWith(freshJoin);

  freshCreate.addEventListener('click', () => {
    let code = cleanCode(codeInput.value);
    if (code && code.length < 4) { $('roomStatus').textContent = 'Room code must be at least 4 letters/numbers.'; return; }
    if (!code) code = typeof generateCode === 'function' ? generateCode() : Math.random().toString(36).slice(2,8).toUpperCase();
    codeInput.value = code;
    const name = roomNameFor(code);
    saveRecent(name, code);
    $('roomStatus').textContent = `${name} created · Code ${code}`;
    openGame(code);
    showRoomTitle(name, code);
    setTimeout(() => window.TBMultiplayer?.send('room_meta', {roomName:name, code, mode:gameMode}), 100);
  });

  freshJoin.addEventListener('click', () => {
    const code = cleanCode(codeInput.value);
    if (code.length < 4) { $('roomStatus').textContent = 'Enter the room code first.'; return; }
    codeInput.value = code;
    const fallback = $('roomName')?.value.trim() || `Room ${code}`;
    openGame(code);
    showRoomTitle(fallback, code);
    $('roomStatus').textContent = `Joining ${code}…`;
    setTimeout(() => window.TBMultiplayer?.send('room_meta_request', {code}), 100);
  });

  if (window.TBMultiplayer) {
    TBMultiplayer.onMessage(msg => {
      const p = msg.payload || {};
      if (msg.type === 'room_meta_request' && TBMultiplayer.room) {
        const code = $('roomCodeDisplay')?.textContent || TBMultiplayer.room;
        const name = document.querySelector('.room-title-tag')?.textContent || roomNameFor(code);
        TBMultiplayer.send('room_meta', {roomName:name, code, mode:gameMode});
      }
      if (msg.type === 'room_meta' && p.code === TBMultiplayer.room) {
        const name = String(p.roomName || `Room ${p.code}`).slice(0,30);
        if ($('roomName')) $('roomName').value = name;
        showRoomTitle(name, p.code);
        saveRecent(name, p.code);
        if ($('roomStatus')) $('roomStatus').textContent = `${name} · Code ${p.code}`;
      }
    });
  }

  window.TBRoom = { cleanCode, showRoomTitle };
})();
