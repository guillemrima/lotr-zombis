import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import {
  ActivePowerUp,
  BarricadeWindow,
  DoorId,
  EnemyEntity,
  EnemyType,
  FloatingPointPopup,
  GameMapInfo,
  InteractableItem,
  PerkId,
  PerkInfo,
  WeaponConfig,
  WeaponId
} from './models/game.models';
import { SoundService } from './services/sound.service';
import { MoriaSceneHelper } from './services/moria-scene.helper';

interface VisualProjectile {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  life: number;
  isUpgraded: boolean;
  spinNode?: THREE.Object3D;
  materials: THREE.Material[];
}

interface ImpactBurst {
  group: THREE.Group;
  ring1: THREE.Mesh;
  ring2?: THREE.Mesh;
  core: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
  materials: THREE.Material[];
}

interface PowerUpOrb {
  id: number;
  type: 'insta_kill' | 'double_points' | 'max_ammo';
  name: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  life: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // Performance Telemetry (FPS Counter)
  readonly fps = signal(60);
  readonly frameTimeMs = signal(16.7);
  private fpsFrames = 0;
  private fpsLastCheck = performance.now();

  // Reactive HUD State (Angular Signals)
  readonly gameStarted = signal(false);
  readonly isPaused = signal(false);
  readonly isGameOver = signal(false);

  // Main Menu & Map Selector State
  readonly currentMenuScreen = signal<'main' | 'map-select' | 'settings' | 'guide'>('main');
  readonly selectedMapId = signal<string>('khazad_dum');

  readonly availableMaps: GameMapInfo[] = [
    {
      id: 'khazad_dum',
      title: 'KHAZAD-DÛM',
      subtitle: 'The Mines of Moria',
      image: 'assets/maps/khazad-dum.jpg',
      available: true,
      tag: 'DISPONIBLE',
      tagClass: 'available',
      location: 'Montañas Nubladas, Moria',
      difficulty: 'Pesadilla (Clásica)',
      era: 'Tercera Edad del Sol',
      roomsCount: 5,
      description:
        'En las profundidades del reino enano de Moria, una expedición fuera de su época despierta un mal ancestral. Defiende la tumba de Balin, reactiva las forjas misteriosas y sobrevive al despertar de la sombra y la llama.',
      loreQuote:
        '«Cavaron con demasiada codicia y demasiado profundo. Y despertaron aquello que yacía en las sombras...»',
      rooms: [
        'Sala I: Cámara de Mazarbul (Tumba de Balin)',
        'Sala II: Galería de las Mil Columnas',
        'Sala III: Gran Salón del Trono de Durin',
        'Sala IV: El Puente de Khazad-dûm',
        'Sala V: El Pozo de la Sombra y el Fuego'
      ],
      features: [
        '5 Zonas interconectadas con puertas desbloqueables',
        'Forja de Mithril (Pack-a-Punch: x2.5 daño y proyectiles de choque)',
        'Cofre Misterioso de Durin (Armas legendarias por 950 pts)',
        '4 Máquinas de Ventajas élficas y enanas',
        'Barricadas de madera reparables en ventanas (Mantener F)',
        'Aparición del Balrog con latigazo ígneo y rugido del abismo'
      ],
      wonderWeapon: 'Bastón de Anor / Trueno de Durin',
      specialEnemy: 'El Balrog de Morgoth'
    },
    {
      id: 'isengard',
      title: 'ORTHANC',
      subtitle: 'The Forges of Isengard',
      image: '',
      available: false,
      tag: 'PRÓXIMAMENTE',
      tagClass: 'soon',
      location: 'Valle de Nan Curunír, Isengard',
      difficulty: 'Extrema',
      era: 'Guerra del Anillo',
      roomsCount: 4,
      description:
        'Bajo la aguja negra de Orthanc, los pozos de reproducción y maquinaria de vapor corrompida de Saruman hierven de abominaciones. Nuevas trampas de vapor tóxico y fuego te esperan.',
      loreQuote:
        '«Una nueva fuerza se alza. Su victoria está cerca. Esta noche la tierra se manchará con sangre.»',
      rooms: [
        'Nivel I: Patios y Foso Exterior',
        'Nivel II: Calderas de Vapor y Fundición',
        'Nivel III: Pozos de Cría Uruk-hai',
        'Nivel IV: Cámara de los Palantíri'
      ],
      features: [
        'Trampas de vapor a presión y fuego valvulado',
        'Cámaras de inundación de los Ents',
        'Enemigos Berserkers con antorchas explosivas',
        'Pack-a-Punch en la Fundición Central'
      ],
      wonderWeapon: 'Cañón de Pólvora de Saruman',
      specialEnemy: 'Berserker Uruk-hai Explosivo'
    },
    {
      id: 'helms_deep',
      title: 'EL ABISMO DE HELM',
      subtitle: 'The Hornburg Fortress',
      image: '',
      available: false,
      tag: 'CLASIFICADO',
      tagClass: 'locked',
      location: 'Fortaleza de Cuernovilla, Rohan',
      difficulty: 'Supervivencia Heroica',
      era: 'Guerra del Anillo',
      roomsCount: 3,
      description:
        'Muros de piedra milenarios resisten bajo una tormenta interminable y relámpagos cegadores. Defiende la brecha del desagüe y repliégate hacia el torreón final.',
      loreQuote: '«¿Qué puede hacer el hombre contra un odio tan temerario?»',
      rooms: [
        'Sector I: El Gran Muro Bajo y Desagüe',
        'Sector II: El Patio de Cuernovilla',
        'Sector III: El Torreón y Salón del Trono'
      ],
      features: [
        'Clima dinámico: Lluvia torrencial y rayos',
        'Cuerdas de asedio y escaleras enemigas',
        'El Cuerno de Helm para aturdir la horda',
        'Línea de suministros defensivos'
      ],
      wonderWeapon: 'Hoja Reforjada de Andúril',
      specialEnemy: 'Zapadores con Bombas de Pólvora'
    }
  ];

  readonly selectedMap = computed(() => {
    const id = this.selectedMapId();
    return this.availableMaps.find((m) => m.id === id) || this.availableMaps[0];
  });

  readonly selectedMapIndex = computed(() => {
    const idx = this.availableMaps.findIndex((m) => m.id === this.selectedMapId());
    return idx >= 0 ? idx : 0;
  });

  readonly round = signal(1);
  readonly devStartRound = signal(1);
  readonly devBonusPoints = signal(true);
  readonly devFreeDoors = signal(false);
  readonly unlockedDoors = signal<DoorId[]>([]);
  readonly zone2Unlocked = computed(() => this.isRoomUnlocked(2));
  readonly roundTransitioning = signal(false);
  readonly roundBannerText = signal('RONDA I');

  // Multi-Room & Multi-Floor HUD Telemetry + Tactical Map Overlay
  readonly currentRoomName = signal('SALA I · CÁMARA DE MAZARBUL');
  readonly currentFloorLabel = signal('NIVEL BASE (0.0m)');
  readonly showTacticalMap = signal(false);
  readonly playerMapX = signal(50);
  readonly playerMapY = signal(21);
  readonly playerMapRotDeg = signal(180);

  readonly points = signal(500);
  readonly kills = signal(0);
  readonly headshots = signal(0);

  readonly health = signal(100);
  readonly maxHealth = signal(100);
  readonly damageFlash = signal(false);
  readonly hitmarkerActive = signal(false);
  readonly hitmarkerCrit = signal(false);

  readonly currentWeapon = signal<WeaponConfig>(this.createWeaponConfig('lorien_bow'));
  readonly isReloading = signal(false);
  readonly reloadProgress = signal(0);

  // Circular SVG reload ring circumference (2 * PI * 22 = 138.23)
  readonly reloadDashOffset = computed(() => 138.23 * (1 - this.reloadProgress() / 100));

  // Blinking red "Sin munición" state when magazine is empty and not currently reloading
  readonly isOutOfAmmo = computed(
    () => this.currentWeapon().currentMag === 0 && !this.isReloading()
  );
  readonly isLowAmmo = computed(
    () =>
      !this.isOutOfAmmo() &&
      !this.isReloading() &&
      this.currentWeapon().currentMag <= Math.ceil(this.currentWeapon().magSize * 0.25)
  );

  readonly ownedPerks = signal<PerkInfo[]>([]);
  readonly activeInteractable = signal<InteractableItem | null>(null);
  readonly repairProgress = signal(0);

  readonly enemiesRemaining = signal(0);
  readonly floatingPopups = signal<FloatingPointPopup[]>([]);
  readonly activePowerUps = signal<ActivePowerUp[]>([]);
  readonly notificationBanner = signal<string | null>(null);

  readonly healthPercent = computed(() =>
    Math.max(0, Math.min(100, Math.round((this.health() / this.maxHealth()) * 100)))
  );

  // Inventory (up to 2 weapons)
  private weaponSlots: WeaponConfig[] = [];
  private activeSlotIndex = 0;

  // Deterministic Reload Timer
  private reloadElapsedMs = 0;
  private reloadDurationMs = 1000;

  // Perks catalog
  private readonly perksCatalog: Record<PerkId, PerkInfo> = {
    beorn_mead: {
      id: 'beorn_mead',
      name: 'Hidromiel de Beorn',
      codEquivalent: 'Juggernog',
      description: 'Salud máxima a 250 HP',
      cost: 2000,
      color: '#dc2626',
      icon: 'HP+'
    },
    lembas_bread: {
      id: 'lembas_bread',
      name: 'Pan de Lembas',
      codEquivalent: 'Speed Cola',
      description: '+50% velocidad de recarga y reparación',
      cost: 1500,
      color: '#16a34a',
      icon: 'SPD'
    },
    shire_ale: {
      id: 'shire_ale',
      name: 'Cerveza de la Comarca',
      codEquivalent: 'Double Tap',
      description: '+35% daño y mayor cadencia',
      cost: 1800,
      color: '#d97706',
      icon: 'DMG'
    },
    earendil_light: {
      id: 'earendil_light',
      name: 'Luz de Eärendil',
      codEquivalent: 'Stamin-Up',
      description: '+25% velocidad de movimiento',
      cost: 1500,
      color: '#0284c7',
      icon: 'RUN'
    }
  };

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private sceneHelper!: MoriaSceneHelper;
  private animationFrameId = 0;
  private clock = new THREE.Clock();

  // Cached Projectile & Pack-a-Punch Plasma Geometries
  private sharedBoltGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.65, 6).rotateX(Math.PI / 2);
  private sharedOrbGeo = new THREE.SphereGeometry(0.11, 8, 8);
  private sharedPapCoreGeo = new THREE.CylinderGeometry(0.016, 0.016, 1.4, 8).rotateX(Math.PI / 2);
  private sharedPapSpearGeo = new THREE.CylinderGeometry(0.042, 0.062, 1.75, 8).rotateX(Math.PI / 2);
  private sharedPapTailGeo = new THREE.ConeGeometry(0.085, 2.5, 8, 1, true).rotateX(-Math.PI / 2);
  private sharedPapRingGeo = new THREE.TorusGeometry(0.12, 0.016, 6, 16);
  private sharedPapOrbCoreGeo = new THREE.OctahedronGeometry(0.16, 1);
  private sharedPapOrbHaloGeo = new THREE.SphereGeometry(0.28, 10, 10);
  private sharedShockwaveRingGeo = new THREE.TorusGeometry(0.32, 0.032, 8, 24);
  private sharedImpactCoreGeo = new THREE.SphereGeometry(0.22, 10, 10);

  // First-Person ViewModel, Bow Animation, Weapon Switch & Camera Sprint Bob
  readonly isAiming = signal(false);
  private viewModelGroup!: THREE.Group;
  private viewModelRecoil = 0;
  private aimBlend = 0;
  private currentDrawDistance = 0;
  private arrowNockProgress = 1;
  private switchPhase: 'none' | 'holster' | 'draw' = 'none';
  private switchProgress = 0;
  private pendingSlotIndex = 0;
  private lastWheelSwitchTime = 0;
  private walkBobTimer = 0;
  private camBobOffsetY = 0;
  private camBobOffsetX = 0;
  private camRollZ = 0;

  // Player Physics & Input
  private playerPos = new THREE.Vector3(0, 1.75, 6.2);
  private playerGroundY = 0;
  private yaw = 0;
  private pitch = 0;
  private keys: Record<string, boolean> = {};
  private isMouseDown = false;
  private lastShotTime = 0;
  private lastDamageTime = 0;
  private onMouseMoveBound = (e: MouseEvent) => this.handleMouseMove(e);

  // Multi-Room Map & Entities
  private windows: BarricadeWindow[] = [];
  private interactables: InteractableItem[] = [];
  private obstacles: THREE.Box3[] = [];
  private torchLights: THREE.PointLight[] = [];
  private torchFlames: THREE.Object3D[] = [];
  private dustParticles?: THREE.Points;

  // Horde / Round Spawner
  private enemies: EnemyEntity[] = [];
  private nextEnemyId = 1;
  private enemiesToSpawnInRound = 0;
  private spawnCooldown = 0;
  private repairedPointsThisRound = 0;

  // Projectiles, Impact Shockwaves & Power-Up Orbs
  private projectiles: VisualProjectile[] = [];
  private impactBursts: ImpactBurst[] = [];
  private powerUpOrbs: PowerUpOrb[] = [];
  private popupCounter = 1;

  // Hold 'F' repair timer
  private repairHoldTimer = 0;

  constructor(
    public sound: SoundService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.initThreeScene();
    this.buildZoneOneMap();
    this.buildFirstPersonWeaponMesh();
    this.setupPointerLockListener();

    // Run high-frequency render loop & mousemove OUTSIDE Angular Zone so zone.js
    // never triggers full Angular Change Detection 60-144 times per second!
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMouseMoveBound, { passive: true });
      this.animate();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  // ===========================================================================
  // GAME FLOW & MULTI-DOOR CONTROLS
  // ===========================================================================
  setDevStartRound(value: string | number): void {
    const parsed = Math.floor(Number(value));
    if (!Number.isNaN(parsed)) {
      this.devStartRound.set(Math.max(1, Math.min(99, parsed)));
    }
  }

  adjustDevStartRound(delta: number): void {
    this.devStartRound.update((r) => Math.max(1, Math.min(99, r + delta)));
  }

  toggleDevBonusPoints(): void {
    this.devBonusPoints.update((v) => !v);
  }

  toggleDevFreeDoors(): void {
    this.devFreeDoors.update((v) => !v);
    if (this.gameStarted() && this.devFreeDoors()) {
      this.unlockAllDoors(false);
    }
  }

  toggleTacticalMap(): void {
    this.showTacticalMap.update((v) => !v);
  }

  isDoorUnlocked(doorId?: DoorId): boolean {
    if (!doorId) return false;
    return this.unlockedDoors().includes(doorId);
  }

  isRoomUnlocked(roomId: number): boolean {
    if (roomId === 1) return true;
    const doors = this.unlockedDoors();
    if (roomId === 2) {
      return (
        doors.includes('door_zone_2') ||
        doors.includes('door_zone_3_south') ||
        doors.includes('door_zone_4_south')
      );
    }
    if (roomId === 3) {
      return doors.includes('door_zone_3_north') || doors.includes('door_zone_3_south');
    }
    if (roomId === 4) {
      return doors.includes('door_zone_4_north') || doors.includes('door_zone_4_south');
    }
    if (roomId === 5) {
      return doors.includes('door_zone_5');
    }
    return false;
  }

  private unlockDoor(doorId: DoorId, title?: string, showBannerMsg = true): void {
    if (!this.unlockedDoors().includes(doorId)) {
      this.unlockedDoors.update((list) => [...list, doorId]);
    }
    this.sceneHelper?.setDoorOpen(doorId, true);
    if (showBannerMsg && title) {
      this.showBanner(`Acceso Abierto: ${title}`);
    }
  }

  unlockAllDoors(showBannerMsg = true): void {
    const allIds: DoorId[] = [
      'door_zone_2',
      'door_zone_3_north',
      'door_zone_3_south',
      'door_zone_4_north',
      'door_zone_4_south',
      'door_zone_5'
    ];
    this.unlockedDoors.set(allIds);
    this.sceneHelper?.setAllDoorsOpen(true);
    if (showBannerMsg) {
      this.showBanner('Todas las Puertas de Khazad-dûm Abiertas');
    }
  }

  // ===========================================================================
  // MAIN MENU & MAP NAVIGATION
  // ===========================================================================
  openMenuScreen(screen: 'main' | 'map-select' | 'settings' | 'guide'): void {
    this.currentMenuScreen.set(screen);
    this.sound.playMenuClick();
  }

  hoverMap(map: GameMapInfo): void {
    if (this.selectedMapId() !== map.id) {
      this.selectedMapId.set(map.id);
    }
    this.sound.playMenuHover();
  }

  selectMap(map: GameMapInfo): void {
    this.selectedMapId.set(map.id);
    if (map.available) {
      this.startGame();
    } else {
      this.sound.playMenuClick();
    }
  }

  cycleMap(delta: number): void {
    const len = this.availableMaps.length;
    if (len === 0) return;
    const nextIdx = (this.selectedMapIndex() + delta + len) % len;
    this.selectedMapId.set(this.availableMaps[nextIdx].id);
    this.sound.playMenuHover();
  }

  playMenuHoverSound(): void {
    this.sound.playMenuHover();
  }

  quitToMainMenu(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.gameStarted.set(false);
    this.isPaused.set(false);
    this.isGameOver.set(false);
    this.showTacticalMap.set(false);
    this.cancelReload();
    this.keys = {};
    this.isMouseDown = false;
    this.repairHoldTimer = 0;
    this.repairProgress.set(0);

    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
    }
    this.enemies = [];

    for (const orb of this.powerUpOrbs) {
      this.scene.remove(orb.mesh);
    }
    this.powerUpOrbs = [];

    for (const proj of this.projectiles) {
      this.scene.remove(proj.mesh);
    }
    this.projectiles = [];

    for (const burst of this.impactBursts) {
      this.scene.remove(burst.group);
    }
    this.impactBursts = [];

    if (this.viewModelGroup) {
      this.viewModelGroup.visible = false;
    }

    this.playerPos.set(0, 1.75, 6.2);
    this.yaw = 0;
    this.pitch = 0;
    this.camera.position.set(0, 1.75, 6.2);
    this.camera.rotation.set(0, 0, 0);

    this.currentMenuScreen.set('main');
    this.sound.playMenuClick();
  }

  startGame(): void {
    this.sound.playMenuLaunch();
    const initialRound = Math.max(1, Math.min(99, Math.floor(this.devStartRound() || 1)));
    this.devStartRound.set(initialRound);

    this.gameStarted.set(true);
    this.isGameOver.set(false);
    this.isPaused.set(false);
    this.showTacticalMap.set(false);

    if (this.viewModelGroup) {
      this.viewModelGroup.visible = true;
    }

    this.cancelReload();
    this.keys = {};
    this.isMouseDown = false;
    this.repairHoldTimer = 0;
    this.repairProgress.set(0);

    // Initialize all 6 Buyable Doors based on Developer Setting
    if (this.devFreeDoors()) {
      this.unlockAllDoors(false);
    } else {
      this.unlockedDoors.set([]);
      this.sceneHelper.setAllDoorsOpen(false);
    }

    const startPts =
      initialRound > 1 && this.devBonusPoints()
        ? 500 + (initialRound - 1) * 1000
        : 500;
    this.points.set(startPts);
    this.kills.set(0);
    this.headshots.set(0);
    this.maxHealth.set(100);
    this.health.set(100);
    this.ownedPerks.set([]);
    this.activePowerUps.set([]);

    const starterBow = this.createWeaponConfig('lorien_bow');
    this.weaponSlots = [starterBow];
    this.activeSlotIndex = 0;
    this.pendingSlotIndex = 0;
    this.currentWeapon.set({ ...starterBow });
    this.sceneHelper.populateWeaponViewModel(this.viewModelGroup, starterBow);
    this.switchPhase = 'draw';
    this.switchProgress = 0;
    this.viewModelGroup.position.y = -0.62;

    this.playerGroundY = 0;
    this.playerPos.set(0, 1.75, 6.2);
    this.yaw = 0;
    this.pitch = 0;

    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
    }
    this.enemies = [];

    for (const orb of this.powerUpOrbs) {
      this.scene.remove(orb.mesh);
    }
    this.powerUpOrbs = [];

    for (const win of this.windows) {
      win.planks = win.maxPlanks;
      win.plankMeshes.forEach((m) => (m.visible = true));
    }

    this.clock.getDelta();
    this.lockPointer();
    this.startRound(initialRound);
  }

  resumeGame(): void {
    if (this.isGameOver()) return;
    this.keys = {};
    this.isMouseDown = false;
    this.clock.getDelta();
    this.isPaused.set(false);
    this.lockPointer();
  }

  toggleMute(): void {
    this.sound.muted = !this.sound.muted;
  }

  private lockPointer(): void {
    const canvas = this.canvasRef.nativeElement;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  }

  private setupPointerLockListener(): void {
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvasRef.nativeElement;
      if (!locked && this.gameStarted() && !this.isGameOver()) {
        this.isPaused.set(true);
        this.keys = {};
        this.isMouseDown = false;
      } else if (locked) {
        this.clock.getDelta();
        this.isPaused.set(false);
      }
    });
  }

  // ===========================================================================
  // ROUND & HORDE SYSTEM
  // ===========================================================================
  formatRound(r: number): string {
    if (r >= 10) return String(r);
    const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    return romans[r] || String(r);
  }

  private startRound(roundNum: number): void {
    this.round.set(roundNum);
    this.roundTransitioning.set(true);
    this.roundBannerText.set(`RONDA ${this.formatRound(roundNum)}`);
    this.repairedPointsThisRound = 0;
    this.sound.playRoundHornAndDrums();

    const totalForRound = Math.floor(6 + roundNum * 4.0);
    this.enemiesToSpawnInRound = totalForRound;
    this.enemiesRemaining.set(totalForRound);
    this.spawnCooldown = 1.8;

    setTimeout(() => {
      this.roundTransitioning.set(false);
    }, 2400);
  }

  private spawnNextEnemy(): void {
    const unlockedWindows = this.windows.filter((w) => this.isRoomUnlocked(w.roomId));
    const playerRoomInfo = this.sceneHelper.getRoomInfoAt(this.playerPos.x, this.playerPos.z);
    const sameRoomWindows = unlockedWindows.filter((w) => w.roomId === playerRoomInfo.roomId);
    const pool =
      sameRoomWindows.length > 0 && Math.random() < 0.72
        ? sameRoomWindows
        : unlockedWindows;
    const targetWin =
      pool[Math.floor(Math.random() * pool.length)] || this.windows[0];

    const r = this.round();
    let type: EnemyType = 'goblin';
    if (r >= 5 && Math.random() < 0.32) {
      type = 'uruk';
    } else if (r >= 2 && Math.random() < 0.48) {
      type = 'orc';
    }

    const baseHp = 90 + (r - 1) * 45;
    const typeMultiplier = type === 'uruk' ? 2.1 : type === 'orc' ? 1.35 : 1.0;
    const maxHp = Math.round(baseHp * typeMultiplier);

    const baseSpeed = Math.min(5.4, 2.2 + r * 0.19);
    const speed =
      type === 'goblin' ? baseSpeed * 1.15 : type === 'uruk' ? baseSpeed * 0.92 : baseSpeed;

    const enemyMeshData = this.sceneHelper.buildSculptedOrcMesh(type);
    const jitterX = (Math.random() - 0.5) * 1.6;
    const jitterZ = (Math.random() - 0.5) * 1.6;

    enemyMeshData.group.position.set(
      targetWin.outsideSpawnPos.x + jitterX,
      targetWin.outsideSpawnPos.y,
      targetWin.outsideSpawnPos.z + jitterZ
    );
    this.scene.add(enemyMeshData.group);

    const entity: EnemyEntity = {
      id: this.nextEnemyId++,
      type,
      name:
        type === 'uruk'
          ? 'Berserker Uruk-hai'
          : type === 'orc'
          ? 'Orco de Mordor'
          : 'Trasgo de Moria',
      mesh: enemyMeshData.group,
      headMesh: enemyMeshData.head,
      bodyMesh: enemyMeshData.body,
      leftArm: enemyMeshData.leftArm,
      rightArm: enemyMeshData.rightArm,
      leftLeg: enemyMeshData.leftLeg,
      rightLeg: enemyMeshData.rightLeg,
      hpBarFill: enemyMeshData.hpFill,
      hp: maxHp,
      maxHp,
      speed,
      damage: type === 'uruk' ? 42 : 28,
      state: 'approaching_window',
      targetWindowId: targetWin.id,
      barrierAttackTimer: 0,
      playerAttackTimer: 0,
      walkCycle: Math.random() * Math.PI * 2,
      hitFlashTimer: 0,
      deathTimer: 0
    };

    this.enemies.push(entity);
  }

  // ===========================================================================
  // THREE.JS INITIALIZATION & ZONE 1 HIGH-PERFORMANCE PBR SCENE
  // ===========================================================================
  private initThreeScene(): void {
    const canvas = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b111e);
    this.scene.fog = new THREE.FogExp2(0x0b111e, 0.016);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      90
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.copy(this.playerPos);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Keep pixelRatio at 1.0 for locked 60+ FPS with hardware MSAA
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // 1. Hemisphere Light (Cool cyan skylight above vs deep slate cavern bounce below)
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 1.35);
    hemiLight.position.set(0, 12, 0);
    this.scene.add(hemiLight);

    // 2. Main Skylight Directional Light (Crisp normal-map relief + soft shadows)
    const dirLight = new THREE.DirectionalLight(0x7dd3fc, 1.65);
    dirLight.position.set(4.5, 16, 3.5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 32;
    dirLight.shadow.camera.left = -14;
    dirLight.shadow.camera.right = 14;
    dirLight.shadow.camera.top = 14;
    dirLight.shadow.camera.bottom = -14;
    dirLight.shadow.bias = -0.0015;
    this.scene.add(dirLight);
  }

  private buildZoneOneMap(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy() || 8;
    this.sceneHelper = new MoriaSceneHelper(maxAniso);

    // Bake PMREM Cavern Environment Map once for realistic PBR metallic & wet-stone reflections
    this.scene.environment = this.sceneHelper.createCavernEnvironment(this.renderer);

    const result = this.sceneHelper.buildZoneOne(this.scene, this.perksCatalog);
    this.windows = result.windows;
    this.interactables = result.interactables;
    this.obstacles = result.obstacles;
    this.torchLights = result.torchLights;
    this.torchFlames = result.torchFlames;
    this.dustParticles = result.dustParticles;
  }

  private buildFirstPersonWeaponMesh(): void {
    this.viewModelGroup = new THREE.Group();
    this.viewModelGroup.visible = false;
    this.camera.add(this.viewModelGroup);
    this.sceneHelper.populateWeaponViewModel(this.viewModelGroup, this.currentWeapon());
  }

  // ===========================================================================
  // WEAPON FACTORY
  // ===========================================================================
  private createWeaponConfig(id: WeaponId): WeaponConfig {
    switch (id) {
      case 'lorien_bow':
        return {
          id: 'lorien_bow',
          name: 'Arco de Lothlórien',
          upgradedName: 'Estrella de Galadhrim',
          loreSubtitle: 'Común · Cadencia media (420 ms)',
          damage: 55,
          fireRateMs: 420,
          magSize: 12,
          currentMag: 12,
          reserveAmmo: 84,
          maxReserveAmmo: 84,
          reloadTimeMs: 1200,
          projectileSpeed: 55,
          projectileColor: 0x38bdf8,
          upgradedProjectileColor: 0xfacc15,
          isUpgraded: false,
          isAutomatic: true,
          splashRadius: 0,
          pelletCount: 1,
          spread: 0.008
        };
      case 'erebor_crossbow':
        return {
          id: 'erebor_crossbow',
          name: 'Ballesta de Erebor',
          upgradedName: 'Ira de Thorin',
          loreSubtitle: 'Poco común · 3 virotes en abanico (620 ms)',
          damage: 65,
          fireRateMs: 620,
          magSize: 8,
          currentMag: 8,
          reserveAmmo: 64,
          maxReserveAmmo: 64,
          reloadTimeMs: 1500,
          projectileSpeed: 48,
          projectileColor: 0xf59e0b,
          upgradedProjectileColor: 0xc084fc,
          isUpgraded: false,
          isAutomatic: true,
          splashRadius: 0,
          pelletCount: 3,
          spread: 0.055
        };
      case 'anor_staff':
        return {
          id: 'anor_staff',
          name: 'Bastón de Anor',
          upgradedName: 'Fuego Secreto',
          loreSubtitle: 'Rara · Orbe explosivo continuo (480 ms)',
          damage: 145,
          fireRateMs: 480,
          magSize: 10,
          currentMag: 10,
          reserveAmmo: 60,
          maxReserveAmmo: 60,
          reloadTimeMs: 1650,
          projectileSpeed: 38,
          projectileColor: 0xef4444,
          upgradedProjectileColor: 0x2dd4bf,
          isUpgraded: false,
          isAutomatic: true,
          splashRadius: 2.8,
          pelletCount: 1,
          spread: 0.015
        };
      case 'mithril_repeater':
        return {
          id: 'mithril_repeater',
          name: 'Repetidora de Mithril',
          upgradedName: 'Furia de Khazad-dûm',
          loreSubtitle: 'Épica · Virotes automáticos de alta cadencia (190 ms)',
          damage: 95,
          fireRateMs: 190,
          magSize: 24,
          currentMag: 24,
          reserveAmmo: 168,
          maxReserveAmmo: 168,
          reloadTimeMs: 1350,
          projectileSpeed: 60,
          projectileColor: 0x67e8f9,
          upgradedProjectileColor: 0xfde047,
          isUpgraded: false,
          isAutomatic: true,
          splashRadius: 0,
          pelletCount: 1,
          spread: 0.012
        };
      case 'bard_black_bow':
        return {
          id: 'bard_black_bow',
          name: 'Arco Negro de Bardo',
          upgradedName: 'Perdición de Smaug',
          loreSubtitle: 'Épica · Ráfaga élfica ultrarrápida (145 ms)',
          damage: 85,
          fireRateMs: 145,
          magSize: 30,
          currentMag: 30,
          reserveAmmo: 180,
          maxReserveAmmo: 180,
          reloadTimeMs: 1400,
          projectileSpeed: 64,
          projectileColor: 0x22c55e,
          upgradedProjectileColor: 0xf43f5e,
          isUpgraded: false,
          isAutomatic: true,
          splashRadius: 0,
          pelletCount: 1,
          spread: 0.018
        };
      case 'durin_thunder':
        return {
          id: 'durin_thunder',
          name: 'Martillo de Durin',
          upgradedName: 'Sentencia de los Valar',
          loreSubtitle: 'Legendaria · Descarga pesada en área (760 ms)',
          damage: 320,
          fireRateMs: 760,
          magSize: 6,
          currentMag: 6,
          reserveAmmo: 36,
          maxReserveAmmo: 36,
          reloadTimeMs: 1800,
          projectileSpeed: 42,
          projectileColor: 0x38bdf8,
          upgradedProjectileColor: 0xfacc15,
          isUpgraded: false,
          isAutomatic: true,
          splashRadius: 4.2,
          pelletCount: 1,
          spread: 0.01
        };
    }
  }

  // ===========================================================================
  // INPUT HANDLERS
  // ===========================================================================
  @HostListener('window:resize')
  onResize(): void {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.gameStarted() || this.isPaused() || this.isGameOver()) return;
    if (document.pointerLockElement !== this.canvasRef.nativeElement) return;

    // Lower mouse sensitivity slightly when aiming down sights (ADS) for precise headshots
    const sensitivity = this.isAiming() ? 0.0014 : 0.0022;
    this.yaw -= e.movementX * sensitivity;
    this.pitch -= e.movementY * sensitivity;
    const maxPitch = Math.PI / 2 - 0.08;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  @HostListener('window:contextmenu', ['$event'])
  onContextMenu(e: MouseEvent): void {
    e.preventDefault();
  }

  @HostListener('document:mousedown', ['$event'])
  onMouseDown(e: MouseEvent): void {
    if (!this.gameStarted() || this.isPaused() || this.isGameOver()) return;
    if (e.target !== this.canvasRef.nativeElement) return;

    if (document.pointerLockElement !== this.canvasRef.nativeElement) {
      this.lockPointer();
      return;
    }
    if (e.button === 0) {
      this.isMouseDown = true;
      this.tryShoot();
    } else if (e.button === 2 && !this.isReloading() && this.switchPhase === 'none') {
      this.isAiming.set(true);
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.isMouseDown = false;
    } else if (e.button === 2) {
      this.isAiming.set(false);
    }
  }

  @HostListener('window:wheel', ['$event'])
  onMouseWheel(e: WheelEvent): void {
    if (!this.gameStarted() || this.isPaused() || this.isGameOver()) return;
    if (Math.abs(e.deltaY) < 1) return;

    const now = performance.now();
    if (now - this.lastWheelSwitchTime < 150) return;
    this.lastWheelSwitchTime = now;

    this.switchWeapon();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    this.keys[code] = true;

    if (!this.gameStarted()) {
      if (e.repeat) return;
      if (code === 'Escape' && this.currentMenuScreen() !== 'main') {
        this.openMenuScreen('main');
      } else if (this.currentMenuScreen() === 'map-select') {
        if (code === 'ArrowDown' || code === 'KeyS') {
          e.preventDefault();
          this.cycleMap(1);
        } else if (code === 'ArrowUp' || code === 'KeyW') {
          e.preventDefault();
          this.cycleMap(-1);
        } else if (code === 'Enter' && this.selectedMap().available) {
          e.preventDefault();
          this.startGame();
        }
      }
      return;
    }

    if (this.isPaused() || this.isGameOver()) return;

    if (code === 'Tab' || code === 'KeyM') {
      e.preventDefault();
      if (!e.repeat) {
        this.toggleTacticalMap();
      }
      return;
    }

    if (code === 'KeyR') {
      this.startReload();
    } else if (code === 'KeyF' && !e.repeat) {
      this.triggerImmediateInteract();
    } else if (code === 'Digit1') {
      this.switchWeapon(0);
    } else if (code === 'Digit2') {
      this.switchWeapon(1);
    } else if (code === 'KeyQ') {
      this.switchWeapon();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
    if (e.code === 'KeyF') {
      this.repairHoldTimer = 0;
      this.repairProgress.set(0);
    }
  }

  // ===========================================================================
  // SHOOTING & DETERMINISTIC RELOAD
  // ===========================================================================
  private getEffectiveFireRateMs(weapon: WeaponConfig): number {
    const hasDoubleTap = this.hasPerk('shire_ale');
    const upgradeRateBonus = weapon.isUpgraded ? 0.78 : 1.0;
    return weapon.fireRateMs * upgradeRateBonus * (hasDoubleTap ? 0.72 : 1.0);
  }

  private isWeaponBusySwitching(): boolean {
    if (this.switchPhase === 'holster') return true;
    if (this.switchPhase === 'draw' && this.switchProgress < 0.82) return true;
    return false;
  }

  private tryShoot(): void {
    if (this.isReloading() || this.isWeaponBusySwitching()) return;
    const weapon = this.currentWeapon();
    const now = performance.now();

    const effectiveFireRate = this.getEffectiveFireRateMs(weapon);

    if (now - this.lastShotTime < effectiveFireRate) return;

    if (weapon.currentMag <= 0) {
      if (weapon.reserveAmmo > 0) {
        this.startReload();
      }
      return;
    }

    this.lastShotTime = now;
    weapon.currentMag--;
    this.currentWeapon.set({ ...weapon });
    this.weaponSlots[this.activeSlotIndex] = { ...weapon };

    // Bowstring snap + recoil + trigger new arrow nocking animation from quiver
    this.viewModelRecoil = weapon.isUpgraded ? 0.165 : 0.14;
    this.currentDrawDistance = -0.025;
    this.arrowNockProgress = 0;
    this.sound.playShoot(weapon.id, weapon.isUpgraded);

    const isInstaKill = this.hasPowerUp('insta_kill');
    const hasDoubleTap = this.hasPerk('shire_ale');
    const damageMultiplier =
      (weapon.isUpgraded ? 2.6 : 1.0) * (hasDoubleTap ? 1.35 : 1.0);
    const activeSpread = this.isAiming() ? weapon.spread * 0.25 : weapon.spread;

    for (let p = 0; p < weapon.pelletCount; p++) {
      const dir = new THREE.Vector3(0, 0, -1);
      dir.x += (Math.random() - 0.5) * activeSpread;
      dir.y += (Math.random() - 0.5) * activeSpread;
      dir.applyQuaternion(this.camera.quaternion).normalize();

      this.spawnVisualBolt(dir, weapon, p === 0);
      this.evaluateShotRay(dir, weapon, damageMultiplier, isInstaKill, p === 0);
    }

    if (weapon.currentMag === 0 && weapon.reserveAmmo > 0) {
      this.startReload();
    }
  }

  private startReload(): void {
    if (this.isReloading() || this.switchPhase !== 'none') return;
    const weapon = this.currentWeapon();
    if (weapon.currentMag >= weapon.magSize || weapon.reserveAmmo <= 0) return;

    this.isAiming.set(false);
    const hasSpeedCola = this.hasPerk('lembas_bread');
    this.reloadDurationMs = hasSpeedCola ? weapon.reloadTimeMs * 0.5 : weapon.reloadTimeMs;
    this.reloadElapsedMs = 0;
    this.isReloading.set(true);
    this.reloadProgress.set(0);
  }

  private cancelReload(): void {
    this.isReloading.set(false);
    this.reloadProgress.set(0);
    this.reloadElapsedMs = 0;
  }

  private updateReload(dt: number): void {
    if (!this.isReloading()) return;

    const w = this.currentWeapon();
    if (w.currentMag >= w.magSize || w.reserveAmmo <= 0) {
      this.cancelReload();
      return;
    }

    this.reloadElapsedMs += dt * 1000;
    const pct = Math.min(100, Math.round((this.reloadElapsedMs / this.reloadDurationMs) * 100));
    if (pct !== this.reloadProgress()) {
      this.reloadProgress.set(pct);
    }

    if (this.reloadElapsedMs >= this.reloadDurationMs) {
      const needed = w.magSize - w.currentMag;
      const loaded = Math.min(needed, w.reserveAmmo);
      w.currentMag += loaded;
      w.reserveAmmo -= loaded;
      this.currentWeapon.set({ ...w });
      this.weaponSlots[this.activeSlotIndex] = { ...w };
      this.cancelReload();
    }
  }

  private spawnVisualBolt(
    dir: THREE.Vector3,
    weapon: WeaponConfig,
    isPrimaryPellet = true
  ): void {
    const startPos = this.camera.position
      .clone()
      .add(new THREE.Vector3(0.18, -0.15, 0).applyQuaternion(this.camera.quaternion))
      .addScaledVector(dir, 0.82);

    const isOrb = weapon.splashRadius > 0;

    if (!weapon.isUpgraded) {
      const mat = new THREE.MeshBasicMaterial({ color: weapon.projectileColor });
      const mesh = new THREE.Mesh(isOrb ? this.sharedOrbGeo : this.sharedBoltGeo, mat);
      mesh.position.copy(startPos);
      mesh.quaternion.copy(this.camera.quaternion);
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        velocity: dir.clone().multiplyScalar(weapon.projectileSpeed),
        life: 0.55,
        isUpgraded: false,
        materials: [mat]
      });
      return;
    }

    // =========================================================================
    // EPIC PACK-A-PUNCH FLUORESCENT PLASMA PROJECTILE (Core + Shroud + Vortex Rings + Comet Tail)
    // =========================================================================
    const papColor = weapon.upgradedProjectileColor;
    const secondaryNeon = papColor === 0xf0abfc ? 0x00f5ff : 0xff1cf7;

    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: papColor,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const tailMat = new THREE.MeshBasicMaterial({
      color: papColor,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: secondaryNeon,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const projGroup = new THREE.Group();
    projGroup.position.copy(startPos);
    projGroup.quaternion.copy(this.camera.quaternion);

    const coreMesh = new THREE.Mesh(
      isOrb ? this.sharedPapOrbCoreGeo : this.sharedPapCoreGeo,
      coreMat
    );
    const shroudMesh = new THREE.Mesh(
      isOrb ? this.sharedPapOrbHaloGeo : this.sharedPapSpearGeo,
      plasmaMat
    );
    const tailMesh = new THREE.Mesh(this.sharedPapTailGeo, tailMat);
    tailMesh.position.z = 1.15; // Trails behind along local +Z

    // Spinning Double Vortex Helix around the flying projectile
    const spinNode = new THREE.Group();
    const vortex1 = new THREE.Mesh(this.sharedPapRingGeo, ringMat1);
    vortex1.rotation.x = Math.PI / 5;
    const vortex2 = new THREE.Mesh(this.sharedPapRingGeo, ringMat2);
    vortex2.rotation.y = Math.PI / 5;
    vortex2.scale.setScalar(1.25);
    spinNode.add(vortex1, vortex2);

    projGroup.add(coreMesh, shroudMesh, tailMesh, spinNode);
    this.scene.add(projGroup);

    // Muzzle Energy Shockwave Flash right at weapon tip on primary pellet
    if (isPrimaryPellet) {
      this.spawnImpactBurst(startPos, weapon, false, true);
    }

    this.projectiles.push({
      mesh: projGroup,
      velocity: dir.clone().multiplyScalar(weapon.projectileSpeed * 1.28),
      life: 0.62,
      isUpgraded: true,
      spinNode,
      materials: [coreMat, plasmaMat, tailMat, ringMat1, ringMat2]
    });
  }

  private spawnImpactBurst(
    pos: THREE.Vector3,
    weapon: WeaponConfig,
    isCrit: boolean,
    isMuzzleFlash = false
  ): void {
    const color = weapon.isUpgraded ? weapon.upgradedProjectileColor : weapon.projectileColor;
    const secondaryColor = weapon.isUpgraded
      ? color === 0xf0abfc
        ? 0x00f5ff
        : 0xff1cf7
      : 0xfacc15;

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: isMuzzleFlash ? 0.85 : 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ringMat1 = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mats: THREE.Material[] = [coreMat, ringMat1];

    const group = new THREE.Group();
    group.position.copy(pos);
    group.quaternion.copy(this.camera.quaternion);

    const core = new THREE.Mesh(this.sharedImpactCoreGeo, coreMat);
    const ring1 = new THREE.Mesh(this.sharedShockwaveRingGeo, ringMat1);
    group.add(core, ring1);

    let ring2: THREE.Mesh | undefined;
    if (weapon.isUpgraded || isCrit) {
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: secondaryColor,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      mats.push(ringMat2);
      ring2 = new THREE.Mesh(this.sharedShockwaveRingGeo, ringMat2);
      ring2.rotation.x = Math.PI / 3;
      ring2.rotation.y = Math.PI / 4;
      group.add(ring2);
    }

    const baseScale = isMuzzleFlash ? 0.35 : weapon.isUpgraded ? 0.75 : 0.42;
    group.scale.setScalar(baseScale);
    this.scene.add(group);

    const maxScale = isMuzzleFlash
      ? 1.15
      : weapon.splashRadius > 0
      ? weapon.isUpgraded
        ? 5.8
        : 3.8
      : weapon.isUpgraded
      ? 2.85
      : 1.35;
    const maxLife = isMuzzleFlash ? 0.12 : weapon.isUpgraded ? 0.28 : 0.18;

    this.impactBursts.push({
      group,
      ring1,
      ring2,
      core,
      life: maxLife,
      maxLife,
      maxScale,
      materials: mats
    });
  }

  private evaluateShotRay(
    dir: THREE.Vector3,
    weapon: WeaponConfig,
    damageMultiplier: number,
    isInstaKill: boolean,
    isPrimaryPellet = true
  ): void {
    const raycaster = new THREE.Raycaster(this.camera.position, dir, 0.2, 85);
    const aliveEnemies = this.enemies.filter((e) => e.state !== 'dead');

    let closestEnemy: EnemyEntity | null = null;
    let isHeadshot = false;
    let minDistance = Infinity;
    let hitPoint = new THREE.Vector3();

    for (const enemy of aliveEnemies) {
      const headHits = raycaster.intersectObject(enemy.headMesh, true);
      if (headHits.length > 0 && headHits[0].distance < minDistance) {
        minDistance = headHits[0].distance;
        closestEnemy = enemy;
        isHeadshot = true;
        hitPoint = headHits[0].point;
      }

      const bodyHits = raycaster.intersectObjects(
        [enemy.bodyMesh, enemy.leftArm, enemy.rightArm, enemy.leftLeg, enemy.rightLeg],
        true
      );
      if (bodyHits.length > 0 && bodyHits[0].distance < minDistance) {
        minDistance = bodyHits[0].distance;
        closestEnemy = enemy;
        isHeadshot = false;
        hitPoint = bodyHits[0].point;
      }
    }

    if (!closestEnemy) {
      if (weapon.isUpgraded && isPrimaryPellet) {
        const distantImpact = this.camera.position.clone().addScaledVector(dir, 18);
        this.spawnImpactBurst(distantImpact, weapon, false, false);
      }
      return;
    }

    this.spawnImpactBurst(hitPoint, weapon, isHeadshot, false);

    const baseDmg = weapon.damage * damageMultiplier * (isHeadshot ? 2.0 : 1.0);
    const finalDmg = isInstaKill ? 99999 : Math.round(baseDmg);

    this.applyEnemyDamage(closestEnemy, finalDmg, isHeadshot);

    // Pack-a-Punch weapons gain an arcane plasma shockwave AoE even on single-target bows/crossbows!
    const effectiveSplashRadius =
      weapon.splashRadius > 0
        ? weapon.splashRadius * (weapon.isUpgraded ? 1.35 : 1.0)
        : weapon.isUpgraded
        ? 1.85
        : 0;

    if (effectiveSplashRadius > 0) {
      const splashFactor = weapon.splashRadius > 0 ? 0.68 : 0.5;
      for (const other of aliveEnemies) {
        if (other.id === closestEnemy.id) continue;
        const dist = other.mesh.position.distanceTo(hitPoint);
        if (dist <= effectiveSplashRadius) {
          this.applyEnemyDamage(other, Math.round(finalDmg * splashFactor), false);
        }
      }
    }
  }

  private applyEnemyDamage(enemy: EnemyEntity, dmg: number, isHeadshot: boolean): void {
    if (enemy.state === 'dead') return;

    enemy.hp -= dmg;
    enemy.hitFlashTimer = isHeadshot ? 0.24 : 0.16;
    this.sound.playHit(isHeadshot);

    this.hitmarkerActive.set(true);
    this.hitmarkerCrit.set(isHeadshot);
    setTimeout(() => this.hitmarkerActive.set(false), 110);

    const ratio = Math.max(0.01, enemy.hp / enemy.maxHp);
    enemy.hpBarFill.scale.x = ratio;

    if (enemy.hp <= 0) {
      enemy.state = 'dead';
      enemy.deathTimer = 0.72;
      this.kills.update((k) => k + 1);
      if (isHeadshot) {
        this.headshots.update((h) => h + 1);
        enemy.headMesh.scale.setScalar(0.01); // Headshot pop!
      }
      const killPoints = isHeadshot ? 100 : 60;
      this.awardPoints(killPoints, isHeadshot);
      this.maybeDropPowerUp(enemy.mesh.position);
      this.onEnemyKilled();
    } else {
      this.awardPoints(10, false);
    }
  }

  private onEnemyKilled(): void {
    const aliveCount = this.enemies.filter((e) => e.state !== 'dead').length;
    this.enemiesRemaining.set(aliveCount + this.enemiesToSpawnInRound);

    if (aliveCount === 0 && this.enemiesToSpawnInRound === 0) {
      setTimeout(() => {
        if (!this.isGameOver()) {
          this.startRound(this.round() + 1);
        }
      }, 2000);
    }
  }

  private switchWeapon(targetSlot?: number): void {
    if (this.weaponSlots.length < 2) return;

    const nextSlot =
      targetSlot !== undefined
        ? targetSlot
        : (this.activeSlotIndex + 1) % this.weaponSlots.length;
    if (nextSlot < 0 || nextSlot >= this.weaponSlots.length) return;

    if (this.switchPhase === 'none' && nextSlot === this.activeSlotIndex) return;
    if (this.switchPhase === 'holster' && nextSlot === this.pendingSlotIndex) return;

    this.cancelReload();
    this.isAiming.set(false);
    this.weaponSlots[this.activeSlotIndex] = { ...this.currentWeapon() };
    this.pendingSlotIndex = nextSlot;

    if (this.switchPhase === 'draw') {
      this.switchPhase = 'holster';
      this.switchProgress = Math.max(0, 1 - this.switchProgress);
    } else if (this.switchPhase === 'none') {
      this.switchPhase = 'holster';
      this.switchProgress = 0;
    }

    this.sound.playWeaponSwitch(false);
  }

  private updateWeaponSwitch(dt: number): void {
    if (this.switchPhase === 'none') return;

    const speedMult = this.hasPerk('lembas_bread') ? 1.35 : 1.0;

    if (this.switchPhase === 'holster') {
      const holsterDuration = 0.18 / speedMult;
      this.switchProgress += dt / holsterDuration;

      if (this.switchProgress >= 1) {
        this.activeSlotIndex = this.pendingSlotIndex;
        const nextW = this.weaponSlots[this.activeSlotIndex];
        this.currentWeapon.set({ ...nextW });
        this.sceneHelper.populateWeaponViewModel(this.viewModelGroup, nextW);
        this.viewModelGroup.position.y = -0.62;
        this.arrowNockProgress = nextW.currentMag > 0 ? 1 : 0;
        this.currentDrawDistance = 0;
        this.viewModelRecoil = 0;

        this.switchPhase = 'draw';
        this.switchProgress = 0;
        this.sound.playWeaponSwitch(true);
      }
    } else if (this.switchPhase === 'draw') {
      const drawDuration = 0.22 / speedMult;
      this.switchProgress += dt / drawDuration;

      if (this.switchProgress >= 1) {
        this.switchPhase = 'none';
        this.switchProgress = 0;
      }
    }
  }

  // ===========================================================================
  // INTERACTABLES ACROSS ALL 5 ROOMS
  // ===========================================================================
  private triggerImmediateInteract(): void {
    const item = this.activeInteractable();
    if (!item || item.type === 'window') return;

    if (item.type === 'wall_weapon' && item.weaponId) {
      const existingIdx = this.weaponSlots.findIndex((w) => w.id === item.weaponId);
      if (existingIdx !== -1) {
        const ammoCost = item.ammoCost ?? 250;
        const w = this.weaponSlots[existingIdx];
        if (this.points() < ammoCost || w.reserveAmmo >= w.maxReserveAmmo) return;
        this.points.update((p) => p - ammoCost);
        w.currentMag = w.magSize;
        w.reserveAmmo = w.maxReserveAmmo;
        this.weaponSlots[existingIdx] = { ...w };
        if (this.activeSlotIndex === existingIdx) {
          this.cancelReload();
          this.currentWeapon.set({ ...w });
        }
        this.sound.playPurchase();
        this.showBanner(`Munición recargada: ${w.name}`);
      } else {
        if (this.points() < item.cost) return;
        this.points.update((p) => p - item.cost);
        this.equipNewWeapon(this.createWeaponConfig(item.weaponId));
        this.sound.playPurchase();
      }
    } else if (item.type === 'perk' && item.perkId) {
      if (this.hasPerk(item.perkId) || this.points() < item.cost) return;
      this.points.update((p) => p - item.cost);
      const perk = this.perksCatalog[item.perkId];
      this.ownedPerks.update((list) => [...list, perk]);
      if (item.perkId === 'beorn_mead') {
        this.maxHealth.set(250);
        this.health.set(250);
      }
      this.sound.playPurchase();
      this.showBanner(`Brebaje: ${perk.name}`);
    } else if (item.type === 'mystery_box') {
      if (this.points() < item.cost) return;
      this.points.update((p) => p - item.cost);
      const pool: WeaponId[] = [
        'bard_black_bow',
        'durin_thunder',
        'anor_staff',
        'mithril_repeater',
        'erebor_crossbow'
      ];
      const currentId = this.currentWeapon().id;
      const filtered = pool.filter((id) => id !== currentId);
      const chosenId = filtered[Math.floor(Math.random() * filtered.length)];
      const newWeapon = this.createWeaponConfig(chosenId);
      this.equipNewWeapon(newWeapon);
      this.sound.playPurchase();
      this.showBanner(`Arma obtenida: ${newWeapon.name}`);
    } else if (item.type === 'door' && item.doorId) {
      if (this.isDoorUnlocked(item.doorId)) return;
      const doorCost = this.devFreeDoors() ? 0 : item.cost;
      if (this.points() < doorCost) return;
      if (doorCost > 0) {
        this.points.update((p) => p - doorCost);
      }
      this.unlockDoor(item.doorId, item.title, true);
      this.sound.playPurchase();
    } else if (item.type === 'pack_a_punch') {
      const w = this.currentWeapon();
      if (w.isUpgraded || this.points() < item.cost) return;
      this.points.update((p) => p - item.cost);
      this.upgradeCurrentWeaponNow();
    }
  }

  upgradeCurrentWeaponNow(): void {
    const w = this.currentWeapon();
    if (w.isUpgraded) return;
    this.cancelReload();
    this.isAiming.set(false);
    w.isUpgraded = true;
    w.name = w.upgradedName;
    w.magSize = Math.round(w.magSize * 1.5);
    w.currentMag = w.magSize;
    w.maxReserveAmmo = Math.round(w.maxReserveAmmo * 1.5);
    w.reserveAmmo = w.maxReserveAmmo;
    this.currentWeapon.set({ ...w });
    this.weaponSlots[this.activeSlotIndex] = { ...w };
    this.sceneHelper.populateWeaponViewModel(this.viewModelGroup, w);
    this.viewModelGroup.position.y = -0.62;
    this.switchPhase = 'draw';
    this.switchProgress = 0;
    this.sound.playPurchase();
    this.showBanner(`✦ FORJA DE CELEBRIMBOR: ${w.name} ✦`);
  }

  private equipNewWeapon(newWeapon: WeaponConfig): void {
    this.cancelReload();
    this.isAiming.set(false);
    if (this.weaponSlots.length < 2) {
      this.weaponSlots.push(newWeapon);
      this.activeSlotIndex = this.weaponSlots.length - 1;
    } else {
      this.weaponSlots[this.activeSlotIndex] = newWeapon;
    }
    this.pendingSlotIndex = this.activeSlotIndex;
    this.currentWeapon.set({ ...newWeapon });
    this.sceneHelper.populateWeaponViewModel(this.viewModelGroup, newWeapon);
    this.viewModelGroup.position.y = -0.62;
    this.arrowNockProgress = 1;
    this.currentDrawDistance = 0;
    this.viewModelRecoil = 0;
    this.switchPhase = 'draw';
    this.switchProgress = 0;
    this.sound.playWeaponSwitch(true);
  }

  // ===========================================================================
  // POINTS & POWER-UPS
  // ===========================================================================
  private awardPoints(baseAmount: number, isCrit: boolean): void {
    const mult = this.hasPowerUp('double_points') ? 2 : 1;
    const total = baseAmount * mult;
    this.points.update((p) => p + total);

    const popup: FloatingPointPopup = {
      id: this.popupCounter++,
      value: total,
      isCrit,
      x: 52 + (Math.random() - 0.5) * 6,
      y: 48 + (Math.random() - 0.5) * 6
    };
    this.floatingPopups.update((arr) => [...arr.slice(-5), popup]);
    setTimeout(() => {
      this.floatingPopups.update((arr) => arr.filter((item) => item.id !== popup.id));
    }, 550);
  }

  private maybeDropPowerUp(pos: THREE.Vector3): void {
    if (Math.random() > 0.14) return;

    const types: Array<{
      type: 'insta_kill' | 'double_points' | 'max_ammo';
      name: string;
      color: number;
    }> = [
      { type: 'insta_kill', name: 'Insta-Kill (Fuego de Anor)', color: 0xef4444 },
      { type: 'double_points', name: 'Puntos x2 (Oro de Smaug)', color: 0xfacc15 },
      { type: 'max_ammo', name: 'Munición Máxima', color: 0x22c55e }
    ];
    const picked = types[Math.floor(Math.random() * types.length)];

    const groundY = this.sceneHelper.getFloorHeightAt(pos.x, pos.z);
    const group = new THREE.Group();
    group.position.set(pos.x, groundY + 1.0, pos.z);

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.36, 1),
      new THREE.MeshBasicMaterial({ color: picked.color })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.03, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    group.add(orb, ring);
    this.scene.add(group);

    this.powerUpOrbs.push({
      id: this.nextEnemyId++,
      type: picked.type,
      name: picked.name,
      mesh: group,
      position: group.position,
      life: 18
    });
  }

  private activatePowerUp(type: 'insta_kill' | 'double_points' | 'max_ammo', name: string): void {
    this.sound.playPurchase();
    this.showBanner(name);

    if (type === 'max_ammo') {
      this.cancelReload();
      this.weaponSlots.forEach((w) => {
        w.currentMag = w.magSize;
        w.reserveAmmo = w.maxReserveAmmo;
      });
      const cur = this.currentWeapon();
      cur.currentMag = cur.magSize;
      cur.reserveAmmo = cur.maxReserveAmmo;
      this.currentWeapon.set({ ...cur });
      return;
    }

    const duration = 22;
    this.activePowerUps.update((list) => {
      const filtered = list.filter((p) => p.type !== type);
      return [...filtered, { type, name, remainingSec: duration }];
    });
  }

  private hasPerk(perkId: PerkId): boolean {
    return this.ownedPerks().some((p) => p.id === perkId);
  }

  private hasPowerUp(type: 'insta_kill' | 'double_points' | 'max_ammo'): boolean {
    return this.activePowerUps().some((p) => p.type === type);
  }

  private showBanner(text: string): void {
    this.notificationBanner.set(text);
    setTimeout(() => {
      if (this.notificationBanner() === text) {
        this.notificationBanner.set(null);
      }
    }, 2800);
  }

  // ===========================================================================
  // MAIN GAME LOOP (Runs outside Angular Zone for maximum FPS)
  // ===========================================================================
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Update FPS counter every 250ms
    this.fpsFrames++;
    if (now - this.fpsLastCheck >= 250) {
      const elapsedSec = (now - this.fpsLastCheck) / 1000;
      const currentFps = Math.round(this.fpsFrames / elapsedSec);
      const ms = Number(((now - this.fpsLastCheck) / this.fpsFrames).toFixed(1));
      this.fps.set(currentFps);
      this.frameTimeMs.set(ms);
      this.fpsFrames = 0;
      this.fpsLastCheck = now;

      // Also refresh Room/Floor HUD Telemetry & Tactical Map coordinates at 4Hz
      if (this.sceneHelper) {
        const info = this.sceneHelper.getRoomInfoAt(this.playerPos.x, this.playerPos.z);
        if (this.currentRoomName() !== info.name) {
          this.currentRoomName.set(info.name);
        }
        if (this.currentFloorLabel() !== info.floorLabel) {
          this.currentFloorLabel.set(info.floorLabel);
        }
        // Direct 1:1 world coordinates (X, Z) for the Tactical Blueprint SVG
        this.playerMapX.set(Math.round(this.playerPos.x * 10) / 10);
        this.playerMapY.set(Math.round(this.playerPos.z * 10) / 10);
        this.playerMapRotDeg.set(Math.round((-this.yaw * 180) / Math.PI));
      }
    }

    this.animateEnvironment(dt, now);

    if (!this.gameStarted()) {
      // Atmospheric cinematic camera drift in Chamber of Mazarbul for Main Menu
      const t = now * 0.0003;
      this.yaw = Math.sin(t) * 0.12;
      this.pitch = -0.04 + Math.cos(t * 0.7) * 0.03;
      this.camera.position.x = Math.sin(t * 0.5) * 0.35;
      this.camera.position.y = 1.75 + Math.sin(t * 0.4) * 0.05;
      this.camera.position.z = 6.2 + Math.cos(t * 0.5) * 0.25;
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.z = 0;
    }

    if (this.gameStarted() && !this.isPaused() && !this.isGameOver()) {
      this.updateWeaponSwitch(dt);
      this.updateReload(dt);
      this.updateSpawner(dt);
      this.updateEnemies(dt);
      this.updatePlayerMovement(dt);
      this.updateAutoFire();
      this.updateProjectiles(dt);
      this.updatePowerUpOrbs(dt);
      this.updateInteractablesAndBarricades(dt);
      this.updateHealthRegen(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private animateEnvironment(dt: number, now: number): void {
    const t = now * 0.006;
    this.torchLights.forEach((light, idx) => {
      light.intensity = 4.2 + Math.sin(t + idx * 1.9) * 0.45;
    });
    this.torchFlames.forEach((flame, idx) => {
      const s = 1 + Math.sin(t * 1.6 + idx) * 0.12;
      flame.scale.set(1, s, 1);
    });
    if (this.dustParticles) {
      this.dustParticles.rotation.y += dt * 0.03;
    }
  }

  private updatePlayerMovement(dt: number): void {
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yaw
    );
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yaw
    );

    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDir.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDir.sub(forward);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.add(right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir.sub(right);

    const isMoving = moveDir.lengthSq() > 0;
    const aiming = this.isAiming() && !this.isReloading() && this.switchPhase === 'none';
    const isSprinting =
      isMoving && !aiming && (this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const staminUpBonus = this.hasPerk('earendil_light') ? 1.25 : 1.0;
    const baseSpeed = aiming ? 3.8 : isSprinting ? 7.6 : 5.4;
    const speed = baseSpeed * staminUpBonus;

    let targetCamBobY = 0;
    let targetCamBobX = 0;
    let targetCamRollZ = 0;

    if (isMoving) {
      moveDir.normalize();
      const prevX = this.playerPos.x;
      const prevZ = this.playerPos.z;
      const totalStep = speed * dt;

      const subSteps = Math.max(1, Math.ceil(totalStep / 0.12));
      const subStepDist = totalStep / subSteps;

      for (let s = 0; s < subSteps; s++) {
        const nextX = this.playerPos.x + moveDir.x * subStepDist;
        const nextZ = this.playerPos.z + moveDir.z * subStepDist;

        if (this.canMoveToStatic(nextX, this.playerPos.z)) {
          this.playerPos.x = nextX;
        }
        if (this.canMoveToStatic(this.playerPos.x, nextZ)) {
          this.playerPos.z = nextZ;
        }

        this.resolvePlayerEnemyCollisions();
      }

      const actualMoved = Math.hypot(this.playerPos.x - prevX, this.playerPos.z - prevZ);
      const moveRatio = Math.min(1, actualMoved / Math.max(0.0001, totalStep));
      const effectiveSprinting = isSprinting && moveRatio > 0.35;

      this.walkBobTimer +=
        dt * (effectiveSprinting ? 11.5 : aiming ? 5.5 : 7.5) * Math.max(0.2, moveRatio);

      if (effectiveSprinting) {
        targetCamBobY = Math.sin(this.walkBobTimer * 2) * 0.085 * moveRatio;
        targetCamBobX = Math.cos(this.walkBobTimer) * 0.055 * moveRatio;
        targetCamRollZ = -Math.cos(this.walkBobTimer) * 0.015 * moveRatio;
      } else {
        const walkAmp = (aiming ? 0.4 : 1.0) * Math.max(0.15, moveRatio);
        targetCamBobY = Math.sin(this.walkBobTimer * 2) * 0.018 * walkAmp;
        targetCamBobX = Math.cos(this.walkBobTimer) * 0.01 * walkAmp;
        targetCamRollZ = 0;
      }
    } else {
      this.walkBobTimer = 0;
      this.resolvePlayerEnemyCollisions();
    }

    // Smoothly follow multi-floor & staircase vertical elevation
    const targetGroundY = this.sceneHelper.getFloorHeightAt(this.playerPos.x, this.playerPos.z);
    this.playerGroundY = THREE.MathUtils.lerp(
      this.playerGroundY,
      targetGroundY,
      Math.min(1, dt * 18)
    );
    this.playerPos.y = this.playerGroundY + 1.75;

    const lerpFactor = Math.min(1, dt * 12);
    this.camBobOffsetY = THREE.MathUtils.lerp(this.camBobOffsetY, targetCamBobY, lerpFactor);
    this.camBobOffsetX = THREE.MathUtils.lerp(this.camBobOffsetX, targetCamBobX, lerpFactor);
    this.camRollZ = THREE.MathUtils.lerp(this.camRollZ, targetCamRollZ, lerpFactor);

    this.camera.position.set(
      this.playerPos.x + right.x * this.camBobOffsetX,
      this.playerPos.y + this.camBobOffsetY,
      this.playerPos.z + right.z * this.camBobOffsetX
    );
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.camRollZ;

    this.aimBlend = THREE.MathUtils.lerp(this.aimBlend, aiming ? 1 : 0, Math.min(1, dt * 14));
    const targetFov = THREE.MathUtils.lerp(75, 58, this.aimBlend);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    if (this.viewModelGroup) {
      const fireRateSec = this.getEffectiveFireRateMs(this.currentWeapon()) / 1000;
      const recoilDecay = Math.max(1.1, 0.35 / Math.max(0.1, fireRateSec));
      this.viewModelRecoil = Math.max(0, this.viewModelRecoil - dt * recoilDecay);

      if (this.currentWeapon().currentMag > 0 && !this.isReloading()) {
        const nockSpeed = 1 / Math.max(0.08, fireRateSec * 0.78);
        this.arrowNockProgress = Math.min(1, this.arrowNockProgress + dt * nockSpeed);
      } else if (this.isReloading()) {
        this.arrowNockProgress = Math.min(1, (this.reloadProgress() / 100) * 1.2);
      } else {
        this.arrowNockProgress = 0;
      }

      const autoDrawing =
        this.isMouseDown && this.arrowNockProgress > 0.65 && this.switchPhase === 'none';
      const targetDraw =
        this.arrowNockProgress > 0.65 ? (aiming || autoDrawing ? 0.19 : 0.045) : 0.0;
      this.currentDrawDistance = THREE.MathUtils.lerp(
        this.currentDrawDistance,
        targetDraw,
        Math.min(1, dt * 18)
      );

      this.sceneHelper.updateWeaponAnim(this.viewModelGroup, {
        dt,
        walkBobTimer: this.walkBobTimer,
        isSprinting,
        isAiming: aiming,
        aimBlend: this.aimBlend,
        recoil: this.viewModelRecoil,
        drawDistance: this.currentDrawDistance,
        arrowNockProgress: this.arrowNockProgress,
        isReloading: this.isReloading(),
        reloadProgress: this.reloadProgress(),
        switchPhase: this.switchPhase,
        switchProgress: this.switchProgress
      });
    }
  }

  private getEnemyCollisionRadius(enemy: EnemyEntity): number {
    return enemy.type === 'uruk' ? 0.56 : enemy.type === 'orc' ? 0.5 : 0.44;
  }

  private getPlayerEnemyMinDist(enemy: EnemyEntity): number {
    const playerRadius = 0.52;
    return playerRadius + this.getEnemyCollisionRadius(enemy);
  }

  /**
   * Evaluates whether (x, z) with given radius margin is inside any unlocked room or staircase.
   */
  private isInsideWalkableRooms(x: number, z: number, margin: number): boolean {
    // 1. Room 1: Cámara de Mazarbul (28m x 28m, x in [-14, 14], z in [-14, 14])
    const inRoom1 =
      x >= -13.7 + margin &&
      x <= 13.7 - margin &&
      z >= -13.7 + margin &&
      z <= 13.7 - margin;
    if (inRoom1) return true;

    // 2. Central Miners' Descending Tunnel (z in [12.5, 27.5], x in [-2.25, 2.25])
    if (this.isDoorUnlocked('door_zone_2')) {
      const inTunnel =
        x >= -2.25 + margin &&
        x <= 2.25 - margin &&
        z >= 12.4 &&
        z <= 27.6;
      if (inTunnel) return true;
    }

    // 3. Room 2: Gran Sala de los Pilares (28m x 28m, x in [-14, 14], z in [26, 54])
    if (this.isRoomUnlocked(2)) {
      const inRoom2 =
        x >= -13.7 + margin &&
        x <= 13.7 - margin &&
        z >= 26.3 + margin &&
        z <= 53.7 - margin;
      if (inRoom2) return true;
    }

    // 4. West-North Ascending Staircase (Door `door_zone_3_north`, z centered at -3.5)
    if (this.isDoorUnlocked('door_zone_3_north')) {
      const inStairsWN =
        x >= -23.6 &&
        x <= -12.4 &&
        z >= -5.6 + margin &&
        z <= -1.4 - margin;
      if (inStairsWN) return true;
    }

    // 5. West-South Staircase (Door `door_zone_3_south`, z centered at 32.0)
    if (this.isDoorUnlocked('door_zone_3_south')) {
      const inStairsWS =
        x >= -23.6 &&
        x <= -12.4 &&
        z >= 29.9 + margin &&
        z <= 34.1 - margin;
      if (inStairsWS) return true;
    }

    // 6. Room 3: Galería Real de Durin (West Upper Wing, x in [-35, -22], z in [-8.5, 36.5])
    if (this.isRoomUnlocked(3)) {
      const inRoom3 =
        x >= -34.7 + margin &&
        x <= -22.3 - margin &&
        z >= -8.2 + margin &&
        z <= 36.2 - margin;
      if (inRoom3) return true;
    }

    // 7. East-North Descending Staircase (Door `door_zone_4_north`, z centered at -3.5)
    if (this.isDoorUnlocked('door_zone_4_north')) {
      const inStairsEN =
        x >= 12.4 &&
        x <= 23.6 &&
        z >= -5.6 + margin &&
        z <= -1.4 - margin;
      if (inStairsEN) return true;
    }

    // 8. East-South Staircase (Door `door_zone_4_south`, z centered at 32.0)
    if (this.isDoorUnlocked('door_zone_4_south')) {
      const inStairsES =
        x >= 12.4 &&
        x <= 23.6 &&
        z >= 29.9 + margin &&
        z <= 34.1 - margin;
      if (inStairsES) return true;
    }

    // 9. Room 4: Minas Profundas de Mithril (East Deep Wing, x in [22, 35], z in [-8.5, 36.5])
    if (this.isRoomUnlocked(4)) {
      const inRoom4 =
        x >= 22.3 + margin &&
        x <= 34.7 - margin &&
        z >= -8.2 + margin &&
        z <= 36.2 - margin;
      if (inRoom4) return true;
    }

    // 10. Room 5: Abyssal Stairs, Bridge of Khazad-dûm & Sanctum of Celebrimbor (Door `door_zone_5`)
    if (this.isDoorUnlocked('door_zone_5')) {
      const inAbyssStairs =
        x >= -2.25 + margin &&
        x <= 2.25 - margin &&
        z >= 52.4 &&
        z <= 62.5;
      const inBridge =
        x >= -3.0 + margin &&
        x <= 3.0 - margin &&
        z >= 61.0 &&
        z <= 69.2;
      const inSanctum =
        x >= -11.2 + margin &&
        x <= 11.2 - margin &&
        z >= 68.3 + margin &&
        z <= 78.7 - margin;
      if (inAbyssStairs || inBridge || inSanctum) return true;
    }

    return false;
  }

  private canMoveToStatic(x: number, z: number): boolean {
    const margin = 0.7;
    if (!this.isInsideWalkableRooms(x, z, margin)) return false;

    for (const box of this.obstacles) {
      if (
        x + margin > box.min.x &&
        x - margin < box.max.x &&
        z + margin > box.min.z &&
        z - margin < box.max.z
      ) {
        return false;
      }
    }
    return true;
  }

  private resolvePlayerEnemyCollisions(): void {
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      if (Math.abs(this.playerGroundY - enemy.mesh.position.y) > 1.8) continue;

      const minDist = this.getPlayerEnemyMinDist(enemy);
      const dx = this.playerPos.x - enemy.mesh.position.x;
      const dz = this.playerPos.z - enemy.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < minDist) {
        const nx = dist > 0.0001 ? dx / dist : Math.sin(this.yaw);
        const nz = dist > 0.0001 ? dz / dist : Math.cos(this.yaw);
        const penetration = minDist - dist;

        const candX = this.playerPos.x + nx * penetration;
        const candZ = this.playerPos.z + nz * penetration;

        if (this.canMoveToStatic(candX, this.playerPos.z)) {
          this.playerPos.x = candX;
        }
        if (this.canMoveToStatic(this.playerPos.x, candZ)) {
          this.playerPos.z = candZ;
        }

        const remDx = this.playerPos.x - enemy.mesh.position.x;
        const remDz = this.playerPos.z - enemy.mesh.position.z;
        const remDist = Math.hypot(remDx, remDz);
        if (remDist < minDist) {
          const pushEnemy = minDist - remDist;
          const enx = remDist > 0.0001 ? remDx / remDist : nx;
          const enz = remDist > 0.0001 ? remDz / remDist : nz;
          const enemyCandX = enemy.mesh.position.x - enx * pushEnemy;
          const enemyCandZ = enemy.mesh.position.z - enz * pushEnemy;
          if (!this.hitsObstacle(enemyCandX, enemy.mesh.position.z)) {
            enemy.mesh.position.x = enemyCandX;
          }
          if (!this.hitsObstacle(enemy.mesh.position.x, enemyCandZ)) {
            enemy.mesh.position.z = enemyCandZ;
          }
        }
      }
    }
  }

  private updateAutoFire(): void {
    if (this.isMouseDown) {
      this.tryShoot();
    }
  }

  private updateSpawner(dt: number): void {
    if (this.roundTransitioning() || this.enemiesToSpawnInRound <= 0) return;

    const activeCount = this.enemies.filter((e) => e.state !== 'dead').length;
    if (activeCount >= 24) return;

    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      this.spawnNextEnemy();
      this.enemiesToSpawnInRound--;
      this.spawnCooldown = Math.max(0.6, 1.9 - this.round() * 0.11);
    }
  }

  // ===========================================================================
  // MULTI-ROOM & MULTI-STAIRCASE PORTAL BFS NAVIGATION FOR ENEMIES
  // ===========================================================================
  private classifyNavZone(x: number, z: number): string {
    if (x < -14.0) {
      if (x > -22.0) {
        return z < 12.0 ? 'STAIRS_W_N' : 'STAIRS_W_S';
      }
      return z < 14.0 ? 'R3_NORTH' : 'R3_SOUTH';
    }
    if (x > 14.0) {
      if (x < 22.0) {
        return z < 12.0 ? 'STAIRS_E_N' : 'STAIRS_E_S';
      }
      return z < 14.0 ? 'R4_NORTH' : 'R4_SOUTH';
    }
    if (z < -7.6) return 'R1_NORTH';
    if (z <= 14.0) return 'R1_MAIN';
    if (z < 26.0) return 'TUNNEL_1_2';
    if (z <= 46.2) return 'R2_MAIN';
    if (z <= 54.0) return 'R2_SOUTH';
    if (z < 68.5) return 'STAIRS_S_5';
    return 'R5_MAIN';
  }

  /**
   * Computes a dynamic waypoint for chasing enemies across all 5 rooms, 8 staircases,
   * and internal elevated terraces using a fast Portal BFS over unlocked doors.
   */
  private getChasingTargetForEnemy(enemy: EnemyEntity): THREE.Vector3 {
    const ex = enemy.mesh.position.x;
    const ez = enemy.mesh.position.z;
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    const startNode = this.classifyNavZone(ex, ez);
    const goalNode = this.classifyNavZone(px, pz);

    if (startNode === goalNode) {
      return new THREE.Vector3(px, 0, pz);
    }

    type PortalEdge = {
      to: string;
      open: boolean;
      target: () => THREE.Vector3;
    };

    const nearNorthStairX = ex < 0 ? -7.4 : 7.4;
    const nearZ2StairX = ex < 0 ? -9.1 : 9.1;
    const nearR3LaneX = ex < -28.5 ? -32.2 : -24.8;
    const nearR4LaneX = ex < 28.5 ? 24.8 : 32.2;

    const d2 = this.isDoorUnlocked('door_zone_2');
    const d3N = this.isDoorUnlocked('door_zone_3_north');
    const d3S = this.isDoorUnlocked('door_zone_3_south');
    const d4N = this.isDoorUnlocked('door_zone_4_north');
    const d4S = this.isDoorUnlocked('door_zone_4_south');
    const d5 = this.isDoorUnlocked('door_zone_5');

    const graph: Record<string, PortalEdge[]> = {
      R1_NORTH: [
        {
          to: 'R1_MAIN',
          open: true,
          target: () => new THREE.Vector3(nearNorthStairX, 0, -5.4)
        }
      ],
      R1_MAIN: [
        {
          to: 'R1_NORTH',
          open: true,
          target: () =>
            Math.abs(ex - nearNorthStairX) > 2.2
              ? new THREE.Vector3(nearNorthStairX, 0, -5.4)
              : new THREE.Vector3(nearNorthStairX, 0, -9.8)
        },
        {
          to: 'TUNNEL_1_2',
          open: d2,
          target: () =>
            Math.abs(ex) > 1.4
              ? new THREE.Vector3(0, 0, 12.6)
              : new THREE.Vector3(0, 0, 15.5)
        },
        {
          to: 'STAIRS_W_N',
          open: d3N,
          target: () =>
            Math.abs(ez - -3.5) > 1.4
              ? new THREE.Vector3(-12.6, 0, -3.5)
              : new THREE.Vector3(-15.5, 0, -3.5)
        },
        {
          to: 'STAIRS_E_N',
          open: d4N,
          target: () =>
            Math.abs(ez - -3.5) > 1.4
              ? new THREE.Vector3(12.6, 0, -3.5)
              : new THREE.Vector3(15.5, 0, -3.5)
        }
      ],
      TUNNEL_1_2: [
        { to: 'R1_MAIN', open: d2, target: () => new THREE.Vector3(0, 0, 12.6) },
        { to: 'R2_MAIN', open: d2, target: () => new THREE.Vector3(0, 0, 27.4) }
      ],
      R2_MAIN: [
        {
          to: 'TUNNEL_1_2',
          open: d2,
          target: () =>
            Math.abs(ex) > 1.4
              ? new THREE.Vector3(0, 0, 27.4)
              : new THREE.Vector3(0, 0, 24.5)
        },
        {
          to: 'R2_SOUTH',
          open: true,
          target: () =>
            Math.abs(ex - nearZ2StairX) > 2.2
              ? new THREE.Vector3(nearZ2StairX, 0, 43.8)
              : new THREE.Vector3(nearZ2StairX, 0, 48.6)
        },
        {
          to: 'STAIRS_W_S',
          open: d3S,
          target: () =>
            Math.abs(ez - 32.0) > 1.4
              ? new THREE.Vector3(-12.6, 0, 32.0)
              : new THREE.Vector3(-15.5, 0, 32.0)
        },
        {
          to: 'STAIRS_E_S',
          open: d4S,
          target: () =>
            Math.abs(ez - 32.0) > 1.4
              ? new THREE.Vector3(12.6, 0, 32.0)
              : new THREE.Vector3(15.5, 0, 32.0)
        }
      ],
      R2_SOUTH: [
        {
          to: 'R2_MAIN',
          open: true,
          target: () =>
            Math.abs(ex - nearZ2StairX) > 2.2
              ? new THREE.Vector3(nearZ2StairX, 0, 48.6)
              : new THREE.Vector3(nearZ2StairX, 0, 43.8)
        },
        {
          to: 'STAIRS_S_5',
          open: d5,
          target: () =>
            Math.abs(ex) > 1.4
              ? new THREE.Vector3(0, 0, 52.6)
              : new THREE.Vector3(0, 0, 56.0)
        }
      ],
      STAIRS_W_N: [
        { to: 'R1_MAIN', open: d3N, target: () => new THREE.Vector3(-12.6, 0, -3.5) },
        { to: 'R3_NORTH', open: d3N, target: () => new THREE.Vector3(-23.5, 0, -3.5) }
      ],
      R3_NORTH: [
        {
          to: 'STAIRS_W_N',
          open: d3N,
          target: () =>
            Math.abs(ez - -3.5) > 1.4
              ? new THREE.Vector3(-23.5, 0, -3.5)
              : new THREE.Vector3(-20.5, 0, -3.5)
        },
        {
          to: 'R3_SOUTH',
          open: true,
          target: () => new THREE.Vector3(nearR3LaneX, 0, 18.5)
        }
      ],
      R3_SOUTH: [
        {
          to: 'R3_NORTH',
          open: true,
          target: () => new THREE.Vector3(nearR3LaneX, 0, 9.5)
        },
        {
          to: 'STAIRS_W_S',
          open: d3S,
          target: () =>
            Math.abs(ez - 32.0) > 1.4
              ? new THREE.Vector3(-23.5, 0, 32.0)
              : new THREE.Vector3(-20.5, 0, 32.0)
        }
      ],
      STAIRS_W_S: [
        { to: 'R3_SOUTH', open: d3S, target: () => new THREE.Vector3(-23.5, 0, 32.0) },
        { to: 'R2_MAIN', open: d3S, target: () => new THREE.Vector3(-12.6, 0, 32.0) }
      ],
      STAIRS_E_N: [
        { to: 'R1_MAIN', open: d4N, target: () => new THREE.Vector3(12.6, 0, -3.5) },
        { to: 'R4_NORTH', open: d4N, target: () => new THREE.Vector3(23.5, 0, -3.5) }
      ],
      R4_NORTH: [
        {
          to: 'STAIRS_E_N',
          open: d4N,
          target: () =>
            Math.abs(ez - -3.5) > 1.4
              ? new THREE.Vector3(23.5, 0, -3.5)
              : new THREE.Vector3(20.5, 0, -3.5)
        },
        {
          to: 'R4_SOUTH',
          open: true,
          target: () => new THREE.Vector3(nearR4LaneX, 0, 18.5)
        }
      ],
      R4_SOUTH: [
        {
          to: 'R4_NORTH',
          open: true,
          target: () => new THREE.Vector3(nearR4LaneX, 0, 9.5)
        },
        {
          to: 'STAIRS_E_S',
          open: d4S,
          target: () =>
            Math.abs(ez - 32.0) > 1.4
              ? new THREE.Vector3(23.5, 0, 32.0)
              : new THREE.Vector3(20.5, 0, 32.0)
        }
      ],
      STAIRS_E_S: [
        { to: 'R4_SOUTH', open: d4S, target: () => new THREE.Vector3(23.5, 0, 32.0) },
        { to: 'R2_MAIN', open: d4S, target: () => new THREE.Vector3(12.6, 0, 32.0) }
      ],
      STAIRS_S_5: [
        { to: 'R2_SOUTH', open: d5, target: () => new THREE.Vector3(0, 0, 52.6) },
        { to: 'R5_MAIN', open: d5, target: () => new THREE.Vector3(0, 0, 69.5) }
      ],
      R5_MAIN: [
        {
          to: 'STAIRS_S_5',
          open: d5,
          target: () =>
            Math.abs(ex) > 1.6
              ? new THREE.Vector3(0, 0, 69.5)
              : new THREE.Vector3(0, 0, 66.0)
        }
      ]
    };

    // Fast BFS to find the first step along the shortest open path from startNode to goalNode
    const queue: Array<{ node: string; firstEdge: PortalEdge }> = [];
    const visited = new Set<string>([startNode]);

    for (const edge of graph[startNode] || []) {
      if (!edge.open) continue;
      if (edge.to === goalNode) {
        return edge.target();
      }
      visited.add(edge.to);
      queue.push({ node: edge.to, firstEdge: edge });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of graph[current.node] || []) {
        if (!edge.open || visited.has(edge.to)) continue;
        if (edge.to === goalNode) {
          return current.firstEdge.target();
        }
        visited.add(edge.to);
        queue.push({ node: edge.to, firstEdge: current.firstEdge });
      }
    }

    return new THREE.Vector3(px, 0, pz);
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      enemy.hpBarFill.parent?.children.forEach((child) => {
        if (child.position.y > 2.1) {
          child.lookAt(this.camera.position);
        }
      });

      if (enemy.state === 'dead') {
        enemy.deathTimer -= dt;
        const fallDir = enemy.id % 2 === 0 ? 1 : -1;
        enemy.mesh.rotation.x = Math.max(-Math.PI / 2.1, enemy.mesh.rotation.x - dt * 3.8);
        enemy.mesh.rotation.z = THREE.MathUtils.lerp(enemy.mesh.rotation.z, fallDir * 0.25, dt * 4);
        enemy.mesh.position.y -= dt * 0.75;
        if (enemy.deathTimer <= 0) {
          this.scene.remove(enemy.mesh);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      }
      const stagger = enemy.hitFlashTimer / 0.24;

      enemy.walkCycle += dt * enemy.speed * 3.4;
      const stride = Math.sin(enemy.walkCycle);
      const doubleStep = Math.abs(Math.cos(enemy.walkCycle));

      const win = this.windows.find((w) => w.id === enemy.targetWindowId);
      const baseGroundY =
        enemy.state === 'chasing'
          ? this.sceneHelper.getFloorHeightAt(enemy.mesh.position.x, enemy.mesh.position.z)
          : win
          ? win.position.y
          : 0;

      // Realistic vertical hip bounce on top of the current floor/stair elevation!
      enemy.mesh.position.y = baseGroundY + doubleStep * 0.055;
      enemy.leftLeg.rotation.x = stride * 0.62;
      enemy.rightLeg.rotation.x = -stride * 0.62;

      enemy.bodyMesh.rotation.x = 0.18 + doubleStep * 0.06 - stagger * 0.65;
      enemy.bodyMesh.rotation.y = stride * 0.18;
      enemy.bodyMesh.rotation.z = Math.cos(enemy.walkCycle * 0.5) * 0.06;

      const baseHeadTilt = (enemy.id % 2 === 0 ? 1 : -1) * 0.16;
      enemy.headMesh.rotation.z = baseHeadTilt + Math.sin(enemy.walkCycle * 0.5) * 0.08;
      enemy.headMesh.rotation.x = -0.08 + Math.sin(enemy.walkCycle) * 0.06 - stagger * 0.75;
      enemy.headMesh.rotation.y = -stride * 0.12;

      enemy.leftArm.rotation.x = -Math.PI / 2.5 + Math.cos(enemy.walkCycle) * 0.26 + stagger * 0.5;
      enemy.rightArm.rotation.x = -Math.PI / 2.5 - Math.cos(enemy.walkCycle) * 0.26 + stagger * 0.5;

      if (enemy.state === 'approaching_window' && win) {
        const target = win.position;
        this.moveEnemyToward(enemy, target, dt, false);
        if (
          Math.hypot(
            enemy.mesh.position.x - target.x,
            enemy.mesh.position.z - target.z
          ) < 1.35
        ) {
          enemy.state = 'breaking_barrier';
        }
      } else if (enemy.state === 'breaking_barrier' && win) {
        enemy.mesh.lookAt(this.playerPos.x, enemy.mesh.position.y, this.playerPos.z);
        if (win.planks > 0) {
          enemy.barrierAttackTimer += dt;
          const swipe = Math.sin(enemy.barrierAttackTimer * Math.PI * 1.4);
          enemy.rightArm.rotation.x = -Math.PI / 1.7 + swipe * 0.75;
          enemy.leftArm.rotation.x = -Math.PI / 2.1 - swipe * 0.45;
          if (enemy.barrierAttackTimer >= 1.45) {
            enemy.barrierAttackTimer = 0;
            win.planks--;
            win.plankMeshes[win.planks].visible = false;
            this.sound.playBreakPlank();
          }
        } else {
          this.moveEnemyToward(enemy, win.insideEntryPos, dt, false);
          if (
            Math.hypot(
              enemy.mesh.position.x - win.insideEntryPos.x,
              enemy.mesh.position.z - win.insideEntryPos.z
            ) < 0.75
          ) {
            enemy.state = 'chasing';
          }
        }
      } else if (enemy.state === 'chasing') {
        const distToPlayer2D = Math.hypot(
          this.playerPos.x - enemy.mesh.position.x,
          this.playerPos.z - enemy.mesh.position.z
        );
        const heightDiff = Math.abs(this.playerGroundY - baseGroundY);
        const minContactDist = this.getPlayerEnemyMinDist(enemy);

        if (distToPlayer2D > minContactDist + 0.04 || heightDiff > 1.5) {
          const navTarget = this.getChasingTargetForEnemy(enemy);
          this.moveEnemyToward(enemy, navTarget, dt, true);
        } else {
          enemy.mesh.lookAt(this.playerPos.x, enemy.mesh.position.y, this.playerPos.z);
        }

        if (distToPlayer2D <= 1.52 && heightDiff <= 1.5) {
          enemy.mesh.lookAt(this.playerPos.x, enemy.mesh.position.y, this.playerPos.z);
          enemy.playerAttackTimer += dt;
          const slash = Math.sin(enemy.playerAttackTimer * Math.PI * 2);
          enemy.rightArm.rotation.x = -Math.PI / 1.6 + slash * 0.85;
          enemy.leftArm.rotation.x = -Math.PI / 1.9 - slash * 0.55;
          if (enemy.playerAttackTimer >= 0.95) {
            enemy.playerAttackTimer = 0;
            this.damagePlayer(enemy.damage);
          }
        }
      }
    }

    this.resolveEnemyToEnemyCollisions();
  }

  private resolveEnemyToEnemyCollisions(): void {
    const count = this.enemies.length;
    for (let i = 0; i < count; i++) {
      const a = this.enemies[i];
      if (a.state === 'dead') continue;
      const rA = this.getEnemyCollisionRadius(a);

      for (let j = i + 1; j < count; j++) {
        const b = this.enemies[j];
        if (b.state === 'dead') continue;
        if (Math.abs(a.mesh.position.y - b.mesh.position.y) > 1.8) continue;

        const minSep = (rA + this.getEnemyCollisionRadius(b)) * 0.88;
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < minSep) {
          const nx = dist > 0.0001 ? dx / dist : 1;
          const nz = dist > 0.0001 ? dz / dist : 0;
          const halfPush = (minSep - dist) * 0.5;

          const aNextX = a.mesh.position.x - nx * halfPush;
          const aNextZ = a.mesh.position.z - nz * halfPush;
          const bNextX = b.mesh.position.x + nx * halfPush;
          const bNextZ = b.mesh.position.z + nz * halfPush;

          const aAvoid = a.state === 'chasing';
          const bAvoid = b.state === 'chasing';

          if (!aAvoid || !this.hitsObstacle(aNextX, a.mesh.position.z)) {
            a.mesh.position.x = aNextX;
          }
          if (!aAvoid || !this.hitsObstacle(a.mesh.position.x, aNextZ)) {
            a.mesh.position.z = aNextZ;
          }
          if (!bAvoid || !this.hitsObstacle(bNextX, b.mesh.position.z)) {
            b.mesh.position.x = bNextX;
          }
          if (!bAvoid || !this.hitsObstacle(b.mesh.position.x, bNextZ)) {
            b.mesh.position.z = bNextZ;
          }
        }
      }
    }
  }

  private moveEnemyToward(
    enemy: EnemyEntity,
    target: THREE.Vector3,
    dt: number,
    avoidObstacles: boolean
  ): void {
    const dir = new THREE.Vector3(
      target.x - enemy.mesh.position.x,
      0,
      target.z - enemy.mesh.position.z
    ).normalize();

    enemy.mesh.lookAt(target.x, enemy.mesh.position.y, target.z);

    let stepX = enemy.mesh.position.x + dir.x * enemy.speed * dt;
    let stepZ = enemy.mesh.position.z + dir.z * enemy.speed * dt;

    // Prevent enemy from stepping inside the player's collision cylinder when on the same floor
    if (Math.abs(this.playerGroundY - enemy.mesh.position.y) < 1.6) {
      const minDist = this.getPlayerEnemyMinDist(enemy);
      const dx = stepX - this.playerPos.x;
      const dz = stepZ - this.playerPos.z;
      const distToPlayer = Math.hypot(dx, dz);
      if (distToPlayer < minDist && distToPlayer > 0.0001) {
        stepX = this.playerPos.x + (dx / distToPlayer) * minDist;
        stepZ = this.playerPos.z + (dz / distToPlayer) * minDist;
      }
    }

    const canX = !avoidObstacles || !this.hitsObstacle(stepX, enemy.mesh.position.z);
    const canZ = !avoidObstacles || !this.hitsObstacle(enemy.mesh.position.x, stepZ);

    if (canX) {
      enemy.mesh.position.x = stepX;
    } else if (avoidObstacles) {
      // Tangential slide along Z when X is blocked by an island/pillar
      const slideSign = dir.z >= 0 ? 1 : -1;
      const slideZ = enemy.mesh.position.z + slideSign * enemy.speed * dt * 0.85;
      if (!this.hitsObstacle(enemy.mesh.position.x, slideZ)) {
        enemy.mesh.position.z = slideZ;
      }
    }

    if (canZ) {
      enemy.mesh.position.z = stepZ;
    } else if (avoidObstacles) {
      // Tangential slide along X when Z is blocked by an island/tomb
      const slideSign = dir.x >= 0 ? 1 : -1;
      const slideX = enemy.mesh.position.x + slideSign * enemy.speed * dt * 0.85;
      if (!this.hitsObstacle(slideX, enemy.mesh.position.z)) {
        enemy.mesh.position.x = slideX;
      }
    }
  }

  private hitsObstacle(x: number, z: number): boolean {
    if (!this.isInsideWalkableRooms(x, z, 0.44)) return true;

    for (const box of this.obstacles) {
      if (
        x + 0.44 > box.min.x &&
        x - 0.44 < box.max.x &&
        z + 0.44 > box.min.z &&
        z - 0.44 < box.max.z
      ) {
        return true;
      }
    }
    return false;
  }

  private damagePlayer(amount: number): void {
    if (this.isGameOver()) return;
    this.lastDamageTime = performance.now();
    this.sound.playPlayerDamage();
    this.damageFlash.set(true);
    setTimeout(() => this.damageFlash.set(false), 220);

    const nextHp = this.health() - amount;
    if (nextHp <= 0) {
      this.health.set(0);
      this.isGameOver.set(true);
      document.exitPointerLock?.();
    } else {
      this.health.set(nextHp);
    }
  }

  private updateHealthRegen(dt: number): void {
    if (this.health() < this.maxHealth() && performance.now() - this.lastDamageTime > 4000) {
      this.health.update((h) => Math.min(this.maxHealth(), Math.round(h + 28 * dt)));
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.isUpgraded && p.spinNode) {
        p.spinNode.rotation.z += dt * 34;
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.materials.forEach((m) => m.dispose());
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.impactBursts.length - 1; i >= 0; i--) {
      const b = this.impactBursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.group);
        b.materials.forEach((m) => m.dispose());
        this.impactBursts.splice(i, 1);
        continue;
      }
      const progress = 1 - b.life / b.maxLife;
      const easeOut = 1 - Math.pow(1 - progress, 2.4);
      const scale = THREE.MathUtils.lerp(0.35, b.maxScale, easeOut);
      b.group.scale.setScalar(scale);
      b.ring1.rotation.z += dt * 12;
      if (b.ring2) {
        b.ring2.rotation.x += dt * 16;
        b.ring2.rotation.y -= dt * 14;
      }
      const alpha = Math.max(0, 1 - progress);
      b.materials.forEach((m) => {
        (m as THREE.MeshBasicMaterial).opacity = alpha * 0.9;
      });
    }
  }

  private updatePowerUpOrbs(dt: number): void {
    if (this.activePowerUps().length > 0) {
      this.activePowerUps.update((list) =>
        list
          .map((p) => ({ ...p, remainingSec: p.remainingSec - dt }))
          .filter((p) => p.remainingSec > 0)
      );
    }

    for (let i = this.powerUpOrbs.length - 1; i >= 0; i--) {
      const orb = this.powerUpOrbs[i];
      orb.life -= dt;
      orb.mesh.rotation.y += dt * 2.5;

      const dist2D = Math.hypot(
        this.playerPos.x - orb.position.x,
        this.playerPos.z - orb.position.z
      );
      const heightDiff = Math.abs(this.playerGroundY + 1.0 - orb.position.y);
      if (dist2D < 1.65 && heightDiff < 2.0) {
        this.activatePowerUp(orb.type, orb.name);
        this.scene.remove(orb.mesh);
        this.powerUpOrbs.splice(i, 1);
        continue;
      }

      if (orb.life <= 0) {
        this.scene.remove(orb.mesh);
        this.powerUpOrbs.splice(i, 1);
      }
    }
  }

  private updateInteractablesAndBarricades(dt: number): void {
    for (const item of this.interactables) {
      if ((item.type === 'perk' || item.type === 'pack_a_punch') && item.mesh) {
        item.mesh.rotation.y += dt * 1.4;
      }
    }

    let closest: InteractableItem | null = null;
    let minDist = Infinity;

    for (const item of this.interactables) {
      if (item.type === 'door' && item.doorId && this.isDoorUnlocked(item.doorId)) continue;

      const d = Math.hypot(
        this.playerPos.x - item.position.x,
        this.playerPos.z - item.position.z
      );
      const itemGroundY = this.sceneHelper.getFloorHeightAt(item.position.x, item.position.z);
      const heightDiff = Math.abs(this.playerGroundY - itemGroundY);

      if (d <= item.radius && heightDiff <= 2.2 && d < minDist) {
        if (item.type === 'window' && item.windowId) {
          const win = this.windows.find((w) => w.id === item.windowId);
          if (!win || win.planks >= win.maxPlanks) continue;
        }
        minDist = d;
        closest = item;
      }
    }

    if (this.activeInteractable()?.id !== closest?.id) {
      this.activeInteractable.set(closest);
    }

    if (closest && closest.type === 'window' && closest.windowId && this.keys['KeyF']) {
      const win = this.windows.find((w) => w.id === closest.windowId);
      if (win && win.planks < win.maxPlanks) {
        const repairSpeed = this.hasPerk('lembas_bread') ? 0.45 : 0.85;
        this.repairHoldTimer += dt;
        const nextPct = Math.min(100, Math.round((this.repairHoldTimer / repairSpeed) * 100));
        if (nextPct !== this.repairProgress()) {
          this.repairProgress.set(nextPct);
        }

        if (this.repairHoldTimer >= repairSpeed) {
          this.repairHoldTimer = 0;
          this.repairProgress.set(0);
          win.plankMeshes[win.planks].visible = true;
          win.planks++;
          this.sound.playRepairPlank();

          const maxRepairPointsForRound = 50 + this.round() * 40;
          if (this.repairedPointsThisRound < maxRepairPointsForRound) {
            this.repairedPointsThisRound += 10;
            this.awardPoints(10, false);
          }
        }
      }
    } else if (this.repairHoldTimer > 0) {
      this.repairHoldTimer = 0;
      this.repairProgress.set(0);
    }
  }
}
