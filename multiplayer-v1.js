// Lightweight local-tab multiplayer transport. Cross-device backend can replace this adapter later.
(() => {
  let channel = null;
  let room = '';
  let playerId = sessionStorage.getItem('tb_player_id') || crypto.randomUUID();
  sessionStorage.setItem('tb_player_id', playerId);
  const handlers = new Set();
  let heartbeat = null;

  function post(type, payload = {}) {
    if (!channel) return;
    channel.postMessage({ type, payload, playerId, ts: Date.now() });
  }

  function dispatch(msg) {
    handlers.forEach(fn => {
      try { fn(msg); } catch (err) { console.error('TB multiplayer listener error', err); }
    });
  }

  function connect(roomCode, name) {
    disconnect(false);
    room = String(roomCode || '').toUpperCase();
    if (!room || !('BroadcastChannel' in window)) return false;
    channel = new BroadcastChannel(`tb-room-${room}`);
    channel.onmessage = event => {
      const msg = event.data || {};
      if (!msg.playerId || msg.playerId === playerId) return;
      dispatch(msg);
    };
    post('hello', { name });
    heartbeat = setInterval(() => post('heartbeat', { name }), 3000);
    return true;
  }

  function disconnect(clearHandlers = false) {
    clearInterval(heartbeat);
    heartbeat = null;
    if (channel) channel.close();
    channel = null;
    room = '';
    if (clearHandlers) handlers.clear();
  }

  window.TBMultiplayer = {
    get playerId() { return playerId; },
    get room() { return room; },
    get mode() { return 'same-browser-tabs'; },
    connect,
    disconnect,
    send: post,
    onMessage(fn) {
      if (typeof fn !== 'function') return () => {};
      handlers.add(fn);
      return () => handlers.delete(fn);
    }
  };
})();
