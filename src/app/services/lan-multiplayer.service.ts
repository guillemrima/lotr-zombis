import { Injectable, signal, computed } from '@angular/core';
import {
  HeroId,
  HeroPreset,
  LanRoomSummary
} from '../models/game.models';

export const HERO_CATALOG: HeroPreset[] = [
  {
    id: 'legolas',
    name: 'Legolas',
    title: 'Arquero de Lothlórien',
    color: '#facc15',
    hexColor: 0xfacc15,
    cloakColor: 0x14532d,
    armorColor: 0x713f12
  },
  {
    id: 'gimli',
    name: 'Gimli',
    title: 'Guardián de Erebor',
    color: '#ef4444',
    hexColor: 0xef4444,
    cloakColor: 0x7f1d1d,
    armorColor: 0x451a03
  },
  {
    id: 'gandalf',
    name: 'Gandalf',
    title: 'Portador de Anor',
    color: '#38bdf8',
    hexColor: 0x38bdf8,
    cloakColor: 0x334155,
    armorColor: 0x1e293b
  },
  {
    id: 'aragorn',
    name: 'Aragorn',
    title: 'Montaraz del Norte',
    color: '#22c55e',
    hexColor: 0x22c55e,
    cloakColor: 0x14532d,
    armorColor: 0x1e293b
  }
];

@Injectable({
  providedIn: 'root'
})
export class LanMultiplayerService {
  readonly heroes = HERO_CATALOG;

  readonly isConnected = signal(false);
  readonly usingLocalFallback = signal(false);
  readonly localLanIp = signal<string>(window.location.hostname || '127.0.0.1');
  readonly wsPort = signal<number>(4300);

  readonly availableRooms = signal<LanRoomSummary[]>([]);
  readonly currentRoom = signal<LanRoomSummary | null>(null);
  readonly localPlayerId = signal<string>('');
  readonly localSlotIndex = signal<number>(0);
  readonly isHost = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly playerName = signal<string>(
    sessionStorage.getItem('lotr_mp_name') ||
      `Explorador-${Math.floor(100 + Math.random() * 899)}`
  );
  readonly selectedHeroId = signal<HeroId>(
    (sessionStorage.getItem('lotr_mp_hero') as HeroId) || 'legolas'
  );
  readonly customRoomName = signal<string>('');
  readonly directHostIpInput = signal<string>('');

  readonly isInRoom = computed(() => this.currentRoom() !== null);
  readonly isMultiplayerMatch = computed(
    () => this.currentRoom() !== null && this.currentRoom()!.playerCount >= 1
  );

  /** High-frequency callback invoked outside Angular zone for game packets */
  onGamePacket: ((msg: any) => void) | null = null;

  private ws: WebSocket | null = null;
  private connectedServerHost = '';
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackChannel: BroadcastChannel | null = null;
  private fallbackRooms = new Map<string, LanRoomSummary>();

  constructor() {
    this.initBroadcastChannelFallback();
  }

  getHeroPreset(heroId?: HeroId): HeroPreset {
    return this.heroes.find((h) => h.id === heroId) || this.heroes[0];
  }

  setPlayerName(name: string): void {
    const clean = name.trim().slice(0, 18) || 'Guerrero';
    this.playerName.set(clean);
    sessionStorage.setItem('lotr_mp_name', clean);
    if (this.currentRoom()) {
      this.sendRaw({
        type: 'update_profile',
        playerName: clean,
        heroId: this.selectedHeroId()
      });
    }
  }

  setSelectedHero(heroId: HeroId): void {
    this.selectedHeroId.set(heroId);
    sessionStorage.setItem('lotr_mp_hero', heroId);
    if (this.currentRoom()) {
      this.sendRaw({
        type: 'update_profile',
        playerName: this.playerName(),
        heroId
      });
    }
  }

  /**
   * Connects to the local LAN Discovery & Host Server (or a specific LAN Host IP)
   * and begins polling for open rooms across the LAN.
   */
  connectToLanServer(targetHost?: string): void {
    const host = (targetHost || window.location.hostname || 'localhost').trim();
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/^ws:\/\//, '').split(':')[0];
    const port = host.includes(':') ? Number(host.split(':')[1]) || 4300 : 4300;

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) &&
      this.connectedServerHost === `${cleanHost}:${port}`
    ) {
      this.refreshRoomsList();
      return;
    }

    this.closeWebSocket();
    this.connectedServerHost = `${cleanHost}:${port}`;
    this.errorMessage.set(null);

    try {
      const socket = new WebSocket(`ws://${cleanHost}:${port}`);
      this.ws = socket;

      socket.onopen = () => {
        this.isConnected.set(true);
        this.usingLocalFallback.set(false);
        this.sendRaw({ type: 'list_rooms' });
        this.fetchHttpLanInfo(cleanHost, port);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch {
          // Ignore malformed message
        }
      };

      socket.onerror = () => {
        // Fallback to BroadcastChannel if local server port 4300 isn't reachable
        if (!this.isConnected()) {
          this.usingLocalFallback.set(true);
          this.ensureFallbackIdentity();
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) {
          this.isConnected.set(false);
        }
      };
    } catch {
      this.usingLocalFallback.set(true);
      this.ensureFallbackIdentity();
    }

    if (!this.discoveryTimer) {
      this.discoveryTimer = setInterval(() => {
        if (!this.currentRoom()) {
          this.refreshRoomsList();
        }
      }, 2000);
    }
  }

  private async fetchHttpLanInfo(host: string, port = 4300): Promise<void> {
    try {
      const res = await fetch(`http://${host}:${port}/api/lan-info`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.primaryIp) {
        this.localLanIp.set(data.primaryIp);
      }
      if (Array.isArray(data.rooms)) {
        this.mergeDiscoveredRooms(data.rooms);
      }
    } catch {
      // Ignore fetch errors
    }
  }

  refreshRoomsList(): void {
    if (this.isConnected()) {
      this.sendRaw({ type: 'list_rooms' });
      const host = this.connectedServerHost.split(':')[0] || window.location.hostname || 'localhost';
      this.fetchHttpLanInfo(host, this.wsPort());
    }
    const directIp = this.directHostIpInput().trim();
    if (directIp) {
      const cleanIp = directIp.replace(/^https?:\/\//, '').split(':')[0];
      this.fetchHttpLanInfo(cleanIp, 4300);
    }
    if (this.fallbackChannel) {
      this.fallbackChannel.postMessage({ type: 'fb_discover_request' });
    }
  }

  private mergeDiscoveredRooms(rooms: LanRoomSummary[]): void {
    const map = new Map<string, LanRoomSummary>();
    for (const r of rooms) {
      map.set(`${r.hostIp}:${r.id}`, r);
    }
    for (const r of this.fallbackRooms.values()) {
      if (!map.has(`${r.hostIp}:${r.id}`)) {
        map.set(`${r.hostIp}:${r.id}`, r);
      }
    }
    this.availableRooms.set(Array.from(map.values()));
  }

  /**
   * Creates a new LAN room on the local server (Host mode, up to 4 players).
   */
  createRoom(options: {
    mapId: string;
    mapTitle: string;
    startRound: number;
    freeDoors: boolean;
    bonusPoints: boolean;
  }): void {
    this.errorMessage.set(null);
    const roomName =
      this.customRoomName().trim() || `Compañía de ${this.playerName()}`;

    // Always host on our local server instance if available
    const localHost = window.location.hostname || 'localhost';
    if (this.connectedServerHost !== `${localHost}:4300` && !this.usingLocalFallback()) {
      this.connectToLanServer(localHost);
      setTimeout(() => this.createRoom(options), 250);
      return;
    }

    if (this.isConnected()) {
      this.sendRaw({
        type: 'create_room',
        roomName,
        playerName: this.playerName(),
        heroId: this.selectedHeroId(),
        ...options
      });
      return;
    }

    // Fallback mode (same-PC multi-tab without Node server)
    this.ensureFallbackIdentity();
    const roomId = 'MORIA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const hero = this.getHeroPreset(this.selectedHeroId());
    const room: LanRoomSummary = {
      id: roomId,
      name: roomName,
      hostName: this.playerName(),
      hostIp: this.localLanIp(),
      wsPort: 4300,
      mapId: options.mapId,
      mapTitle: options.mapTitle,
      startRound: options.startRound,
      freeDoors: options.freeDoors,
      bonusPoints: options.bonusPoints,
      state: 'lobby',
      playerCount: 1,
      maxPlayers: 4,
      players: [
        {
          id: this.localPlayerId(),
          name: this.playerName(),
          heroId: hero.id,
          color: hero.color,
          isHost: true,
          ready: true,
          slotIndex: 0
        }
      ],
      isLocalHost: true
    };
    this.isHost.set(true);
    this.localSlotIndex.set(0);
    this.currentRoom.set(room);
    this.fallbackRooms.set(room.id, room);
    this.broadcastFallbackRoom(room);
  }

  /**
   * Joins a discovered LAN room (connects directly to the Host's WebSocket IP if on another PC).
   */
  joinRoom(room: LanRoomSummary): void {
    this.errorMessage.set(null);
    const targetHost = room.isLocalHost
      ? window.location.hostname || 'localhost'
      : room.hostIp || window.location.hostname || 'localhost';
    const targetPort = room.wsPort || 4300;
    const targetEndpoint = `${targetHost}:${targetPort}`;

    if (!this.usingLocalFallback()) {
      if (!this.isConnected() || this.connectedServerHost !== targetEndpoint) {
        this.connectToLanServer(targetEndpoint);
        const waitOpen = setInterval(() => {
          if (this.isConnected()) {
            clearInterval(waitOpen);
            this.sendRaw({
              type: 'join_room',
              roomId: room.id,
              playerName: this.playerName(),
              heroId: this.selectedHeroId()
            });
          }
        }, 80);
        setTimeout(() => clearInterval(waitOpen), 3500);
        return;
      }

      this.sendRaw({
        type: 'join_room',
        roomId: room.id,
        playerName: this.playerName(),
        heroId: this.selectedHeroId()
      });
      return;
    }

    // Fallback mode
    this.ensureFallbackIdentity();
    this.fallbackChannel?.postMessage({
      type: 'fb_join_request',
      roomId: room.id,
      player: {
        id: this.localPlayerId(),
        name: this.playerName(),
        heroId: this.selectedHeroId(),
        color: this.getHeroPreset(this.selectedHeroId()).color
      }
    });
  }

  /**
   * Connects directly to a Host IP typed by the user and joins its open room.
   */
  joinByDirectIp(ipInput?: string): void {
    const raw = (ipInput ?? this.directHostIpInput()).trim();
    if (!raw) {
      this.errorMessage.set('Introduce la dirección IP del Host en LAN (ej. 192.168.1.45).');
      return;
    }
    this.errorMessage.set(null);
    const cleanHost = raw.replace(/^https?:\/\//, '').replace(/^ws:\/\//, '');
    const hostWithPort = cleanHost.includes(':') ? cleanHost : `${cleanHost}:4300`;

    this.connectToLanServer(hostWithPort);
    const waitOpen = setInterval(() => {
      if (this.isConnected()) {
        clearInterval(waitOpen);
        this.sendRaw({
          type: 'join_room',
          playerName: this.playerName(),
          heroId: this.selectedHeroId()
        });
      }
    }, 80);
    setTimeout(() => {
      clearInterval(waitOpen);
      if (!this.isConnected()) {
        this.errorMessage.set(
          `No se pudo conectar al Host en ${hostWithPort}. Asegúrate de que el Host tenga el proyecto corriendo (npm start).`
        );
      }
    }, 3500);
  }

  leaveRoom(): void {
    if (this.isConnected()) {
      this.sendRaw({ type: 'leave_room' });
    }
    if (this.fallbackChannel && this.currentRoom()) {
      this.fallbackChannel.postMessage({
        type: 'fb_leave',
        roomId: this.currentRoom()!.id,
        playerId: this.localPlayerId()
      });
    }
    this.currentRoom.set(null);
    this.isHost.set(false);
    this.refreshRoomsList();
  }

  startMatch(options: {
    startRound: number;
    freeDoors: boolean;
    bonusPoints: boolean;
  }): void {
    const room = this.currentRoom();
    if (!room || !this.isHost()) return;

    if (this.isConnected()) {
      this.sendRaw({
        type: 'start_match',
        ...options
      });
    } else if (this.fallbackChannel) {
      room.state = 'playing';
      room.startRound = options.startRound;
      room.freeDoors = options.freeDoors;
      room.bonusPoints = options.bonusPoints;
      this.currentRoom.set({ ...room });
      this.fallbackChannel.postMessage({
        type: 'match_started',
        room
      });
      this.onGamePacket?.({ type: 'match_started', room });
    }
  }

  sendGameEvent(payload: Record<string, any>): void {
    if (!this.currentRoom()) return;
    if (this.isConnected()) {
      this.sendRaw(payload);
    } else if (this.fallbackChannel) {
      this.fallbackChannel.postMessage({
        ...payload,
        senderId: this.localPlayerId(),
        roomId: this.currentRoom()!.id
      });
    }
  }

  private sendRaw(obj: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private handleIncomingMessage(msg: any): void {
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'welcome': {
        this.localPlayerId.set(msg.clientId);
        if (msg.lanIp) this.localLanIp.set(msg.lanIp);
        if (msg.wsPort) this.wsPort.set(msg.wsPort);
        if (Array.isArray(msg.rooms)) {
          this.mergeDiscoveredRooms(msg.rooms);
        }
        break;
      }

      case 'rooms_list': {
        if (msg.lanIp) this.localLanIp.set(msg.lanIp);
        if (Array.isArray(msg.rooms)) {
          this.mergeDiscoveredRooms(msg.rooms);
        }
        break;
      }

      case 'room_joined': {
        this.localPlayerId.set(msg.playerId);
        this.localSlotIndex.set(msg.slotIndex ?? 0);
        this.isHost.set(Boolean(msg.isHost));
        this.currentRoom.set(msg.room);
        this.onGamePacket?.(msg);
        break;
      }

      case 'room_updated': {
        this.currentRoom.set(msg.room);
        const me = msg.room?.players?.find((p: any) => p.id === this.localPlayerId());
        if (me) {
          this.isHost.set(Boolean(me.isHost));
          this.localSlotIndex.set(me.slotIndex ?? 0);
        }
        this.onGamePacket?.(msg);
        break;
      }

      case 'host_promoted': {
        this.isHost.set(true);
        this.onGamePacket?.(msg);
        break;
      }

      case 'room_left': {
        this.currentRoom.set(null);
        this.isHost.set(false);
        break;
      }

      case 'error': {
        this.errorMessage.set(msg.message || 'Error en la conexión LAN.');
        break;
      }

      default: {
        if (msg.type === 'match_started' && msg.room) {
          this.currentRoom.set(msg.room);
        }
        this.onGamePacket?.(msg);
        break;
      }
    }
  }

  private closeWebSocket(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }

  // ===========================================================================
  // LOCAL BROADCASTCHANNEL FALLBACK (Works across same-PC tabs even without WS)
  // ===========================================================================
  private ensureFallbackIdentity(): void {
    if (!this.localPlayerId()) {
      this.localPlayerId.set(
        `p_fb_${Math.random().toString(36).substring(2, 8)}`
      );
    }
  }

  private broadcastFallbackRoom(room: LanRoomSummary): void {
    this.fallbackChannel?.postMessage({
      type: 'fb_room_announce',
      room
    });
  }

  private initBroadcastChannelFallback(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.fallbackChannel = new BroadcastChannel('lotr_zombies_lan_v1');
      this.fallbackChannel.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'fb_discover_request') {
          const room = this.currentRoom();
          if (room && this.isHost()) {
            this.broadcastFallbackRoom(room);
          }
          return;
        }

        if (msg.type === 'fb_room_announce' && msg.room) {
          this.fallbackRooms.set(msg.room.id, msg.room);
          if (!this.isConnected()) {
            this.mergeDiscoveredRooms(Array.from(this.fallbackRooms.values()));
          }
          return;
        }

        if (msg.type === 'fb_join_request' && this.isHost() && this.currentRoom()) {
          const room = this.currentRoom()!;
          if (room.id !== msg.roomId || room.players.length >= 4) return;
          const exists = room.players.some((p) => p.id === msg.player.id);
          if (!exists) {
            const used = new Set(room.players.map((p) => p.slotIndex));
            let slotIndex = 0;
            while (used.has(slotIndex) && slotIndex < 4) slotIndex++;
            room.players.push({
              ...msg.player,
              isHost: false,
              ready: true,
              slotIndex
            });
            room.playerCount = room.players.length;
            this.currentRoom.set({ ...room });
            this.fallbackChannel?.postMessage({
              type: 'fb_joined_ack',
              targetPlayerId: msg.player.id,
              slotIndex,
              room
            });
            this.onGamePacket?.({ type: 'room_updated', room });
          }
          return;
        }

        if (
          msg.type === 'fb_joined_ack' &&
          msg.targetPlayerId === this.localPlayerId()
        ) {
          this.isHost.set(false);
          this.localSlotIndex.set(msg.slotIndex);
          this.currentRoom.set(msg.room);
          this.onGamePacket?.({
            type: 'room_joined',
            playerId: this.localPlayerId(),
            slotIndex: msg.slotIndex,
            isHost: false,
            room: msg.room
          });
          return;
        }

        if (msg.type === 'fb_leave' && this.currentRoom()?.id === msg.roomId) {
          const room = this.currentRoom()!;
          room.players = room.players.filter((p) => p.id !== msg.playerId);
          room.playerCount = room.players.length;
          this.currentRoom.set({ ...room });
          this.onGamePacket?.({
            type: 'room_updated',
            room,
            leftPlayerId: msg.playerId
          });
          return;
        }

        // Relay gameplay packets in fallback mode if in the same room
        if (
          this.currentRoom() &&
          msg.roomId === this.currentRoom()!.id &&
          msg.senderId !== this.localPlayerId()
        ) {
          this.onGamePacket?.(msg);
        } else if (msg.type === 'match_started' && msg.room?.id === this.currentRoom()?.id) {
          this.currentRoom.set(msg.room);
          this.onGamePacket?.(msg);
        }
      };
    } catch {
      // Ignore if BroadcastChannel unsupported
    }
  }
}
