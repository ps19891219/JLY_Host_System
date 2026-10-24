'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handlerFactory = require('../../api/play-history.js');

function fakeDb(seed = {}) {
  const docs = new Map(Object.entries(seed).map(([path, value]) => [path, structuredClone(value)]));
  const readPaths = [];
  const writeBatches = [];
  const snapshot = path => ({ exists: docs.has(path), data: () => structuredClone(docs.get(path)) });
  const reference = path => ({ path, get: async () => { readPaths.push(path); return snapshot(path); } });
  const db = {
    docs,
    readPaths,
    writeBatches,
    collection: name => ({ doc: id => reference(`${name}/${id}`) }),
    runTransaction: async callback => {
      const pending = [];
      const tx = {
        get: async ref => { readPaths.push(ref.path); return snapshot(ref.path); },
        set: (ref, value, options) => pending.push(['set', ref.path, structuredClone(value), options]),
        update: (ref, value) => pending.push(['update', ref.path, structuredClone(value)])
      };
      const result = await callback(tx);
      if (db.failWrites) throw new Error('injected_write_failure');
      for (const [operation, path, value, options] of pending) {
        if (operation === 'update') {
          if (!docs.has(path)) throw new Error('missing update target');
          docs.set(path, { ...docs.get(path), ...value });
        } else {
          docs.set(path, options?.merge ? { ...docs.get(path), ...value } : value);
        }
      }
      writeBatches.push(pending.map(([, path]) => path));
      return result;
    }
  };
  return db;
}

function request(handler, { method = 'GET', token, query = {}, body = {}, headers = {} } = {}) {
  const req = {
    method,
    headers: { cookie: token, origin: 'https://jly-host-system-eeso.vercel.app', ...headers },
    query,
    body
  };
  const res = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(serialized) { this.body = JSON.parse(serialized); }
  };
  return handler(req, res).then(() => res);
}

const seed = {
  'players/admin123': { roles: ['admin'], lineUserId: 'UA', displayName: '管理者' },
  'players/alice123': { lineUserId: 'U1', displayName: 'Alice' },
  'players/oldalice123': { canonicalPersonId: 'alice123', displayName: 'Alice 舊資料' },
  'players/bob1234': { lineUserId: 'UB', displayName: 'Bob' },
  'players/charlie123': { lineUserId: 'UC', displayName: 'Charlie' },
  'players/guest123': { displayName: '尚未登入的訪客' },
  'players/outside123': { lineUserId: 'U9', displayName: 'Outside' }
};

function handlerFor(db) {
  return handlerFactory.createHandler({
    db,
    logger: { error() {} },
    readCookie: req => req.headers.cookie,
    verifySession: token => ({ valid: true, data: ({
      manager: { profileId: 'admin123', lineUserId: 'UA' },
      alice: { profileId: 'alice123', lineUserId: 'U1' },
      aliceAlias: { profileId: 'oldalice123', lineUserId: 'U1' },
      bob: { profileId: 'bob1234', lineUserId: 'UB' },
      charlie: { profileId: 'charlie123', lineUserId: 'UC' },
      wrongLine: { profileId: 'alice123', lineUserId: 'U9' },
      provisional: { profileId: 'alice123', lineUserId: 'U1', provisional: true },
      unclaimed: { profileId: 'guest123', lineUserId: 'U-UNCLAIMED' },
      outsider: { profileId: 'outside123', lineUserId: 'U9' }
    })[token] })
  });
}

test('one shared history serves three people; edits atomically add/remove/update canonical Person views', async () => {
  const db = fakeDb(seed), handler = handlerFor(db);
  const readsBeforeCreate = db.readPaths.length;
  const create = await request(handler, { method: 'POST', token: 'manager', body: {
    action: 'history_upsert', scriptName: '雨夜劇本', date: '2024-08-10', time: '19:30', place: '台北',
    status: 'completed', participants: [
      { personId: 'oldalice123', role: 'host', attendance: 'attended' },
      { personId: 'bob1234', role: 'player', attendance: 'attended' },
      { personId: 'charlie123', role: 'player', attendance: 'attended' },
      { personId: 'guest123', role: 'npc', attendance: 'attended' }
    ]
  } });
  assert.equal(create.statusCode, 200);
  const id = create.body.result.sessionId;
  assert.match(id, /^hist:/);
  assert.equal(db.docs.has(`playHistorySessions/${id}`), true);
  const createReads = db.readPaths.slice(readsBeforeCreate);
  assert.ok(createReads.length <= 12, `four participants with an alias should use bounded reads, got ${createReads.length}`);
  assert.equal(createReads.filter(path => path === 'players/alice123').length, 1, 'canonical Person document is cached within the request');
  assert.equal(db.writeBatches[0].length, 5, 'one Source plus four Person Prepared Views commit together');
  for (const personId of ['alice123', 'bob1234', 'charlie123', 'guest123']) {
    assert.equal(db.docs.get(`personPlayHistoryViews/${personId}`).sessions[0].sessionId, id);
  }
  assert.equal(db.docs.has('personPlayHistoryViews/oldalice123'), false, 'alias maps to canonical view');
  assert.equal(db.docs.get('personPlayHistoryViews/guest123').playedCount, 1, 'guest needs no LINE login to be backfilled');

  const aliasLogin = await request(handler, { token: 'aliceAlias', query: { action: 'me' } });
  assert.equal(aliasLogin.statusCode, 200, 'a valid existing alias session resolves to its canonical Person');
  assert.equal(aliasLogin.body.viewer.personId, 'alice123');
  const wrongIdentity = await request(handler, { token: 'wrongLine', query: { action: 'me' } });
  assert.equal(wrongIdentity.statusCode, 403, 'a different LINE User ID cannot claim the Person');
  const provisional = await request(handler, { token: 'provisional', query: { action: 'me' } });
  assert.equal(provisional.statusCode, 401, 'an unclaimed provisional LINE identity cannot read a Person view');
  const nameOnly = await request(handler, { token: 'unclaimed', query: { action: 'me' } });
  assert.equal(nameOnly.statusCode, 403, 'matching a Person display name never claims a LINE identity');

  for (const token of ['alice', 'bob', 'charlie']) {
    const own = await request(handler, { token, query: { action: 'me' } });
    assert.equal(own.statusCode, 200);
    assert.equal(own.body.view.sessions[0].sessionId, id, `${token} sees the same shared event`);
  }
  const sameSession = await request(handler, { token: 'bob', query: { action: 'session', id } });
  assert.equal(sameSession.statusCode, 200);
  assert.deepEqual(sameSession.body.participants.map(p => p.personId).sort(), ['alice123', 'bob1234', 'charlie123', 'guest123']);
  const outsider = await request(handler, { token: 'outsider', query: { action: 'session', id } });
  assert.equal(outsider.statusCode, 403);
  assert.equal(outsider.body.error, 'session_access_denied');
  const nonParticipantWrite = await request(handler, { method: 'POST', token: 'alice', body: { action: 'history_upsert' } });
  assert.equal(nonParticipantWrite.statusCode, 403);

  const update = await request(handler, { method: 'POST', token: 'manager', body: {
    action: 'history_upsert', id, scriptName: '雨夜劇本・修正版', date: '2024-08-11', time: '20:00', place: '新北',
    status: 'completed', participants: [
      { personId: 'oldalice123', role: 'player', attendance: 'attended' },
      { personId: 'charlie123', role: 'player', attendance: 'attended' },
      { personId: 'guest123', role: 'dm', attendance: 'absent' }
    ]
  } });
  assert.equal(update.statusCode, 200);
  assert.equal(db.docs.get(`playHistorySessions/${id}`).scriptName, '雨夜劇本・修正版');
  assert.equal(db.docs.get('personPlayHistoryViews/bob1234').total, 0, 'removed participant view no longer contains the event');
  assert.equal(db.docs.get('personPlayHistoryViews/guest123').sessions[0].role, 'dm');
  assert.equal(db.docs.get('personPlayHistoryViews/guest123').playedCount, 0, 'absent is not counted as played');
  const repeatUpdate = await request(handler, { method: 'POST', token: 'manager', body: {
    action: 'history_upsert', id, scriptName: '雨夜劇本・修正版', date: '2024-08-11', time: '20:00', place: '新北',
    status: 'completed', participants: [
      { personId: 'oldalice123', role: 'player', attendance: 'attended' },
      { personId: 'charlie123', role: 'player', attendance: 'attended' },
      { personId: 'guest123', role: 'dm', attendance: 'absent' }
    ]
  } });
  assert.equal(repeatUpdate.statusCode, 200);
  assert.equal(db.docs.get(`personPlayHistoryViews/alice123`).sessions.length, 1, 're-saving the same shared session never duplicates its card');
  assert.equal(db.docs.get(`personPlayHistoryViews/charlie123`).playedCount, 1);
  assert.equal(db.docs.size, 12, 'one source, four views, and seven pre-existing People');
  assert.equal(db.readPaths.some(path => path === 'players'), false, 'reads are direct document reads, not collection scans');
});

test('duplicate canonical aliases are rejected and transaction write failure leaves no partial source or views', async () => {
  const db = fakeDb(seed), handler = handlerFor(db);
  const duplicate = await request(handler, { method: 'POST', token: 'manager', body: {
    action: 'history_upsert', scriptName: '重複人員', date: '2024-08-10',
    participants: [
      { personId: 'alice123', role: 'player', attendance: 'attended' },
      { personId: 'oldalice123', role: 'host', attendance: 'attended' }
    ]
  } });
  assert.equal(duplicate.statusCode, 400);
  assert.equal([...db.docs.keys()].some(path => path.startsWith('playHistorySessions/')), false);

  db.failWrites = true;
  const failed = await request(handler, { method: 'POST', token: 'manager', body: {
    action: 'history_upsert', scriptName: '交易失敗', date: '2024-08-10',
    participants: [{ personId: 'alice123', role: 'player', attendance: 'attended' }]
  } });
  assert.equal(failed.statusCode, 500);
  assert.equal([...db.docs.keys()].some(path => path.startsWith('playHistorySessions/')), false);
  assert.equal([...db.docs.keys()].some(path => path.startsWith('personPlayHistoryViews/')), false);
});

test('existing Car edits preserve source fields, remove old participants, and do not duplicate on repeat completion', async () => {
  const db = fakeDb({
    ...seed,
    'cars/car12345': {
      ownerId: 'alice123', status: '已結束', customField: 'keep-me', scriptName: '正式劇本', gameDate: '2025-03-01',
      gameTime: '14:00', location: '台中',
      players: [
        { personId: 'alice123', status: 'confirmed', role: 'player' },
        { personId: 'bob1234', status: 'confirmed', role: 'host' }
      ]
    },
    'carDetailViews/car12345': {
      car: {
        id: 'car12345', scriptName: '正式劇本', gameDate: '2025-03-01', gameTime: '14:00', location: '台中',
        players: [
          { personId: 'alice123', status: 'confirmed', role: 'player' },
          { personId: 'bob1234', status: 'confirmed', role: 'host' }
        ]
      }, preparedMarker: 'keep-view'
    }
  });
  const handler = handlerFor(db);
  const managerRoster = await request(handler, { token: 'alice', query: { action: 'car_roster', carId: 'car12345' } });
  assert.equal(managerRoster.statusCode, 200, 'Car manager can load the existing roster');
  assert.equal(managerRoster.body.participants.filter(person => person.personId === 'alice123').length, 1, 'host and player identity is one canonical roster row');
  assert.equal(managerRoster.body.participants.find(person => person.personId === 'alice123').role, 'host', 'the existing Car owner keeps the host role');
  const forbiddenRoster = await request(handler, { token: 'outsider', query: { action: 'car_roster', carId: 'car12345' } });
  assert.equal(forbiddenRoster.statusCode, 403, 'unrelated account cannot load a management roster');
  const first = await request(handler, { method: 'POST', token: 'alice', body: {
    action: 'car_complete', carId: 'car12345', attendance: { alice123: 'attended', bob1234: 'attended' }
  } });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.result.sessionId, 'car:car12345');
  assert.equal(db.docs.get('cars/car12345').customField, 'keep-me');
  assert.equal(db.docs.get('cars/car12345').playRecordParticipants.length, 2);
  assert.equal(db.writeBatches[0].length, 4, 'Car Source, Car Prepared View and two Person Views commit together');
  assert.equal(db.docs.has('playHistorySessions/car:car12345'), false, 'Car remains the only source');

  const second = await request(handler, { method: 'POST', token: 'alice', body: {
    action: 'car_complete', carId: 'car12345', attendance: { alice123: 'attended', bob1234: 'attended' }
  } });
  assert.equal(second.statusCode, 200);
  assert.equal(db.docs.get('personPlayHistoryViews/alice123').sessions.length, 1, 'repeat completion is idempotent');
  assert.equal(db.docs.get('personPlayHistoryViews/alice123').playedCount, 1);

  const car = db.docs.get('cars/car12345');
  car.players = [
    { personId: 'alice123', status: 'confirmed', role: 'host' },
    { personId: 'guest123', status: 'confirmed', role: 'player' }
  ];
  db.docs.set('players/alice123', { mergedIntoPersonId: 'newalice123', displayName: 'Alice 舊 Person' });
  db.docs.set('players/newalice123', { lineUserId: 'U1', displayName: 'Alice canonical' });
  db.docs.set('cars/car12345', car);
  db.docs.get('carDetailViews/car12345').car.players = structuredClone(car.players);
  const refreshedRoster = await request(handler, { token: 'alice', query: { action: 'car_roster', carId: 'car12345' } });
  assert.deepEqual(refreshedRoster.body.participants.map(person => person.personId).sort(), ['guest123', 'newalice123'], 'manager sees the current Car roster with canonical aliases');
  const changed = await request(handler, { method: 'POST', token: 'alice', body: {
    action: 'car_complete', carId: 'car12345', attendance: { newalice123: 'attended', guest123: 'attended' }
  } });
  assert.equal(changed.statusCode, 200);
  assert.equal(db.docs.get('personPlayHistoryViews/bob1234').total, 0, 'removed Person View is cleaned');
  assert.equal(db.docs.get('personPlayHistoryViews/alice123').total, 0, 'old merged Person View is cleaned');
  assert.equal(db.docs.get('personPlayHistoryViews/newalice123').sessions.length, 1, 're-canonicalized alias creates one canonical view only');
  assert.equal(db.docs.get('personPlayHistoryViews/newalice123').playedCount, 1, 'attendance keyed by the new canonical ID is applied to the legacy Car alias');
  assert.equal(db.writeBatches.at(-1).length, 6, 'old and new canonical Person Views are cleaned and updated atomically');
  assert.equal(db.docs.get('personPlayHistoryViews/guest123').sessions[0].sessionId, 'car:car12345', 'new participant gets the existing event');
  assert.equal(db.docs.get('personPlayHistoryViews/guest123').playedCount, 1);
  assert.equal(db.docs.has('cars/car12345'), true, 'original Car source path remains in use');
  assert.equal([...db.docs.keys()].filter(path => path.startsWith('cars/')).length, 1, 'no duplicate Car was created');
  assert.equal(db.docs.has('playHistorySessions/car:car12345'), false);
});

test('only an actually attending participant or authorized Car manager can read a private Car roster', async () => {
  const db = fakeDb({
    ...seed,
    'players/carhost123': { lineUserId: 'UH', displayName: 'Car Host' },
    'cars/car67890': { ownerId: 'carhost123' },
    'carDetailViews/car67890': { car: {
      id: 'car67890', scriptName: '測試場', gameDate: '2025-03-01', playRecordStatus: 'completed',
      playRecordParticipants: [
        { personId: 'alice123', role: 'player', attendance: 'attended' },
        { personId: 'bob1234', role: 'player', attendance: 'absent' },
        { personId: 'guest123', role: 'player', attendance: 'unconfirmed' }
      ]
    } }
  });
  const handler = handlerFactory.createHandler({ db, readCookie: req => req.headers.cookie, verifySession: token => ({ valid: true, data: token === 'carhost' ? { profileId: 'carhost123', lineUserId: 'UH' } : ({ alice: { profileId: 'alice123', lineUserId: 'U1' }, bob: { profileId: 'bob1234', lineUserId: 'UB' }, outsider: { profileId: 'outside123', lineUserId: 'U9' }, manager: { profileId: 'admin123', lineUserId: 'UA' } })[token] }) });
  const attendee = await request(handler, { token: 'alice', query: { action: 'session', id: 'car:car67890' } });
  assert.equal(attendee.statusCode, 200);
  const absent = await request(handler, { token: 'bob', query: { action: 'session', id: 'car:car67890' } });
  assert.equal(absent.statusCode, 403);
  const outsider = await request(handler, { token: 'outsider', query: { action: 'session', id: 'car:car67890' } });
  assert.equal(outsider.statusCode, 403);
  const manager = await request(handler, { token: 'manager', query: { action: 'session', id: 'car:car67890' } });
  assert.equal(manager.statusCode, 200);
  const carManager = await request(handler, { token: 'carhost', query: { action: 'session', id: 'car:car67890' } });
  assert.equal(carManager.statusCode, 200, 'the Car manager can see and manage this Car roster even when not a participant');
});

test('cancelled Cars cannot be converted into completed play records', async () => {
  const db = fakeDb({
    ...seed,
    'cars/car99999': { ownerId: 'alice123', status: 'cancelled', players: [{ personId: 'alice123', status: 'confirmed' }] },
    'carDetailViews/car99999': { car: { id: 'car99999', scriptName: '取消場', gameDate: '2025-03-01', players: [{ personId: 'alice123', status: 'confirmed' }] } }
  });
  const result = await request(handlerFor(db), { method: 'POST', token: 'alice', body: {
    action: 'car_complete', carId: 'car99999', attendance: { alice123: 'attended' }
  } });
  assert.equal(result.statusCode, 409);
  assert.equal(db.docs.get('cars/car99999').playRecordStatus, undefined);
  assert.equal(db.docs.has('personPlayHistoryViews/alice123'), false);
});

test('scheduled and still-open Cars cannot be counted as completed play', async () => {
  const db = fakeDb({
    ...seed,
    'cars/car55555': { ownerId: 'alice123', status: '招募中', players: [{ personId: 'alice123', status: 'confirmed' }] },
    'carDetailViews/car55555': { car: { id: 'car55555', scriptName: '尚未開演', gameDate: '2027-03-01', players: [{ personId: 'alice123', status: 'confirmed' }] } }
  });
  const result = await request(handlerFor(db), { method: 'POST', token: 'alice', body: {
    action: 'car_complete', carId: 'car55555', attendance: { alice123: 'attended' }
  } });
  assert.equal(result.statusCode, 409);
  assert.equal(db.docs.get('cars/car55555').playRecordStatus, undefined);
  assert.equal(db.docs.has('personPlayHistoryViews/alice123'), false);
});

test('anonymous requests cannot read private prepared views or session rosters', async () => {
  const db = fakeDb(seed);
  const handler = handlerFactory.createHandler({
    db,
    readCookie: () => '',
    verifySession: () => ({ valid: false })
  });
  const result = await request(handler, { query: { action: 'me' } });
  assert.equal(result.statusCode, 401);
  assert.equal(db.readPaths.length, 0, 'authentication fails before Firestore reads');
});


test('historical detail honors merged Person aliases, dedupes roster, and still rejects outsiders', async () => {
  const id = 'hist:legacyalias001';
  const db = fakeDb({
    ...seed,
    ['playHistorySessions/' + id]: {
      id, sourceType: 'historical', scriptName: '舊人員歸戶測試', date: '2025-04-01',
      status: 'completed', participants: [
        { personId: 'oldalice123', role: 'player', attendance: 'attended' },
        { personId: 'alice123', role: 'host', attendance: 'unconfirmed' },
        { personId: 'bob1234', role: 'player', attendance: 'attended' }
      ]
    }
  });
  const handler = handlerFor(db);
  const result = await request(handler, { token: 'alice', query: { action: 'session', id } });
  assert.equal(result.statusCode, 200, 'canonical identity may view a previously recorded alias attendance');
  const alice = result.body.participants.filter(p => p.personId === 'alice123');
  assert.equal(alice.length, 1, 'historical alias and canonical person must display once');
  assert.equal(alice[0].role, 'host', 'host role takes precedence over player');
  assert.equal(alice[0].attendance, 'attended', 'verified attendance on legacy alias is retained');
  assert.equal(result.body.session.participants.length, 2, 'normalized read session also deduplicates');
  assert.deepEqual(result.body.participants.map(p => p.personId).sort(), ['alice123', 'bob1234']);
  const outsider = await request(handler, { token: 'outsider', query: { action: 'session', id } });
  assert.equal(outsider.statusCode, 403, 'merging identities must not expose private rosters');
  assert.equal(outsider.body.error, 'session_access_denied');
  assert.equal(db.writeBatches.length, 0, 'detail read must not modify Person or history data');
});


test('completed Car detail stays accessible after Person merge and does not duplicate canonical attendees', async () => {
  const db = fakeDb({
    ...seed,
    'carDetailViews/car89012': { car: {
      id: 'car89012', scriptName: '車團舊身分測試', gameDate: '2025-05-02',
      playRecordStatus: 'completed',
      playRecordParticipants: [
        { personId: 'oldalice123', role: 'player', attendance: 'attended' },
        { personId: 'alice123', role: 'host', attendance: 'unconfirmed' },
        { personId: 'bob1234', role: 'player', attendance: 'attended' }
      ]
    } }
  });
  const handler = handlerFor(db);
  const result = await request(handler, { token: 'alice', query: { action: 'session', id: 'car:car89012' } });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.participants.map(p => p.personId).sort(), ['alice123', 'bob1234']);
  const alice = result.body.participants.find(p => p.personId === 'alice123');
  assert.equal(alice.role, 'host');
  assert.equal(alice.attendance, 'attended');
  assert.equal(result.body.session.participants.length, 2, 'prepared Car detail must not fail with duplicate canonical IDs');
  const outsider = await request(handler, { token: 'outsider', query: { action: 'session', id: 'car:car89012' } });
  assert.equal(outsider.statusCode, 403);
  assert.equal(db.writeBatches.length, 0, 'reading merged Car detail never rewrites Source of Truth');
});


test('play history rejects forwarded-host spoofing but accepts the same Vercel Preview origin', async () => {
  const db = fakeDb(seed), handler = handlerFor(db);
  const previewHost = 'jly-host-system-eeso-git-feature-play-records-ui-ps19891220.vercel.app';
  const hostile = await request(handler, { token: 'alice', headers: {
    origin: 'https://evil.vercel.app', host: previewHost, 'x-forwarded-host': 'evil.vercel.app'
  } });
  assert.equal(hostile.statusCode, 403);
  assert.equal(hostile.body.error, 'origin_not_allowed');
  assert.equal(db.readPaths.length, 0, 'cross-site rejection occurs before Person and Firestore reads');
  const preview = await request(handler, { token: 'alice', headers: {
    origin: 'https://' + previewHost, host: previewHost
  } });
  assert.equal(preview.statusCode, 200, 'normal protected Preview host remains supported');
});


test('manager can add a new participant to an existing historical session atomically', async () => {
  const db = fakeDb(seed), handler = handlerFor(db);
  const created = await request(handler, {method: 'POST', token: 'manager', body: {
    action: 'history_upsert', scriptName: '新增參與者測試', date: '2025-08-11', participants: [
      {personId: 'alice123', role: 'player', attendance: 'attended'},
      {personId: 'bob1234', role: 'player', attendance: 'attended'}
    ]
  }});
  assert.equal(created.statusCode, 200);
  const id = created.body.result.sessionId;
  const updated = await request(handler, {method: 'POST', token: 'manager', body: {
    action: 'history_upsert', id, scriptName: '新增參與者測試', date: '2025-08-11', participants: [
      {personId: 'alice123', role: 'player', attendance: 'attended'},
      {personId: 'bob1234', role: 'player', attendance: 'attended'},
      {personId: 'guest123', role: 'npc', attendance: 'attended'}
    ]
  }});
  assert.equal(updated.statusCode, 200, 'new attendee must not be rejected for lacking a prior card');
  assert.equal(db.docs.get('personPlayHistoryViews/guest123').playedCount, 1);
  assert.equal(db.docs.get('personPlayHistoryViews/guest123').sessions[0].sessionId, id);
  assert.equal(db.docs.get('personPlayHistoryViews/alice123').sessions.length, 1);
  assert.equal(db.docs.get('playHistorySessions/' + id).participants.length, 3);
  assert.equal(db.writeBatches.at(-1).length, 4, 'single transaction updates shared source and three person views');
});

test('manager historical edit rehomes a merged Person view without duplicating a shared session', async () => {
  const db = fakeDb(seed), handler = handlerFor(db);
  const created = await request(handler, {method: 'POST', token: 'manager', body: {
    action: 'history_upsert', scriptName: '歷史歸戶測試', date: '2025-09-21', participants: [
      {personId: 'alice123', role: 'player', attendance: 'attended'},
      {personId: 'bob1234', role: 'player', attendance: 'attended'}
    ]
  }});
  assert.equal(created.statusCode, 200);
  const id = created.body.result.sessionId;
  db.docs.set('players/alice123', {mergedIntoPersonId: 'newalice123', displayName: '舊 Person'});
  db.docs.set('players/newalice123', {lineUserId: 'U1', displayName: '新 canonical'});
  const updated = await request(handler, {method: 'POST', token: 'manager', body: {
    action: 'history_upsert', id, scriptName: '歷史歸戶測試', date: '2025-09-21', participants: [
      {personId: 'oldalice123', role: 'host', attendance: 'attended'},
      {personId: 'bob1234', role: 'player', attendance: 'attended'}
    ]
  }});
  assert.equal(updated.statusCode, 200);
  assert.equal(db.docs.get('personPlayHistoryViews/alice123').total, 0, 'stale canonical Person view is cleared');
  assert.equal(db.docs.get('personPlayHistoryViews/newalice123').playedCount, 1, 'new canonical Person receives one card');
  assert.equal(db.docs.get('personPlayHistoryViews/newalice123').sessions[0].role, 'host');
  assert.equal(db.docs.get('playHistorySessions/' + id).participants[0].personId, 'newalice123');
  assert.equal(db.docs.get('personPlayHistoryViews/bob1234').total, 1);
  assert.equal(db.writeBatches.at(-1).length, 4, 'one Source plus old, new, and unaffected Person views');
  assert.equal([...db.docs.keys()].filter(key => key === 'playHistorySessions/' + id).length, 1);
});
