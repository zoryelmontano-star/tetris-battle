// Tetris Battle v15: Firebase Realtime Database multiplayer transport.
// Falls back to the existing same-browser transport until TB_FIREBASE_CONFIG is supplied.
(() => {
  const SDK = '12.19.0';
  const oldTransport = window.TBMultiplayer;
  const handlers = new Set();
  let api = null;
  let initPromise = null;
  let room = '';
  let uid = '';
  let roomMode = '';
  let roomName = '';
  let connectedAt = 0;
  let unsubs = [];
  let disconnectOp = null;
  let ownPlayerRef = null;

  const blankBoard = () => Array.from({length:20}, () => Array(10).fill(''));
  const currentMode = () => { try { return typeof gameMode !== 'undefined' ? gameMode : 'party'; } catch { return 'party'; } };
  const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);

  function dispatch(msg) {
    handlers.forEach(fn => { try { fn(msg); } catch (err) { console.error('TB Firebase listener error', err); } });
  }

  async function init() {
    if (api) return api;
    if (initPromise) return initPromise;
    const config = window.TB_FIREBASE_CONFIG;
    if (!config || !config.apiKey || !config.databaseURL || !config.projectId) {
      window.TBFirebase = { status: 'needs-config', ready: false };
      return null;
    }

    initPromise = (async () => {
      const [appMod, authMod, dbMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-database.js`)
      ]);
      const app = appMod.initializeApp(config);
      const auth = authMod.getAuth(app);
      let user = auth.currentUser;
      if (!user) user = (await authMod.signInAnonymously(auth)).user;
      uid = user.uid;
      const db = dbMod.getDatabase(app);
      api = { ...dbMod, db, auth, user };
      window.TBFirebase = { status: 'ready', ready: true, uid };
      return api;
    })().catch(err => {
      console.error('Firebase initialization failed', err);
      window.TBFirebase = { status: 'error', ready: false, error: String(err?.message || err) };
      initPromise = null;
      return null;
    });
    return initPromise;
  }

  function clearSubscriptions() {
    unsubs.forEach(fn => { try { fn(); } catch {} });
    unsubs = [];
  }

  async function disconnect() {
    clearSubscriptions();
    if (disconnectOp) { try { await disconnectOp.cancel(); } catch {} }
    disconnectOp = null;
    if (api && ownPlayerRef) { try { await api.remove(ownPlayerRef); } catch {} }
    ownPlayerRef = null;
    room = '';
    roomMode = '';
    roomName = '';
  }

  async function admitPlayer(sessionRef, name, mode) {
    const { ref, runTransaction } = api;
    const playersRef = ref(api.db, `${sessionRef}/players`);
    const max = mode === 'duel' ? 2 : 6;
    const result = await runTransaction(playersRef, current => {
      current = current || {};
      if (!current[uid] && Object.keys(current).length >= max) return;
      current[uid] = {
        name: String(name || 'Player').slice(0,16),
        mode,
        ready: false,
        score: 0,
        ko: 0,
        seen: Date.now(),
        state: { board: blankBoard(), score: 0, ko: 0, timeLeft: 120 }
      };
      return current;
    }, { applyLocally: false });
    return result.committed;
  }

  async function subscribeRoom(sessionPath) {
    const { ref, onChildAdded, onChildChanged, onChildRemoved, onDisconnect } = api;
    const playersRef = ref(api.db, `${sessionPath}/players`);
    const eventsRef = ref(api.db, `${sessionPath}/events`);
    connectedAt = Date.now();

    const emitPlayer = snap => {
      if (snap.key === uid) return;
      const p = snap.val() || {};
      dispatch({ type: 'live_state', playerId: snap.key, ts: Date.now(), payload: {
        name: p.name || 'Player', mode: p.mode || roomMode,
        board: p.state?.board || blankBoard(), score: Number(p.state?.score || p.score || 0),
        ko: Number(p.state?.ko || p.ko || 0), timeLeft: Number(p.state?.timeLeft ?? 120),
        sessionWins: Number(p.state?.sessionWins || 0), ready: !!p.ready, totalSent: Number(p.state?.totalSent || 0)
      }});
      dispatch({ type: 'ready_state', playerId: snap.key, ts: Date.now(), payload: { name:p.name||'Player', mode:p.mode||roomMode, ready:!!p.ready } });
    };

    unsubs.push(onChildAdded(playersRef, emitPlayer));
    unsubs.push(onChildChanged(playersRef, emitPlayer));
    unsubs.push(onChildRemoved(playersRef, snap => dispatch({ type:'player_left', playerId:snap.key, ts:Date.now(), payload:{} })));
    unsubs.push(onChildAdded(eventsRef, snap => {
      const e = snap.val() || {};
      if (!e.playerId || e.playerId === uid) return;
      if (Number(e.ts || 0) && Number(e.ts) < connectedAt - 1500) return;
      dispatch({ type:e.type, payload:e.payload || {}, playerId:e.playerId, ts:Number(e.ts || Date.now()) });
    }));

    ownPlayerRef = ref(api.db, `${sessionPath}/players/${uid}`);
    disconnectOp = onDisconnect(ownPlayerRef);
    await disconnectOp.remove();
  }

  async function connect(roomCode, name, options = {}) {
    const fb = await init();
    if (!fb) return oldTransport?.connect ? oldTransport.connect(roomCode, name) : false;
    await disconnect();
    room = cleanCode(roomCode);
    if (!room) return false;
    roomMode = options.mode || currentMode();
    roomName = String(options.roomName || '').slice(0,30);
    const sessionPath = `sessions/${room}`;
    const admitted = await admitPlayer(sessionPath, name, roomMode);
    if (!admitted) return false;
    await api.update(api.ref(api.db, `${sessionPath}/players/${uid}`), { seen: api.serverTimestamp() });
    await subscribeRoom(sessionPath);
    await send('hello', { name, mode: roomMode });
    return true;
  }

  async function send(type, payload = {}) {
    if (!api || !room) {
      if (oldTransport?.send) oldTransport.send(type, payload);
      return;
    }
    const sessionPath = `sessions/${room}`;
    const playerRef = api.ref(api.db, `${sessionPath}/players/${uid}`);

    if (type === 'live_state') {
      await api.update(playerRef, {
        name: String(payload.name || 'Player').slice(0,16),
        mode: payload.mode || roomMode,
        ready: !!payload.ready,
        seen: api.serverTimestamp(),
        score: Number(payload.score || 0),
        ko: Number(payload.ko || 0),
        state: {
          board: Array.isArray(payload.board) ? payload.board : blankBoard(),
          score: Number(payload.score || 0), ko: Number(payload.ko || 0),
          timeLeft: Number(payload.timeLeft ?? 120), sessionWins: Number(payload.sessionWins || 0),
          totalSent: Number(payload.totalSent || 0)
        }
      });
      return;
    }

    if (type === 'heartbeat') {
      await api.update(playerRef, { name:String(payload.name||'Player').slice(0,16), seen:api.serverTimestamp() });
      return;
    }

    if (type === 'hello' || type === 'ready_state') {
      const patch = { seen:api.serverTimestamp(), name:String(payload.name||'Player').slice(0,16), mode:payload.mode||roomMode };
      if (type === 'ready_state') patch.ready = !!payload.ready;
      await api.update(playerRef, patch);
    }

    const eventRef = api.push(api.ref(api.db, `${sessionPath}/events`));
    await api.set(eventRef, { type, payload, playerId:uid, ts:api.serverTimestamp() });
  }

  async function createParty(code, name, sessionName) {
    const fb = await init();
    if (!fb) return { ok:false, reason:'firebase-not-configured' };
    const clean = cleanCode(code) || cleanCode(Math.random().toString(36).slice(2,8));
    const metaRef = api.ref(api.db, `sessions/${clean}/meta`);
    const result = await api.runTransaction(metaRef, current => {
      if (current) return;
      return { mode:'party', roomName:String(sessionName||`Party ${clean}`).slice(0,30), createdBy:uid, createdAt:Date.now(), maxPlayers:6 };
    }, { applyLocally:false });
    if (!result.committed) return { ok:false, reason:'code-taken' };
    const ok = await connect(clean, name, { mode:'party', roomName:sessionName });
    return { ok, room:clean };
  }

  async function joinParty(code, name) {
    const fb = await init();
    if (!fb) return { ok:false, reason:'firebase-not-configured' };
    const clean = cleanCode(code);
    const metaSnap = await api.get(api.ref(api.db, `sessions/${clean}/meta`));
    if (!metaSnap.exists() || metaSnap.val()?.mode !== 'party') return { ok:false, reason:'not-found' };
    const ok = await connect(clean, name, { mode:'party', roomName:metaSnap.val()?.roomName || '' });
    return { ok, room:clean, roomName:metaSnap.val()?.roomName || '' };
  }

  async function findDuel(name) {
    const fb = await init();
    if (!fb) return { ok:false, reason:'firebase-not-configured' };
    const assignRef = api.ref(api.db, `matchmaking/assignments/${uid}`);
    await api.remove(assignRef);
    let opponent = null;
    const waitingRef = api.ref(api.db, 'matchmaking/waiting');
    await api.runTransaction(waitingRef, current => {
      const now = Date.now();
      if (current && current.uid !== uid && now - Number(current.joinedAt || 0) < 45000) {
        opponent = current;
        return null;
      }
      return { uid, name:String(name||'Player').slice(0,16), joinedAt:now };
    }, { applyLocally:false });

    if (opponent) {
      const roomId = cleanCode(`D${api.push(api.ref(api.db, 'sessions')).key}`);
      const updates = {};
      updates[`sessions/${roomId}/meta`] = { mode:'duel', createdAt:Date.now(), maxPlayers:2 };
      updates[`matchmaking/assignments/${uid}`] = { room:roomId, opponentName:opponent.name || 'Rival', at:Date.now() };
      updates[`matchmaking/assignments/${opponent.uid}`] = { room:roomId, opponentName:String(name||'Player').slice(0,16), at:Date.now() };
      await api.update(api.ref(api.db), updates);
    }

    return await new Promise(resolve => {
      const timeout = setTimeout(() => { off(); resolve({ok:false, reason:'timeout'}); }, 60000);
      const off = api.onValue(assignRef, async snap => {
        if (!snap.exists()) return;
        const data = snap.val();
        clearTimeout(timeout); off();
        await api.remove(assignRef);
        resolve({ ok:true, room:data.room, opponentName:data.opponentName || 'Rival' });
      });
    });
  }

  window.TBMultiplayer = {
    get playerId() { return uid || oldTransport?.playerId || ''; },
    get room() { return room || oldTransport?.room || ''; },
    get mode() { return api ? 'firebase-realtime' : (oldTransport?.mode || 'same-browser-tabs'); },
    init, connect, disconnect, send, createParty, joinParty, findDuel,
    onMessage(fn) { if (typeof fn !== 'function') return () => {}; handlers.add(fn); return () => handlers.delete(fn); }
  };
  window.TBFirebase = window.TBFirebase || { status:'needs-config', ready:false };
})();
