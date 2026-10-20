import * as THREE from 'three';

export type WeaponId =
  | 'lorien_bow'
  | 'erebor_crossbow'
  | 'anor_staff'
  | 'mithril_repeater'
  | 'bard_black_bow'
  | 'durin_thunder';

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  upgradedName: string;
  loreSubtitle: string;
  damage: number;
  fireRateMs: number;
  magSize: number;
  currentMag: number;
  reserveAmmo: number;
  maxReserveAmmo: number;
  reloadTimeMs: number;
  projectileSpeed: number;
  projectileColor: number;
  upgradedProjectileColor: number;
  isUpgraded: boolean;
  isAutomatic: boolean;
  splashRadius: number;
  pelletCount: number;
  spread: number;
}

export type EnemyType = 'goblin' | 'orc' | 'uruk';

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  name: string;
  mesh: THREE.Group;
  headMesh: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  state: 'approaching_window' | 'breaking_barrier' | 'chasing' | 'dead';
  targetWindowId: number;
  barrierAttackTimer: number;
  playerAttackTimer: number;
  walkCycle: number;
  hitFlashTimer: number;
  deathTimer: number;
  // Multi-player intelligent targeting & smooth client interpolation
  targetPlayerId?: string;
  targetReevalTimer?: number;
  aggroPlayerId?: string;
  aggroTimer?: number;
  netX?: number;
  netY?: number;
  netZ?: number;
  netYaw?: number;
}

export interface BarricadeWindow {
  id: number;
  roomId: number;
  position: THREE.Vector3;
  rotationY: number;
  outsideSpawnPos: THREE.Vector3;
  insideEntryPos: THREE.Vector3;
  planks: number;
  maxPlanks: number;
  plankMeshes: THREE.Mesh[];
}

export type DoorId =
  | 'door_zone_2'
  | 'door_zone_3_north'
  | 'door_zone_3_south'
  | 'door_zone_4_north'
  | 'door_zone_4_south'
  | 'door_zone_5';

export interface InteractableItem {
  id: string;
  type: 'wall_weapon' | 'door' | 'perk' | 'pack_a_punch' | 'mystery_box' | 'window';
  title: string;
  subtitle: string;
  cost: number;
  ammoCost?: number;
  weaponId?: WeaponId;
  perkId?: PerkId;
  windowId?: number;
  doorId?: DoorId;
  roomIdUnlocked?: number;
  position: THREE.Vector3;
  radius: number;
  mesh?: THREE.Object3D;
}

export type PerkId = 'beorn_mead' | 'lembas_bread' | 'shire_ale' | 'earendil_light';

export interface PerkInfo {
  id: PerkId;
  name: string;
  codEquivalent: string;
  description: string;
  cost: number;
  color: string;
  icon: string;
}

export interface FloatingPointPopup {
  id: number;
  value: number;
  isCrit: boolean;
  x: number;
  y: number;
}

export interface ActivePowerUp {
  type: 'insta_kill' | 'double_points' | 'max_ammo';
  name: string;
  remainingSec: number;
}

export interface GameMapInfo {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  loadingImage?: string;
  available: boolean;
  tag: string;
  tagClass: 'available' | 'locked' | 'soon';
  location: string;
  difficulty: string;
  era: string;
  roomsCount: number;
  description: string;
  loreQuote: string;
  rooms: string[];
  features: string[];
  wonderWeapon: string;
  specialEnemy: string;
}

// ===========================================================================
// LAN MULTIPLAYER MODELS (UP TO 4 PLAYERS CO-OP)
// ===========================================================================
export type HeroId = 'legolas' | 'gimli' | 'gandalf' | 'aragorn';

export interface HeroPreset {
  id: HeroId;
  name: string;
  title: string;
  color: string;
  hexColor: number;
  cloakColor: number;
  armorColor: number;
}

export interface LanRoomPlayerInfo {
  id: string;
  name: string;
  heroId: HeroId;
  color: string;
  isHost: boolean;
  ready: boolean;
  slotIndex: number;
}

export interface LanRoomSummary {
  id: string;
  name: string;
  hostName: string;
  hostIp: string;
  wsPort: number;
  mapId: string;
  mapTitle: string;
  startRound: number;
  freeDoors: boolean;
  bonusPoints: boolean;
  state: 'lobby' | 'playing';
  playerCount: number;
  maxPlayers: number;
  players: LanRoomPlayerInfo[];
  isLocalHost?: boolean;
}

export interface RemotePlayerAvatarRig {
  group: THREE.Group;
  headGroup: THREE.Group;
  bodyGroup: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  weaponGroup: THREE.Group;
  hpBarFill: THREE.Mesh;
  nameSprite: THREE.Sprite;
  downedBeacon: THREE.Object3D;
  displayedWeaponId: WeaponId;
  displayedWeaponUpgraded: boolean;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  heroId: HeroId;
  color: string;
  slotIndex: number;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
  health: number;
  maxHealth: number;
  points: number;
  kills: number;
  headshots: number;
  weaponId: WeaponId;
  weaponUpgraded: boolean;
  weaponName: string;
  isMoving: boolean;
  isSprinting: boolean;
  isAiming: boolean;
  isDowned: boolean;
  bleedoutTimer: number;
  reviveProgress: number;
  walkCycle: number;
  attackRecoilTimer: number;
  hitFlashTimer: number;
  roomName: string;
  floorLabel: string;
  lastUpdateMs: number;
  avatar?: RemotePlayerAvatarRig;
}

export interface NetworkEnemySnapshot {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  state: 'approaching_window' | 'breaking_barrier' | 'chasing' | 'dead';
  targetWindowId: number;
  targetPlayerId?: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}
