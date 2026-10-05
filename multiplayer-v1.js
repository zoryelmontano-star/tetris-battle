// Tetris Battle multiplayer transport.
// Uses Firebase Realtime Database when firebase-config.json is configured.
// Falls back to BroadcastChannel for same-browser testing until then.
(() => {
  const SDK = '12.19.0';
  const handlers = new Set();
  let playerId = sessionStorage.getItem('tb_player_id') || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  sessionStorage.setItem('tb_player_id', playerId);

  // BroadcastChannel fallback
  let channel = null;
  let fallbackRoom = '';
  let heartbeat = null;

  // Firebase
  let fb = null;
  let fbInit = null;
  let firebaseConfigured = false;
  let firebaseRoom = '';
  let roomMode = '';
  let unsubs = [];
  let ownPlayerRef = null;
  let disconnectOp = null;
  let connectedAt = 0;

  const blankBoard = () => Array.from({length:20}, () => Array(10).fill(''));
  const modeNow = () => { try { return typeof gameMode !== 'undefined' ? gameMode : 'party'; } catch { return 'party'; } };
  const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);

  function dispatch(msg) {
    handlers.forEach(fn => { try { fn(msg); } catch (err) { console.error('TB multiplayer listener error', err); } });
  }

  async function readConfig() {
    if (window.TB_FIREBASE_CONFIG?.apiKey) return window.TB_FIREBASE_CONFIG;
    try {
      const res = await fetch(`firebase-config.json?v=15`, { cache: 'no-store' });
      if (!res.ok) return null;
      const cfg = await res.json();
      return cfg?.apiKey ? cfg : null;
    } catch { return null; }
  }

  async function initFirebase() {
    if (fb) return fb;
    if (fbInit) return fbInit;
    fbInit = (async () => {
      const config = await readConfig();
      if (!config?.apiKey || !config?.projectId || !config?.databaseURL) {
        firebaseConfigured = false;
        window.TBFirebase = { ready:false, status:'needs-config' };
        return null;
      }
      const [appMod, authMod, dbMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-database.js`)
      ]);
      const app = appMod.initializeApp(config);
      const auth = authMod.getAuth(app);
      let user = auth.currentUser;
      if (!user) user = (await authMod.signInAnonymously(auth)).user;
      playerId = user.uid;
      const db = dbMod.getDatabase(app);
      fb = { ...dbMod, db, auth, user };
      firebaseConfigured = true;
      window.TBFirebase = { ready:true, status:'ready', uid:playerId };
      return fb;
    })().catch(err => {
      console.error('Firebase init failed', err);
      firebaseConfigured = false;
      window.TBFirebase = { ready:false, status:'error', error:String(err?.message || err) };
      fbInit = null;
      return null;
    });
    return fbInit;
  }

  function fallbackPost(type, payload = {}) {
    if (!channel) return;
    channel.postMessage({ type, payload, playerId, ts:Date.now() });
  }

  function fallbackConnect(roomCode, name) {
    fallbackDisconnect();
    fallbackRoom = String(roomCode || '').toUpperCase();
    if (!fallbackRoom || !('BroadcastChannel' in window)) return false;
    channel = new BroadcastChannel(`tb-room-${fallbackRoom}`);
    channel.onmessage = event => {
      const msg = event.data || {};
      if (!msg.playerId || msg.playerId === playerId) return;
      dispatch(msg);
    };
    fallbackPost('hello', { name, mode:modeNow() });
    heartbeat = setInterval(() => fallbackPost('heartbeat', { name, mode:modeNow() }), 3000);
    return true;
  }

  function fallbackDisconnect() {
    clearInterval(heartbeat); heartbeat = null;
    if (channel) channel.close();
    channel = null; fallbackRoom = '';
  }

  function clearFirebaseSubs() {
    unsubs.forEach(fn => { try { fn(); } catch {} });
    unsubs = [];
  }

  async function firebaseDisconnect() {
    clearFirebaseSubs();
    if (disconnectOp) { try { await disconnectOp.cancel(); } catch {} }
    disconnectOp = null;
    if (fb && ownPlayerRef) { try { await fb.remove(ownPlayerRef); } catch {} }
    ownPlayerRef = null;
    firebaseRoom = '';
    roomMode = '';
  }

  async function admit(sessionPath, name, mode) {
    const playersRef = fb.ref(fb.db, `${sessionPath}/players`);
    const max = mode === 'duel' ? 2 : 6;
    const result = await fb.runTransaction(playersRef, current => {
      current = current || {};
      if (!current[playerId] && Object.keys(current).length >= max) return;
      current[playerId] = {
        name:String(name || 'Player').slice(0,16), mode, ready:false, score:0, ko:0, seen:Date.now(),
        state:{ board:blankBoard(), score:0, ko:0, timeLeft:120, sessionWins:0, totalSent:0 }
      };
      return current;
    }, { applyLocally:false });
    return result.committed;
  }

  async function subscribe(sessionPath) {
    const playersRef = fb.ref(fb.db, `${sessionPath}/players`);
    const eventsRef = fb.ref(fb.db, `${sessionPath}/events`);
    connectedAt = Date.now();
    const emitPlayer = snap => {
      if (snap.key === playerId) return;
      const p = snap.val() || {};
      dispatch({ type:'live_state', playerId:snap.key, ts:Date.now(), payload:{
        name:p.name || 'Player', mode:p.mode || roomMode, ready:!!p.ready,
        board:p.state?.board || blankBoard(), score:Number(p.state?.score ?? p.score ?? 0),
        ko:Number(p.state?.ko ?? p.ko ?? 0), timeLeft:Number(p.state?.timeLeft ?? 120),
        sessionWins:Number(p.state?.sessionWins || 0), totalSent:Number(p.state?.totalSent || 0)
      }});
      dispatch({ type:'ready_state', playerId:snap.key, ts:Date.now(), payload:{ name:p.name||'Player', mode:p.mode||roomMode, ready:!!p.ready } });
    };
    unsubs.push(fb.onChildAdded(playersRef, emitPlayer));
    unsubs.push(fb.onChildChanged(playersRef, emitPlayer));
    unsubs.push(fb.onChildRemoved(playersRef, snap => dispatch({type:'player_left', playerId:snap.key, payload:{}, ts:Date.now()})));
    unsubs.push(fb.onChildAdded(eventsRef, snap => {
      const e = snap.val() || {};
      if (!e.playerId || e.playerId === playerId) return;
      if (Number(e.ts || 0) && Number(e.ts) < connectedAt - 1500) return;
      dispatch({ type:e.type, payload:e.payload || {}, playerId:e.playerId, ts:Number(e.ts || Date.now()) });
    }));
    ownPlayerRef = fb.ref(fb.db, `${sessionPath}/players/${playerId}`);
    disconnectOp = fb.onDisconnect(ownPlayerRef);
    await disconnectOp.remove();
  }

  async function firebaseConnect(roomCode, name, options = {}) {
    await firebaseDisconnect();
    firebaseRoom = cleanCode(roomCode);
    if (!firebaseRoom) return false;
    roomMode = options.mode || modeNow();
    const sessionPath = `sessions/${firebaseRoom}`;
    if (!(await admit(sessionPath, name, roomMode))) return false;
    await fb.update(fb.ref(fb.db, `${sessionPath}/players/${playerId}`), { seen:fb.serverTimestamp() });
    await subscribe(sessionPath);
    await firebaseSend('hello', {name, mode:roomMode});
    return true;
  }

  async function firebaseSend(type, payload = {}) {
    if (!firebaseRoom) return;
    const sessionPath = `sessions/${firebaseRoom}`;
    const playerRef = fb.ref(fb.db, `${sessionPath}/players/${playerId}`);
    if (type === 'live_state') {
      await fb.update(playerRef, {
        name:String(payload.name || 'Player').slice(0,16), mode:payload.mode || roomMode,
        ready:!!payload.ready, seen:fb.serverTimestamp(), score:Number(payload.score || 0), ko:Number(payload.ko || 0),
        state:{ board:Array.isArray(payload.board) ? payload.board : blankBoard(), score:Number(payload.score||0),
          ko:Number(payload.ko||0), timeLeft:Number(payload.timeLeft ?? 120), sessionWins:Number(payload.sessionWins||0), totalSent:Number(payload.totalSent||0) }
      });
      return;
    }
    if (type === 'heartbeat') {
      await fb.update(playerRef, {name:String(payload.name||'Player').slice(0,16), seen:fb.serverTimestamp()});
      return;
    }
    if (type === 'hello' || type === 'ready_state') {
      const patch = {name:String(payload.name||'Player').slice(0,16), mode:payload.mode||roomMode, seen:fb.serverTimestamp()};
      if (type === 'ready_state') patch.ready = !!payload.ready;
      await fb.update(playerRef, patch);
    }
    const eventRef = fb.push(fb.ref(fb.db, `${sessionPath}/events`));
    await fb.set(eventRef, {type, payload, playerId, ts:fb.serverTimestamp()});
  }

  async function connect(roomCode, name, options = {}) {
    const ready = await initFirebase();
    if (!ready) return fallbackConnect(roomCode, name);
    fallbackDisconnect();
    return firebaseConnect(roomCode, name, options);
  }

  async function disconnect() {
    fallbackDisconnect();
    if (fb) await firebaseDisconnect();
  }

  async function send(type, payload = {}) {
    if (fb && firebaseRoom) return firebaseSend(type, payload);
    return fallbackPost(type, payload);
  }

  async function createParty(code, name, sessionName) {
    const ready = await initFirebase();
    if (!ready) return {ok:false, reason:'firebase-not-configured'};
    const clean = cleanCode(code) || cleanCode(Math.random().toString(36).slice(2,8));
    const metaRef = fb.ref(fb.db, `sessions/${clean}/meta`);
    const tx = await fb.runTransaction(metaRef, current => current ? undefined : ({
      mode:'party', roomName:String(sessionName || `Party ${clean}`).slice(0,30), createdBy:playerId, createdAt:Date.now(), maxPlayers:6
    }), {applyLocally:false});
    if (!tx.committed) return {ok:false, reason:'code-taken'};
    const ok = await firebaseConnect(clean, name, {mode:'party'});
    return {ok, room:clean, roomName:String(sessionName||`Party ${clean}`).slice(0,30)};
  }

  async function joinParty(code, name) {
    const ready = await initFirebase();
    if (!ready) return {ok:false, reason:'firebase-not-configured'};
    const clean = cleanCode(code);
    const meta = await fb.get(fb.ref(fb.db, `sessions/${clean}/meta`));
    if (!meta.exists() || meta.val()?.mode !== 'party') return {ok:false, reason:'not-found'};
    const ok = await firebaseConnect(clean, name, {mode:'party'});
    return {ok, room:clean, roomName:meta.val()?.roomName || ''};
  }

  async function findDuel(name) {
    const ready = await initFirebase();
    if (!ready) return {ok:false, reason:'firebase-not-configured'};
    const assignRef = fb.ref(fb.db, `matchmaking/assignments/${playerId}`);
    await fb.remove(assignRef);
    let opponent = null;
    const waitingRef = fb.ref(fb.db, 'matchmaking/waiting');
    await fb.runTransaction(waitingRef, current => {
      const now = Date.now();
      if (current && current.uid !== playerId && now - Number(current.joinedAt || 0) < 45000) {
        opponent = current;
        return null;
      }
      return {uid:playerId, name:String(name||'Player').slice(0,16), joinedAt:now};
    }, {applyLocally:false});

    if (opponent) {
      const roomId = cleanCode(`D${fb.push(fb.ref(fb.db, 'sessions')).key}`);
      const updates = {};
      updates[`sessions/${roomId}/meta`] = {mode:'duel', createdAt:Date.now(), maxPlayers:2};
      updates[`matchmaking/assignments/${playerId}`] = {room:roomId, opponentName:opponent.name||'Rival', at:Date.now()};
      updates[`matchmaking/assignments/${opponent.uid}`] = {room:roomId, opponentName:String(name||'Player').slice(0,16), at:Date.now()};
      await fb.update(fb.ref(fb.db), updates);
    }

    return new Promise(resolve => {
      const timer = setTimeout(() => { off(); resolve({ok:false, reason:'timeout'}); }, 60000);
      const off = fb.onValue(assignRef, async snap => {
        if (!snap.exists()) return;
        const data = snap.val(); clearTimeout(timer); off(); await fb.remove(assignRef);
        resolve({ok:true, room:data.room, opponentName:data.opponentName||'Rival'});
      });
    });
  }

  window.TBMultiplayer = {
    get playerId(){ return playerId; },
    get room(){ return firebaseRoom || fallbackRoom; },
    get mode(){ return firebaseConfigured ? 'firebase-realtime' : 'same-browser-tabs'; },
    init:initFirebase, connect, disconnect, send, createParty, joinParty, findDuel,
    onMessage(fn){ if(typeof fn !== 'function') return () => {}; handlers.add(fn); return () => handlers.delete(fn); }
  };
  window.TBFirebase = window.TBFirebase || {ready:false, status:'checking'};
  initFirebase();
})();
