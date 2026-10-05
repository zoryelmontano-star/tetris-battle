// Lightweight local-tab multiplayer transport. Cross-device backend can replace this adapter later.
(() => {
  let channel = null;
  let room = '';
  let playerId = sessionStorage.getItem('tb_player_id') || crypto.randomUUID();
  sessionStorage.setItem('tb_player_id', playerId);
  let handler = () => {};
  let heartbeat = null;

  function post(type, payload = {}) {
    if (!channel) return;
    channel.postMessage({ type, payload, playerId, ts: Date.now() });
  }

  function connect(roomCode, name) {
    disconnect();
    room = String(roomCode || '').toUpperCase();
    if (!room || !('BroadcastChannel' in window)) return false;
    channel = new BroadcastChannel(`tb-room-${room}`);
    channel.onmessage = event => {
      const msg = event.data || {};
      if (!msg.playerId || msg.playerId === playerId) return;
      handler(msg);
    };
    post('hello', { name });
    heartbeat = setInterval(() => post('heartbeat', { name }), 3000);
    return true;
  }

  function disconnect() {
    clearInterval(heartbeat);
    heartbeat = null;
    if (channel) channel.close();
    channel = null;
    room = '';
  }

  window.TBMultiplayer = {
    get playerId() { return playerId; },
    get room() { return room; },
    get mode() { return 'same-browser-tabs'; },
    connect,
    disconnect,
    send: post,
    onMessage(fn) { handler = typeof fn === 'function' ? fn : () => {}; }
  };
})();
