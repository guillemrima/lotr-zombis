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
