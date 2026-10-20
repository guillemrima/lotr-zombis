/**
 * LOTR ZOMBIES: KHAZAD-DÛM — LAN Multiplayer & UDP Discovery Server
 * Zero external dependencies (uses built-in Node.js http, crypto, dgram, os).
 * Supports up to 4 players per room over LAN with automatic UDP broadcast discovery
 * and direct IP connection fallback.
 */

const http = require('http');
const crypto = require('crypto');
const dgram = require('dgram');
const os = require('os');

const WS_PORT = Number(process.env.LAN_PORT || 4300);
const UDP_PORT = Number(process.env.LAN_UDP_PORT || 4301);
const MAX_PLAYERS = 4;

/**
 * Returns all non-internal IPv4 addresses and their subnet broadcast addresses.
 */
function getLanInterfaces() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        const ipParts = net.address.split('.').map(Number);
        const maskParts = net.netmask.split('.').map(Number);
        const bcastParts = ipParts.map((octet, idx) => (octet | (~maskParts[idx] & 255)));
        results.push({
          name,
          address: net.address,
          netmask: net.netmask,
          broadcast: bcastParts.join('.')
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      name: 'loopback',
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      broadcast: '255.255.255.255'
    });
  }

  return results;
}

/**
 * Picks the best primary LAN IPv4 address (prefers 192.168.x.x, 10.x.x.x, 172.16-31.x.x).
 */
function getPrimaryLanIp() {
  const list = getLanInterfaces();
  const preferred = list.find(
    (i) =>
      i.address.startsWith('192.168.') ||
      i.address.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(i.address)
  );
  return preferred ? preferred.address : list[0].address;
}

// ============================================================================
// STATE: LOCAL HOSTED ROOMS & REMOTE UDP-DISCOVERED ROOMS
// ============================================================================
const localRooms = new Map(); // roomId -> RoomObject
const discoveredRemoteRooms = new Map(); // key `${hostIp}:${roomId}` -> { roomSummary, lastSeen }
const clients = new Set(); // Set<ClientConnection>

let nextClientId = 1;

function serializeRoomSummary(room, overrideHostIp) {
  const hostIp = overrideHostIp || room.hostIp || getPrimaryLanIp();
  return {
    id: room.id,
    name: room.name,
    hostName: room.hostName,
    hostIp,
    wsPort: WS_PORT,
    mapId: room.mapId,
    mapTitle: room.mapTitle,
    startRound: room.startRound,
    freeDoors: room.freeDoors,
    bonusPoints: room.bonusPoints,
    state: room.state, // 'lobby' | 'playing'
    playerCount: room.players.length,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      heroId: p.heroId,
      color: p.color,
      isHost: p.isHost,
      ready: p.ready,
      slotIndex: p.slotIndex
    }))
  };
}

function getAllAvailableRooms() {
  const now = Date.now();
  const list = [];
  const localIds = new Set();

  for (const room of localRooms.values()) {
    localIds.add(room.id);
    list.push({
      ...serializeRoomSummary(room),
      isLocalHost: true
    });
  }

  for (const [key, entry] of discoveredRemoteRooms.entries()) {
    if (now - entry.lastSeen > 5000) {
      discoveredRemoteRooms.delete(key);
      continue;
    }
    if (localIds.has(entry.room.id)) continue;
    list.push({
      ...entry.room,
      isLocalHost: false
    });
  }

  return list;
}

// ============================================================================
// MINIMAL RFC-6455 WEBSOCKET FRAME PARSER & SENDER
// ============================================================================
function encodeWsFrame(dataStr) {
  const payload = Buffer.from(dataStr, 'utf8');
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

function sendJson(client, obj) {
  if (!client || client.closed || !client.socket.writable) return;
  try {
    const frame = encodeWsFrame(JSON.stringify(obj));
    client.socket.write(frame);
  } catch {
    // Ignore write errors on closing sockets
  }
}

function broadcastToRoom(room, obj, excludeClientId = null) {
  const frame = encodeWsFrame(JSON.stringify(obj));
  for (const p of room.players) {
    if (excludeClientId && p.id === excludeClientId) continue;
    if (p.client && !p.client.closed && p.client.socket.writable) {
      try {
        p.client.socket.write(frame);
      } catch {
        // Ignore
      }
    }
  }
}

function broadcastRoomListToLobbyClients() {
  const rooms = getAllAvailableRooms();
  for (const c of clients) {
    if (!c.roomId) {
      sendJson(c, { type: 'rooms_list', rooms });
    }
  }
}

// ============================================================================
// ROOM & PLAYER MANAGEMENT
// ============================================================================
const HERO_PRESETS = [
  { id: 'legolas', name: 'Legolas', color: '#facc15' },
  { id: 'gimli', name: 'Gimli', color: '#ef4444' },
  { id: 'gandalf', name: 'Gandalf', color: '#38bdf8' },
  { id: 'aragorn', name: 'Aragorn', color: '#22c55e' }
];

function createRoom(client, payload) {
  leaveCurrentRoom(client);

  const roomId =
    (payload.roomId && String(payload.roomId).trim()) ||
    'MORIA-' + Math.random().toString(36).substring(2, 6).toUpperCase();

  const hostIp = getPrimaryLanIp();
  const playerName = (payload.playerName || 'Legolas').slice(0, 20);
  const heroId = payload.heroId || HERO_PRESETS[0].id;
  const heroColor =
    HERO_PRESETS.find((h) => h.id === heroId)?.color || HERO_PRESETS[0].color;

  const playerEntry = {
    id: client.id,
    name: playerName,
    heroId,
    color: heroColor,
    isHost: true,
    ready: true,
    slotIndex: 0,
    client
  };

  const room = {
    id: roomId,
    name: (payload.roomName || `Compañía de ${playerName}`).slice(0, 32),
    hostName: playerName,
    hostIp,
    hostClientId: client.id,
    mapId: payload.mapId || 'khazad_dum',
    mapTitle: payload.mapTitle || 'KHAZAD-DÛM',
    startRound: Math.max(1, Math.min(99, Number(payload.startRound) || 1)),
    freeDoors: Boolean(payload.freeDoors),
    bonusPoints: payload.bonusPoints !== undefined ? Boolean(payload.bonusPoints) : true,
    state: 'lobby',
    players: [playerEntry]
  };

  client.roomId = roomId;
  localRooms.set(roomId, room);

  sendJson(client, {
    type: 'room_joined',
    playerId: client.id,
    slotIndex: 0,
    isHost: true,
    room: serializeRoomSummary(room)
  });

  broadcastRoomListToLobbyClients();
  broadcastRoomsOverUdp();
}

function joinRoom(client, payload) {
  const roomId = payload.roomId;
  let room = roomId ? localRooms.get(roomId) : null;

  // If no roomId specified or not found by exact ID, join the first available local room
  if (!room && localRooms.size > 0) {
    room = localRooms.values().next().value;
  }

  if (!room) {
    sendJson(client, {
      type: 'error',
      message: 'La sala seleccionada ya no existe o fue cerrada.'
    });
    return;
  }

  if (room.players.length >= MAX_PLAYERS) {
    sendJson(client, {
      type: 'error',
      message: 'La sala está llena (máximo 4 jugadores).'
    });
    return;
  }

  leaveCurrentRoom(client);

  // Find lowest unused slotIndex (0..3)
  const usedSlots = new Set(room.players.map((p) => p.slotIndex));
  let slotIndex = 0;
  while (usedSlots.has(slotIndex) && slotIndex < MAX_PLAYERS) {
    slotIndex++;
  }

  const defaultHero = HERO_PRESETS[slotIndex % HERO_PRESETS.length];
  const playerName = (payload.playerName || defaultHero.name).slice(0, 20);
  const heroId = payload.heroId || defaultHero.id;
  const heroColor = defaultHero.color;

  const playerEntry = {
    id: client.id,
    name: playerName,
    heroId,
    color: heroColor,
    isHost: false,
    ready: true,
    slotIndex,
    client
  };

  room.players.push(playerEntry);
  client.roomId = room.id;

  const summary = serializeRoomSummary(room);

  sendJson(client, {
    type: 'room_joined',
    playerId: client.id,
    slotIndex,
    isHost: false,
    room: summary
  });

  broadcastToRoom(
    room,
    {
      type: 'room_updated',
      room: summary,
      joinedPlayer: {
        id: playerEntry.id,
        name: playerEntry.name,
        heroId: playerEntry.heroId,
        color: playerEntry.color,
        slotIndex: playerEntry.slotIndex
      }
    },
    client.id
  );

  broadcastRoomListToLobbyClients();
  broadcastRoomsOverUdp();
}

function leaveCurrentRoom(client) {
  if (!client.roomId) return;
  const room = localRooms.get(client.roomId);
  client.roomId = null;
  if (!room) return;

  const idx = room.players.findIndex((p) => p.id === client.id);
  if (idx === -1) return;

  const removed = room.players[idx];
  room.players.splice(idx, 1);

  if (room.players.length === 0) {
    localRooms.delete(room.id);
    broadcastRoomListToLobbyClients();
    return;
  }

  // If the host left, promote the next player to Host so the match can continue!
  if (removed.isHost) {
    const newHost = room.players[0];
    newHost.isHost = true;
    room.hostClientId = newHost.id;
    room.hostName = newHost.name;
    sendJson(newHost.client, {
      type: 'host_promoted',
      playerId: newHost.id
    });
  }

  const summary = serializeRoomSummary(room);
  broadcastToRoom(room, {
    type: 'room_updated',
    room: summary,
    leftPlayerId: client.id
  });

  broadcastRoomListToLobbyClients();
}

function handleClientMessage(client, msg) {
  if (!msg || typeof msg.type !== 'string') return;

  switch (msg.type) {
    case 'list_rooms': {
      sendJson(client, {
        type: 'rooms_list',
        rooms: getAllAvailableRooms(),
        lanIp: getPrimaryLanIp(),
        interfaces: getLanInterfaces()
      });
      break;
    }

    case 'create_room': {
      createRoom(client, msg);
      break;
    }

    case 'join_room': {
      joinRoom(client, msg);
      break;
    }

    case 'leave_room': {
      leaveCurrentRoom(client);
      sendJson(client, { type: 'room_left' });
      break;
    }

    case 'update_profile': {
      const room = localRooms.get(client.roomId);
      if (!room) return;
      const p = room.players.find((pl) => pl.id === client.id);
      if (!p) return;
      if (msg.playerName) {
        p.name = String(msg.playerName).slice(0, 20);
        if (p.isHost) room.hostName = p.name;
      }
      if (msg.heroId) {
        p.heroId = msg.heroId;
      }
      if (typeof msg.ready === 'boolean') {
        p.ready = msg.ready;
      }
      if (p.isHost) {
        if (msg.roomName) room.name = String(msg.roomName).slice(0, 32);
        if (msg.startRound !== undefined) {
          room.startRound = Math.max(1, Math.min(99, Number(msg.startRound) || 1));
        }
        if (msg.freeDoors !== undefined) room.freeDoors = Boolean(msg.freeDoors);
        if (msg.bonusPoints !== undefined) room.bonusPoints = Boolean(msg.bonusPoints);
      }
      const summary = serializeRoomSummary(room);
      broadcastToRoom(room, { type: 'room_updated', room: summary });
      broadcastRoomListToLobbyClients();
      break;
    }

    case 'start_match': {
      const room = localRooms.get(client.roomId);
      if (!room || room.hostClientId !== client.id) return;
      room.state = 'playing';
      if (msg.startRound !== undefined) {
        room.startRound = Math.max(1, Math.min(99, Number(msg.startRound) || 1));
      }
      if (msg.freeDoors !== undefined) room.freeDoors = Boolean(msg.freeDoors);
      if (msg.bonusPoints !== undefined) room.bonusPoints = Boolean(msg.bonusPoints);

      const summary = serializeRoomSummary(room);
      broadcastToRoom(room, {
        type: 'match_started',
        room: summary
      });
      broadcastRoomListToLobbyClients();
      break;
    }

    // High-frequency real-time gameplay messages relayed across the room
    case 'player_state':
    case 'world_snapshot':
    case 'player_shoot':
    case 'enemy_hit':
    case 'door_unlock':
    case 'window_repair':
    case 'powerup_spawn':
    case 'powerup_pickup':
    case 'round_change':
    case 'player_downed':
    case 'player_revive':
    case 'player_damaged':
    case 'game_over':
    case 'restart_match': {
      const room = localRooms.get(client.roomId);
      if (!room) return;
      msg.senderId = client.id;
      broadcastToRoom(room, msg, client.id);
      break;
    }
  }
}

// ============================================================================
// HTTP + WEBSOCKET SERVER
// ============================================================================
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url && req.url.startsWith('/api/lan-info')) {
    const hostHeader = req.headers.host ? req.headers.host.split(':')[0] : null;
    const primaryIp =
      hostHeader && hostHeader !== 'localhost' && hostHeader !== '127.0.0.1'
        ? hostHeader
        : getPrimaryLanIp();

    const rooms = getAllAvailableRooms().map((r) =>
      r.isLocalHost ? { ...r, hostIp: primaryIp } : r
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        hostname: os.hostname(),
        primaryIp,
        wsPort: WS_PORT,
        interfaces: getLanInterfaces(),
        rooms
      })
    );
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('LOTR Zombies LAN Server Active\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ].join('\r\n')
  );

  socket.setNoDelay(true);

  const client = {
    id: `p_${nextClientId++}_${Math.random().toString(36).slice(2, 6)}`,
    socket,
    roomId: null,
    closed: false,
    buffer: Buffer.alloc(0)
  };
  clients.add(client);

  sendJson(client, {
    type: 'welcome',
    clientId: client.id,
    lanIp: getPrimaryLanIp(),
    wsPort: WS_PORT,
    rooms: getAllAvailableRooms()
  });

  socket.on('data', (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);

    while (client.buffer.length >= 2) {
      const firstByte = client.buffer[0];
      const secondByte = client.buffer[1];
      const opcode = firstByte & 0x0f;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (client.buffer.length < 4) return;
        payloadLen = client.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (client.buffer.length < 10) return;
        payloadLen = Number(client.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = isMasked ? 4 : 0;
      if (client.buffer.length < offset + maskLen + payloadLen) {
        return;
      }

      let payload = client.buffer.subarray(
        offset + maskLen,
        offset + maskLen + payloadLen
      );

      if (isMasked) {
        const mask = client.buffer.subarray(offset, offset + 4);
        const unmasked = Buffer.allocUnsafe(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          unmasked[i] = payload[i] ^ mask[i & 3];
        }
        payload = unmasked;
      }

      client.buffer = client.buffer.subarray(offset + maskLen + payloadLen);

      if (opcode === 0x8) {
        // Close frame
        cleanupClient(client);
        socket.end();
        return;
      } else if (opcode === 0x9) {
        // Ping -> Pong
        const pong = Buffer.from([0x8a, 0x00]);
        socket.write(pong);
      } else if (opcode === 0x1) {
        // Text frame
        try {
          const parsed = JSON.parse(payload.toString('utf8'));
          handleClientMessage(client, parsed);
        } catch {
          // Ignore malformed JSON
        }
      }
    }
  });

  const cleanupClient = (c) => {
    if (c.closed) return;
    c.closed = true;
    leaveCurrentRoom(c);
    clients.delete(c);
  };

  socket.on('close', () => cleanupClient(client));
  socket.on('error', () => cleanupClient(client));
});

// ============================================================================
// UDP LAN DISCOVERY (Auto-detect open rooms across PCs on the same network)
// ============================================================================
const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

function broadcastRoomsOverUdp() {
  if (localRooms.size === 0) return;
  const interfaces = getLanInterfaces();

  for (const room of localRooms.values()) {
    for (const iface of interfaces) {
      const summary = serializeRoomSummary(room, iface.address);
      const packet = Buffer.from(
        JSON.stringify({
          magic: 'LOTR_ZOMBIES_LAN_V1',
          room: summary
        }),
        'utf8'
      );

      try {
        udpSocket.send(packet, 0, packet.length, UDP_PORT, iface.broadcast);
      } catch {
        // Ignore broadcast error
      }
      if (iface.broadcast !== '255.255.255.255') {
        try {
          udpSocket.send(packet, 0, packet.length, UDP_PORT, '255.255.255.255');
        } catch {
          // Ignore
        }
      }
    }
  }
}

udpSocket.on('message', (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString('utf8'));
    if (!data || data.magic !== 'LOTR_ZOMBIES_LAN_V1' || !data.room) return;
    const room = data.room;
    if (localRooms.has(room.id)) return; // Already hosted on this machine

    const hostIp = rinfo.address || room.hostIp;
    const key = `${hostIp}:${room.id}`;
    const isNew = !discoveredRemoteRooms.has(key);

    discoveredRemoteRooms.set(key, {
      room: {
        ...room,
        hostIp,
        isLocalHost: false
      },
      lastSeen: Date.now()
    });

    if (isNew) {
      broadcastRoomListToLobbyClients();
    }
  } catch {
    // Ignore non-JSON UDP packets
  }
});

udpSocket.on('error', () => {
  // If UDP port is busy on same machine, HTTP + WebSocket still works seamlessly
});

function startLanServer() {
  try {
    udpSocket.bind(UDP_PORT, '0.0.0.0', () => {
      try {
        udpSocket.setBroadcast(true);
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore UDP bind errors
  }

  setInterval(() => {
    broadcastRoomsOverUdp();
  }, 1500);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(
        `[LAN Server] Puerto ${WS_PORT} ya está activo en esta máquina (usando instancia existente).`
      );
    } else {
      console.error('[LAN Server] Error:', err.message);
    }
  });

  server.listen(WS_PORT, '0.0.0.0', () => {
    const ip = getPrimaryLanIp();
    console.log('================================================================');
    console.log(' ⚔  LOTR ZOMBIES — SERVIDOR MULTIJUGADOR LAN ACTIVO (Hasta 4 Jugadores)');
    console.log(` ❖  IP Local en Red (LAN): ${ip}:${WS_PORT}`);
    console.log(` ❖  Autodescubrimiento UDP: Puerto ${UDP_PORT}`);
    console.log('================================================================');
  });
}

if (require.main === module) {
  startLanServer();
}

module.exports = { startLanServer };
