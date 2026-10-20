import * as THREE from 'three';
import {
  BarricadeWindow,
  DoorId,
  EnemyType,
  InteractableItem,
  PerkId,
  PerkInfo,
  WeaponConfig,
  WeaponId
} from '../models/game.models';

export interface ZoneOneBuildResult {
  windows: BarricadeWindow[];
  interactables: InteractableItem[];
  obstacles: THREE.Box3[];
  torchLights: THREE.PointLight[];
  torchFlames: THREE.Object3D[];
  dustParticles: THREE.Points;
}

export class MoriaSceneHelper {
  private loader = new THREE.TextureLoader();

  // Shared PBR Materials (Single GPU texture upload per surface type -> 60+ FPS with rich normal maps & IBL)
  private floorMat!: THREE.MeshStandardMaterial;
  private outerFloorMat!: THREE.MeshStandardMaterial;
  private wallMat!: THREE.MeshStandardMaterial;
  private rockMat!: THREE.MeshStandardMaterial;
  private darkSlateMat!: THREE.MeshStandardMaterial;
  private marbleMat!: THREE.MeshStandardMaterial;
  private woodMat!: THREE.MeshStandardMaterial;
  private darkWoodMat!: THREE.MeshStandardMaterial;
  private ironMat!: THREE.MeshStandardMaterial;
  private steelMat!: THREE.MeshStandardMaterial;
  private goldMat!: THREE.MeshStandardMaterial;
  private crimsonBannerMat!: THREE.MeshStandardMaterial;
  private volumetricCyanMat!: THREE.MeshBasicMaterial;
  private volumetricWarmMat!: THREE.MeshBasicMaterial;

  // Cached High-Detail Sculpted Enemy Geometries (Built once at startup, 0 runtime allocations)
  private enemyThighGeo = new THREE.CylinderGeometry(0.115, 0.095, 0.42, 10);
  private enemyKneeGeo = new THREE.SphereGeometry(0.105, 8, 8);
  private enemyShinGeo = new THREE.CylinderGeometry(0.095, 0.08, 0.42, 10);
  private enemyBootGeo = new THREE.BoxGeometry(0.18, 0.14, 0.3);

  private enemyPelvisGeo = new THREE.CylinderGeometry(0.25, 0.23, 0.26, 10);
  private enemyTorsoGeo = new THREE.CylinderGeometry(0.34, 0.25, 0.58, 12);
  private enemyHunchGeo = new THREE.SphereGeometry(0.28, 10, 8);
  private enemyStrapGeo = new THREE.BoxGeometry(0.075, 0.64, 0.38);
  private enemyBeltGeo = new THREE.CylinderGeometry(0.265, 0.265, 0.11, 12);
  private enemyBuckleGeo = new THREE.BoxGeometry(0.14, 0.13, 0.06);
  private enemyTassetGeo = new THREE.BoxGeometry(0.2, 0.28, 0.05);

  private enemyPauldronGeo = new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  private enemySpikeGeo = new THREE.ConeGeometry(0.035, 0.14, 6);
  private enemyUpperArmGeo = new THREE.CylinderGeometry(0.095, 0.08, 0.36, 10);
  private enemyForearmGeo = new THREE.CylinderGeometry(0.085, 0.07, 0.36, 10);
  private enemyHandGeo = new THREE.BoxGeometry(0.1, 0.12, 0.08);
  private enemyClawGeo = new THREE.ConeGeometry(0.016, 0.09, 5);

  private enemyHeadGeo = new THREE.SphereGeometry(0.21, 14, 12);
  private enemyJawGeo = new THREE.BoxGeometry(0.22, 0.14, 0.22);
  private enemyBrowGeo = new THREE.BoxGeometry(0.26, 0.065, 0.14);
  private enemyEarGeo = new THREE.ConeGeometry(0.045, 0.16, 5);
  private enemyFangGeo = new THREE.ConeGeometry(0.02, 0.065, 5);
  private enemyHelmetGeo = new THREE.SphereGeometry(0.228, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
  private enemyNoseGuardGeo = new THREE.BoxGeometry(0.035, 0.14, 0.05);
  private enemyEyeGeo = new THREE.SphereGeometry(0.034, 8, 8);
  private enemyEyeHaloGeo = new THREE.PlaneGeometry(0.16, 0.16);

  private enemyCleaverBladeGeo = new THREE.BoxGeometry(0.025, 0.62, 0.14);
  private enemyCleaverTipGeo = new THREE.ConeGeometry(0.08, 0.22, 4);
  private enemyHiltGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8);

  private enemyHpBgGeo = new THREE.PlaneGeometry(0.8, 0.09);
  private enemyHpFillGeo = new THREE.PlaneGeometry(0.76, 0.06);

  private enemyMaterials: Record<
    EnemyType,
    {
      skin: THREE.MeshStandardMaterial;
      armor: THREE.MeshStandardMaterial;
      cloth: THREE.MeshStandardMaterial;
      eye: THREE.MeshBasicMaterial;
      eyeHalo: THREE.MeshBasicMaterial;
    }
  >;
  private bladeMat!: THREE.MeshStandardMaterial;
  private boneMat = new THREE.MeshStandardMaterial({
    color: 0xe2dac6,
    roughness: 0.45,
    metalness: 0.05
  });
  private hpBgMat = new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide });
  private hpFillMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });

  constructor(maxAnisotropy = 8) {
    const aniso = Math.min(maxAnisotropy, 8);

    const floorMaps = this.loadMaps('assets/textures/floor', aniso);
    const wallMaps = this.loadMaps('assets/textures/wall', aniso);
    const rockMaps = this.loadMaps('assets/textures/rock', aniso);
    const woodMaps = this.loadMaps('assets/textures/wood', aniso);

    // Damp cavern cobblestone floor with realistic specular highlights & deep normal relief
    this.floorMat = new THREE.MeshStandardMaterial({
      map: floorMaps.diff,
      normalMap: floorMaps.nor,
      normalScale: new THREE.Vector2(2.2, 2.2),
      roughnessMap: floorMaps.rough,
      roughness: 0.58,
      metalness: 0.18,
      color: 0x9aa8bc
    });

    this.outerFloorMat = new THREE.MeshStandardMaterial({
      map: rockMaps.diff,
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(2.0, 2.0),
      roughnessMap: rockMaps.rough,
      roughness: 0.8,
      metalness: 0.1,
      color: 0x475569
    });

    this.wallMat = new THREE.MeshStandardMaterial({
      map: wallMaps.diff,
      normalMap: wallMaps.nor,
      normalScale: new THREE.Vector2(2.1, 2.1),
      roughnessMap: wallMaps.rough,
      roughness: 0.72,
      metalness: 0.12,
      color: 0x94a3b8
    });

    this.rockMat = new THREE.MeshStandardMaterial({
      map: rockMaps.diff,
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(2.2, 2.2),
      roughnessMap: rockMaps.rough,
      roughness: 0.68,
      metalness: 0.16,
      color: 0x8896ab
    });

    this.darkSlateMat = new THREE.MeshStandardMaterial({
      map: rockMaps.diff,
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughnessMap: rockMaps.rough,
      roughness: 0.52,
      metalness: 0.28,
      color: 0x334155
    });

    this.marbleMat = new THREE.MeshStandardMaterial({
      map: rockMaps.diff,
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: rockMaps.rough,
      roughness: 0.42,
      metalness: 0.22,
      color: 0xdbe4f0
    });

    this.woodMat = new THREE.MeshStandardMaterial({
      map: woodMaps.diff,
      normalMap: woodMaps.nor,
      normalScale: new THREE.Vector2(1.8, 1.8),
      roughnessMap: woodMaps.rough,
      roughness: 0.72,
      metalness: 0.08,
      color: 0xb88b52
    });

    this.darkWoodMat = new THREE.MeshStandardMaterial({
      map: woodMaps.diff,
      normalMap: woodMaps.nor,
      normalScale: new THREE.Vector2(2.0, 2.0),
      roughnessMap: woodMaps.rough,
      roughness: 0.78,
      metalness: 0.1,
      color: 0x5c4028
    });

    this.ironMat = new THREE.MeshStandardMaterial({
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(0.6, 0.6),
      color: 0x3b424c,
      metalness: 0.86,
      roughness: 0.3
    });

    this.steelMat = new THREE.MeshStandardMaterial({
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: 0x94a3b8,
      metalness: 0.92,
      roughness: 0.2
    });

    this.goldMat = new THREE.MeshStandardMaterial({
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(0.4, 0.4),
      color: 0xeab308,
      metalness: 0.88,
      roughness: 0.24
    });

    this.crimsonBannerMat = new THREE.MeshStandardMaterial({
      normalMap: woodMaps.nor,
      normalScale: new THREE.Vector2(0.8, 0.8),
      color: 0x7f1d1d,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.volumetricCyanMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.volumetricWarmMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.bladeMat = new THREE.MeshStandardMaterial({
      normalMap: rockMaps.nor,
      normalScale: new THREE.Vector2(0.5, 0.5),
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.22
    });

    // Normal-mapped organic skin & forged battle armor for enemies (Kino der Toten grit + LOTR lore)
    this.enemyMaterials = {
      goblin: {
        skin: new THREE.MeshStandardMaterial({
          normalMap: rockMaps.nor,
          normalScale: new THREE.Vector2(1.4, 1.4),
          color: 0x4d6338,
          roughness: 0.58,
          metalness: 0.08
        }),
        armor: new THREE.MeshStandardMaterial({
          normalMap: rockMaps.nor,
          normalScale: new THREE.Vector2(1.1, 1.1),
          color: 0x292524,
          roughness: 0.42,
          metalness: 0.68
        }),
        cloth: new THREE.MeshStandardMaterial({
          normalMap: woodMaps.nor,
          normalScale: new THREE.Vector2(1.2, 1.2),
          color: 0x451a03,
          roughness: 0.82
        }),
        eye: new THREE.MeshBasicMaterial({ color: 0xff6600 }),
        eyeHalo: new THREE.MeshBasicMaterial({
          color: 0xff4500,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      },
      orc: {
        skin: new THREE.MeshStandardMaterial({
          normalMap: rockMaps.nor,
          normalScale: new THREE.Vector2(1.6, 1.6),
          color: 0x3f4d34,
          roughness: 0.54,
          metalness: 0.1
        }),
        armor: new THREE.MeshStandardMaterial({
          normalMap: rockMaps.nor,
          normalScale: new THREE.Vector2(1.2, 1.2),
          color: 0x1e242b,
          roughness: 0.36,
          metalness: 0.78
        }),
        cloth: new THREE.MeshStandardMaterial({
          normalMap: woodMaps.nor,
          normalScale: new THREE.Vector2(1.2, 1.2),
          color: 0x3b2f2f,
          roughness: 0.8
        }),
        eye: new THREE.MeshBasicMaterial({ color: 0xff8800 }),
        eyeHalo: new THREE.MeshBasicMaterial({
          color: 0xff5500,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      },
      uruk: {
        skin: new THREE.MeshStandardMaterial({
          normalMap: rockMaps.nor,
          normalScale: new THREE.Vector2(1.8, 1.8),
          color: 0x5c2822,
          roughness: 0.48,
          metalness: 0.12
        }),
        armor: new THREE.MeshStandardMaterial({
          normalMap: rockMaps.nor,
          normalScale: new THREE.Vector2(1.3, 1.3),
          color: 0x18181b,
          roughness: 0.28,
          metalness: 0.88
        }),
        cloth: new THREE.MeshStandardMaterial({
          normalMap: woodMaps.nor,
          normalScale: new THREE.Vector2(1.2, 1.2),
          color: 0x450a0a,
          roughness: 0.78
        }),
        eye: new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
        eyeHalo: new THREE.MeshBasicMaterial({
          color: 0xff8800,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      }
    };
  }

  /**
   * Generates a baked PMREM IBL Environment Map so all PBR materials (wet stone floor,
   * armor, swords, gold trim, weapons) display realistic specular reflections at 0 runtime cost.
   */
  createCavernEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0f172a);

    // Cold cyan skylight dome above
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x1e3a5f, side: THREE.BackSide })
    );
    envScene.add(skyDome);

    const zenithGlow = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    );
    zenithGlow.position.set(0, 16, 0);
    envScene.add(zenithGlow);

    // 4 Warm torchlight reflection cards around the horizon for metallic rim highlights
    const warmMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const card = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), warmMat);
      card.position.set(Math.cos(angle) * 14, 3.5, Math.sin(angle) * 14);
      envScene.add(card);

      const winCard = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 8), cyanMat);
      const wAngle = (i * Math.PI) / 2;
      winCard.position.set(Math.cos(wAngle) * 16, 2.5, Math.sin(wAngle) * 16);
      envScene.add(winCard);
    }

    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    pmremGenerator.dispose();
    return envMap;
  }

  private loadMaps(basePath: string, aniso: number): {
    diff: THREE.Texture;
    nor: THREE.Texture;
    rough: THREE.Texture;
  } {
    const diff = this.loader.load(`${basePath}_diff.jpg`);
    const nor = this.loader.load(`${basePath}_nor.jpg`);
    const rough = this.loader.load(`${basePath}_rough.jpg`);

    diff.colorSpace = THREE.SRGBColorSpace;
    [diff, nor, rough].forEach((t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = aniso;
    });

    return { diff, nor, rough };
  }

  private scaleUVs(geo: THREE.BufferGeometry, uScale: number, vScale: number): THREE.BufferGeometry {
    const uvAttr = geo.attributes['uv'];
    if (uvAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        uvAttr.setXY(i, uvAttr.getX(i) * uScale, uvAttr.getY(i) * vScale);
      }
      uvAttr.needsUpdate = true;
    }
    return geo;
  }

  private doorRigs = new Map<
    DoorId,
    { left: THREE.Object3D; right: THREE.Object3D; seal: THREE.Object3D }
  >();

  /**
   * Opens or closes any buyable Dwarven double door in the map by its DoorId.
   */
  setDoorOpen(doorId: DoorId, isOpen: boolean): void {
    const rig = this.doorRigs.get(doorId);
    if (!rig) return;
    rig.left.rotation.y = isOpen ? -Math.PI * 0.48 : 0;
    rig.right.rotation.y = isOpen ? Math.PI * 0.48 : 0;
    rig.seal.visible = !isOpen;
  }

  /**
   * Opens or closes all 6 buyable Dwarven doors at once.
   */
  setAllDoorsOpen(isOpen: boolean): void {
    const allIds: DoorId[] = [
      'door_zone_2',
      'door_zone_3_north',
      'door_zone_3_south',
      'door_zone_4_north',
      'door_zone_4_south',
      'door_zone_5'
    ];
    allIds.forEach((id) => this.setDoorOpen(id, isOpen));
  }

  /**
   * Backwards-compatible helper for Zone 2 main door.
   */
  setZone2DoorOpen(isOpen: boolean): void {
    this.setDoorOpen('door_zone_2', isOpen);
  }

  /**
   * Exact, continuous piecewise elevation lookup across all 5 rooms and 8 staircases.
   * Ensures 100% deterministic floor height for the player, enemies, barricades & drops.
   */
  getFloorHeightAt(x: number, z: number): number {
    // 1. WEST WING (Zone 3: Galería Real de Durin at y = +2.8m & West Staircases)
    if (x < -14.0) {
      if (x <= -21.2) {
        return 2.8;
      }
      if (z < 0.5) {
        // North-West Ascending Staircase (Zone 1 y=0.0 -> Zone 3 y=+2.8)
        const t = THREE.MathUtils.clamp((-14.6 - x) / (-14.6 - -21.2), 0, 1);
        return t * 2.8;
      }
      if (z < 20.0) {
        // Outside spawn ledge for Window #2 (Zone 1 West Wall)
        return 0.0;
      }
      if (z <= 36.5) {
        // South-West Staircase (Zone 2 y=-1.2 <-> Zone 3 y=+2.8, 4m vertical drop!)
        const t = THREE.MathUtils.clamp((-14.6 - x) / (-14.6 - -21.2), 0, 1);
        return -1.2 + t * 4.0;
      }
      // Outside spawn ledge for Window #4 (Zone 2 West Wall)
      return -1.2;
    }

    // 2. EAST WING (Zone 4: Minas Profundas de Mithril at y = -2.6m & East Staircases)
    if (x > 14.0) {
      if (x >= 21.2) {
        return -2.6;
      }
      if (z < 0.5) {
        // North-East Descending Staircase (Zone 1 y=0.0 -> Zone 4 y=-2.6)
        const t = THREE.MathUtils.clamp((x - 14.6) / (21.2 - 14.6), 0, 1);
        return t * -2.6;
      }
      if (z < 20.0) {
        // Outside spawn ledge for Window #3 (Zone 1 East Wall)
        return 0.0;
      }
      if (z <= 36.5) {
        // South-East Staircase (Zone 2 y=-1.2 <-> Zone 4 y=-2.6)
        const t = THREE.MathUtils.clamp((x - 14.6) / (21.2 - 14.6), 0, 1);
        return -1.2 + t * -1.4;
      }
      // Outside spawn ledge for Window #5 (Zone 2 East Wall)
      return -1.2;
    }

    // 3. CENTRAL SPINE (Zone 1 -> Miners' Tunnel -> Zone 2 -> Abyssal Bridge & Zone 5)
    if (z <= -9.0) {
      return 1.2; // Zone 1 North Elevated Sanctum (Estrado de los Archivos)
    }
    if (z < -6.2) {
      // Zone 1 Twin North Staircases (y: 0.0 -> +1.2)
      const t = THREE.MathUtils.clamp((-6.2 - z) / (-6.2 - -9.0), 0, 1);
      return t * 1.2;
    }
    if (z <= 15.2) {
      return 0.0; // Zone 1 Main Floor (Cámara de Mazarbul)
    }
    if (z < 24.8) {
      // Central Miners' Tunnel Descending Staircase (y: 0.0 -> -1.2)
      const t = THREE.MathUtils.clamp((z - 15.2) / (24.8 - 15.2), 0, 1);
      return t * -1.2;
    }
    if (z <= 44.6) {
      return -1.2; // Zone 2 Main Hall (Sala de los Pilares)
    }
    if (z < 47.8) {
      // Zone 2 Twin South Gallery Staircases (y: -1.2 -> +0.2)
      const t = THREE.MathUtils.clamp((z - 44.6) / (47.8 - 44.6), 0, 1);
      return -1.2 + t * 1.4;
    }
    if (z <= 54.8) {
      return 0.2; // Zone 2 South Elevated Gallery
    }
    if (z < 61.2) {
      // Zone 5 Abyssal Staircase (y: +0.2 -> -2.4)
      const t = THREE.MathUtils.clamp((z - 54.8) / (61.2 - 54.8), 0, 1);
      return 0.2 + t * -2.6;
    }
    return -2.4; // Zone 5: Puente de Khazad-dûm & Santuario de Celebrimbor
  }

  /**
   * Returns human-readable tactical telemetry for the player's current room and floor level.
   */
  getRoomInfoAt(
    x: number,
    z: number
  ): { roomId: number; name: string; floorLabel: string; elevation: number } {
    const elevation = Number(this.getFloorHeightAt(x, z).toFixed(1));
    if (x < -14.2) {
      return {
        roomId: 3,
        name: 'SALA III · GALERÍA REAL DE DURIN',
        floorLabel: 'PISO SUPERIOR (+2.8m)',
        elevation
      };
    }
    if (x > 14.2) {
      return {
        roomId: 4,
        name: 'SALA IV · MINAS PROFUNDAS DE MITHRIL',
        floorLabel: 'SUBSUELO (-2.6m)',
        elevation
      };
    }
    if (z < 14.2) {
      return {
        roomId: 1,
        name: z < -7.5 ? 'SALA I · ESTRADO DE LOS ARCHIVOS' : 'SALA I · CÁMARA DE MAZARBUL',
        floorLabel: z < -7.5 ? 'TERRAZA NORTE (+1.2m)' : 'NIVEL BASE (0.0m)',
        elevation
      };
    }
    if (z < 25.8) {
      return {
        roomId: 2,
        name: 'PASADIZO DE LOS MINEROS',
        floorLabel: 'ESCALERAS EN DESCENSO',
        elevation
      };
    }
    if (z <= 54.2) {
      return {
        roomId: 2,
        name: z > 46.2 ? 'SALA II · BALCÓN DEL ABISMO' : 'SALA II · SALA DE LOS PILARES',
        floorLabel: z > 46.2 ? 'GALERÍA SUR (+0.2m)' : 'NIVEL INFERIOR (-1.2m)',
        elevation
      };
    }
    return {
      roomId: 5,
      name: z < 67.5 ? 'SALA V · PUENTE DE KHAZAD-DÛM' : 'SALA V · FORJA DE CELEBRIMBOR',
      floorLabel: 'ABISMO DE FUEGO (-2.4m)',
      elevation
    };
  }

  // ===========================================================================
  // BUILD FULL MULTI-ROOM, MULTI-LEVEL MORIA MAP (5 ROOMS, 8 STAIRCASES, 6 DOORS)
  // ===========================================================================
  buildZoneOne(
    scene: THREE.Scene,
    perksCatalog: Record<PerkId, PerkInfo>
  ): ZoneOneBuildResult {
    this.doorRigs.clear();
    const windows: BarricadeWindow[] = [];
    const interactables: InteractableItem[] = [];
    const obstacles: THREE.Box3[] = [];
    const torchLights: THREE.PointLight[] = [];
    const torchFlames: THREE.Object3D[] = [];

    const addObstacle = (x: number, z: number, w: number, d: number) => {
      obstacles.push(
        new THREE.Box3(
          new THREE.Vector3(x - w / 2, -10, z - d / 2),
          new THREE.Vector3(x + w / 2, 10, z + d / 2)
        )
      );
    };

    // Deep Subterranean Abyss Bedrock Floor far below all rooms (y = -5.6m)
    const deepAbyssFloor = new THREE.Mesh(
      this.scaleUVs(new THREE.PlaneGeometry(140, 150), 34, 36),
      this.outerFloorMat
    );
    deepAbyssFloor.rotation.x = -Math.PI / 2;
    deepAbyssFloor.position.set(0, -5.6, 28);
    scene.add(deepAbyssFloor);

    // =========================================================================
    // ROOM 1: CÁMARA DE MAZARBUL (y = 0.0m + North Sanctum Terrace at y = +1.2m)
    // =========================================================================
    this.buildRoomOneMazarbul(
      scene,
      perksCatalog,
      windows,
      interactables,
      addObstacle,
      torchLights,
      torchFlames
    );

    // =========================================================================
    // CENTRAL DESCENDING TUNNEL & ROOM 2: GRAN SALA DE LOS PILARES (y = -1.2m & +0.2m)
    // =========================================================================
    this.buildCentralTunnelAndRoomTwo(
      scene,
      perksCatalog,
      windows,
      interactables,
      addObstacle,
      torchLights,
      torchFlames
    );

    // =========================================================================
    // ROOM 3 (WEST WING — UPPER FLOOR y = +2.8m): GALERÍA REAL DE DURIN
    // =========================================================================
    this.buildRoomThreeWestRoyalGallery(
      scene,
      perksCatalog,
      windows,
      interactables,
      addObstacle,
      torchLights,
      torchFlames
    );

    // =========================================================================
    // ROOM 4 (EAST WING — SUBTERRANEAN FLOOR y = -2.6m): MINAS PROFUNDAS DE MITHRIL
    // =========================================================================
    this.buildRoomFourEastDeepMines(
      scene,
      perksCatalog,
      windows,
      interactables,
      addObstacle,
      torchLights,
      torchFlames
    );

    // =========================================================================
    // ROOM 5 (SOUTH ABYSS — FLOOR y = -2.4m): PUENTE DE KHAZAD-DÛM & FORJA
    // =========================================================================
    this.buildRoomFiveAbyssalForge(
      scene,
      windows,
      interactables,
      addObstacle,
      torchLights,
      torchFlames
    );

    // Atmospheric Dust Motes across the caverns
    const dustParticles = this.buildDustMotes(scene);

    return {
      windows,
      interactables,
      obstacles,
      torchLights,
      torchFlames,
      dustParticles
    };
  }

  // ===========================================================================
  // ROOM 1 BUILDER: CÁMARA DE MAZARBUL (Multi-Level Spawn + Tactical Islands)
  // ===========================================================================
  private buildRoomOneMazarbul(
    scene: THREE.Scene,
    perksCatalog: Record<PerkId, PerkInfo>,
    windows: BarricadeWindow[],
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void,
    torchLights: THREE.PointLight[],
    torchFlames: THREE.Object3D[]
  ): void {
    // 1A. Main Lower Floor (x: -14..14, z: -6.2..14, y = 0.0m)
    const mainFloor = new THREE.Mesh(
      this.scaleUVs(new THREE.PlaneGeometry(28, 20.2), 10, 7),
      this.floorMat
    );
    mainFloor.rotation.x = -Math.PI / 2;
    mainFloor.position.set(0, 0, 3.9);
    mainFloor.receiveShadow = true;
    scene.add(mainFloor);

    // 1B. North Elevated Sanctum Platform (x: -14..14, z: -14..-9.0, y = +1.2m)
    const northSanctumSlab = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(28, 1.2, 5.0), 10, 2),
      this.floorMat
    );
    northSanctumSlab.position.set(0, 0.6, -11.5);
    northSanctumSlab.receiveShadow = true;
    scene.add(northSanctumSlab);

    // Retaining Wall Blocks between z = -9.0 and z = -6.2 (leaving two 5.2m wide staircases!)
    const buildRetainingSection = (cx: number, width: number) => {
      const block = new THREE.Mesh(
        this.scaleUVs(new THREE.BoxGeometry(width, 1.2, 2.8), Math.max(1, width / 2.5), 1),
        this.darkSlateMat
      );
      block.position.set(cx, 0.6, -7.6);
      scene.add(block);

      // Balustrade parapet on top of the retaining wall so players must use the stairs
      const parapet = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.1, 0.85, 0.36),
        this.rockMat
      );
      parapet.position.set(cx, 1.62, -6.4);
      const goldRail = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.1, 0.44),
        this.goldMat
      );
      goldRail.position.set(cx, 2.08, -6.4);
      scene.add(parapet, goldRail);

      addObstacle(cx, -7.6, width, 2.6);
    };

    // Center retaining wall (between Left & Right North Stairs) + Outer flanks
    buildRetainingSection(0, 9.6);
    buildRetainingSection(-12.0, 4.0);
    buildRetainingSection(12.0, 4.0);

    // Twin North Staircases going UP (z: -6.2 at y=0.0 -> z: -9.0 at y=+1.2)
    this.buildStoneStaircase(scene, {
      startX: -7.4,
      startY: 0.0,
      startZ: -6.2,
      endX: -7.4,
      endY: 1.2,
      endZ: -9.0,
      width: 5.0,
      steps: 8,
      withSideRails: false
    });
    this.buildStoneStaircase(scene, {
      startX: 7.4,
      startY: 0.0,
      startZ: -6.2,
      endX: 7.4,
      endY: 1.2,
      endZ: -9.0,
      width: 5.0,
      steps: 8,
      withSideRails: false
    });

    // Detailed Floor Architecture &Vaulted Ceiling
    this.buildDetailedFloorArchitecture(scene);
    this.buildVaultedCeiling(scene);

    // Perimeter Walls of Room 1:
    // South Wall (z = +14, y = 0): Doorway `door_zone_2` (1250 pts) to Zone 2
    this.buildZoneOneSouthGatewayWall(
      scene,
      interactables,
      'door_zone_2',
      'Puerta de Khazad-dûm (Sala de los Pilares)',
      1250,
      2,
      new THREE.Vector3(0, 0, 14)
    );

    // North Wall (z = -14, elevated at y = +1.2m): Barricade Window #1
    this.buildWallSideWithArchWindow(
      scene,
      1,
      new THREE.Vector3(0, 1.2, -14),
      Math.PI,
      new THREE.Vector3(0, 1.2, -20.5),
      new THREE.Vector3(0, 1.2, -11.6),
      windows,
      interactables,
      1
    );

    // West Wall (x = -14, y = 0): Door `door_zone_3_north` (z = -3.5) + Window #2 (z = +5.2)
    this.buildSideWallWithDoorAndWindow(scene, {
      wallX: -14.0,
      baseY: 0.0,
      zMin: -14.0,
      zMax: 14.0,
      isWest: true,
      doorId: 'door_zone_3_north',
      doorTitle: 'Escalinata Real (Galería de Durin · Piso +1)',
      doorCost: 1000,
      roomIdUnlocked: 3,
      doorCenterZ: -3.5,
      windowId: 2,
      windowCenterZ: 5.2,
      roomId: 1,
      windows,
      interactables
    });

    // East Wall (x = +14, y = 0): Door `door_zone_4_north` (z = -3.5) + Window #3 (z = +5.2)
    this.buildSideWallWithDoorAndWindow(scene, {
      wallX: 14.0,
      baseY: 0.0,
      zMin: -14.0,
      zMax: 14.0,
      isWest: false,
      doorId: 'door_zone_4_north',
      doorTitle: 'Túnel de Extracción (Minas Profundas · Piso -1)',
      doorCost: 1000,
      roomIdUnlocked: 4,
      doorCenterZ: -3.5,
      windowId: 3,
      windowCenterZ: 5.2,
      roomId: 1,
      windows,
      interactables
    });

    // 4 Monumental Columns in Room 1
    const pillarPositions = [
      new THREE.Vector3(-6.8, 0, -1.8),
      new THREE.Vector3(6.8, 0, -1.8),
      new THREE.Vector3(-6.8, 0, 7.6),
      new THREE.Vector3(6.8, 0, 7.6)
    ];
    pillarPositions.forEach((pos, idx) => {
      this.buildOctagonalColumn(scene, pos.x, 0, pos.z);
      addObstacle(pos.x, pos.z, 2.0, 2.0);

      const inwardX = pos.x + (pos.x < 0 ? 0.98 : -0.98);
      const inwardZ = pos.z + (pos.z < 2.9 ? 0.98 : -0.98);
      this.buildIronTorchBrazier(
        scene,
        inwardX,
        3.1,
        inwardZ,
        idx === 0 || idx === 3,
        torchLights,
        torchFlames
      );
    });

    // Braziers on the North Elevated Sanctum overlooking the room
    this.buildIronTorchBrazier(scene, -4.4, 2.8, -6.4, false, torchLights, torchFlames);
    this.buildIronTorchBrazier(scene, 4.4, 2.8, -6.4, false, torchLights, torchFlames);

    // Centerpiece: Balin's Tomb shifted to (0, 0, 2.8) + Tactical Cover Islands (CoD Zombies Split Lanes!)
    this.buildBalinsTomb(scene, 0, 0, 2.8);
    addObstacle(0, 2.8, 3.6, 2.2);

    // Tactical Dwarven Barricade Walls & Overturned Minecarts flanking the center (Forces dynamic lane weaving!)
    this.buildTacticalBarricadeIsland(scene, -3.6, 0, 2.8, 1.3, 4.2, addObstacle);
    this.buildTacticalBarricadeIsland(scene, 3.6, 0, 2.8, 1.3, 4.2, addObstacle);
    this.buildOverturnedMinecartAndRubble(scene, -10.5, 0, 1.2, 0.35, addObstacle);
    this.buildOverturnedMinecartAndRubble(scene, 10.5, 0, 9.6, -0.42, addObstacle);

    // Environmental Props (Collapsed rafters, barrels, boulders)
    this.buildEnvironmentalProps(scene, addObstacle);

    // Stations in Room 1 (Starter Wall Weapon & Juggernog on the North Elevated Sanctum!)
    this.buildDetailedWallWeaponRack(
      scene,
      'wall_crossbow',
      'erebor_crossbow',
      'Ballesta de Erebor',
      500,
      250,
      new THREE.Vector3(-9.2, 2.95, -13.38),
      0,
      0xf59e0b,
      interactables
    );

    this.buildPerkShrine(
      scene,
      'beorn_mead',
      perksCatalog.beorn_mead,
      new THREE.Vector3(10.6, 1.2, -11.8),
      -Math.PI / 5,
      0xef4444,
      interactables,
      addObstacle
    );
  }

  // ===========================================================================
  // CENTRAL DESCENDING TUNNEL & ROOM 2: GRAN SALA DE LOS PILARES (y = -1.2m & +0.2m)
  // ===========================================================================
  private buildCentralTunnelAndRoomTwo(
    scene: THREE.Scene,
    perksCatalog: Record<PerkId, PerkInfo>,
    windows: BarricadeWindow[],
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void,
    torchLights: THREE.PointLight[],
    torchFlames: THREE.Object3D[]
  ): void {
    // 1. CONNECTING MINERS' TUNNEL WITH DESCENDING STAIRS (z = 14..26, y = 0.0 -> -1.2m)
    const landingNorth = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(4.8, 0.4, 1.4), 2, 1),
      this.floorMat
    );
    landingNorth.position.set(0, -0.2, 14.6);
    const landingSouth = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(4.8, 0.4, 1.4), 2, 1),
      this.floorMat
    );
    landingSouth.position.set(0, -1.4, 25.4);
    scene.add(landingNorth, landingSouth);

    this.buildStoneStaircase(scene, {
      startX: 0,
      startY: 0.0,
      startZ: 15.2,
      endX: 0,
      endY: -1.2,
      endZ: 24.8,
      width: 4.6,
      steps: 14,
      withSideRails: false,
      enclosedHeight: 5.0
    });

    this.buildIronTorchBrazier(scene, -1.95, 2.2, 20.0, true, torchLights, torchFlames);
    this.buildIronTorchBrazier(scene, 1.95, 2.2, 20.0, false, torchLights, torchFlames);

    // 2. ROOM 2 MAIN LOWER HALL FLOOR (x: -14..14, z: 26.0..44.6, y = -1.2m)
    const z2LowerFloor = new THREE.Mesh(
      this.scaleUVs(new THREE.PlaneGeometry(28, 18.8), 10, 7),
      this.floorMat
    );
    z2LowerFloor.rotation.x = -Math.PI / 2;
    z2LowerFloor.position.set(0, -1.2, 35.3);
    z2LowerFloor.receiveShadow = true;
    scene.add(z2LowerFloor);

    // 3. ROOM 2 SOUTH ELEVATED GALLERY (x: -14..14, z: 47.8..54.0, y = +0.2m)
    const z2SouthGallery = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(28, 1.4, 6.2), 10, 2.5),
      this.floorMat
    );
    z2SouthGallery.position.set(0, -0.5, 50.9);
    z2SouthGallery.receiveShadow = true;
    scene.add(z2SouthGallery);

    // Retaining Wall between z = 44.6 and z = 47.8 (Center + Outer Caps)
    const buildZ2Retaining = (cx: number, width: number) => {
      const wall = new THREE.Mesh(
        this.scaleUVs(new THREE.BoxGeometry(width, 1.4, 3.2), Math.max(1, width / 2.5), 1),
        this.darkSlateMat
      );
      wall.position.set(cx, -0.5, 46.2);
      const parapet = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.1, 0.85, 0.36),
        this.rockMat
      );
      parapet.position.set(cx, 0.62, 44.8);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.44), this.goldMat);
      rail.position.set(cx, 1.08, 44.8);
      scene.add(wall, parapet, rail);
      addObstacle(cx, 46.2, width, 3.0);
    };
    buildZ2Retaining(0, 12.8);
    buildZ2Retaining(-12.85, 2.3);
    buildZ2Retaining(12.85, 2.3);

    // Twin Side Staircases Going UP to the South Gallery (z: 44.6 at y=-1.2 -> z: 47.8 at y=+0.2)
    this.buildStoneStaircase(scene, {
      startX: -9.1,
      startY: -1.2,
      startZ: 44.6,
      endX: -9.1,
      endY: 0.2,
      endZ: 47.8,
      width: 5.0,
      steps: 9,
      withSideRails: false
    });
    this.buildStoneStaircase(scene, {
      startX: 9.1,
      startY: -1.2,
      startZ: 44.6,
      endX: 9.1,
      endY: 0.2,
      endZ: 47.8,
      width: 5.0,
      steps: 9,
      withSideRails: false
    });

    // Room 2 Ceiling & Skylight
    const z2Ceiling = new THREE.Mesh(
      this.scaleUVs(new THREE.PlaneGeometry(28, 28), 7, 7),
      this.rockMat
    );
    z2Ceiling.rotation.x = Math.PI / 2;
    z2Ceiling.position.set(0, 8.2, 40.0);
    const z2Oculus = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.36, 8, 20), this.goldMat);
    z2Oculus.rotation.x = Math.PI / 2;
    z2Oculus.position.set(0, 8.0, 35.5);
    const z2GodRay = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 4.8, 9.4, 18, 1, true),
      this.volumetricCyanMat
    );
    z2GodRay.position.set(0, 3.5, 35.5);
    scene.add(z2Ceiling, z2Oculus, z2GodRay);

    // Room 2 North Wall (z = 26.0, base y = -1.2m, with opening for Tunnel)
    const z2NorthWallGroup = new THREE.Group();
    z2NorthWallGroup.position.set(0, -1.2, 26.0);
    const z2NorthSideGeo = this.scaleUVs(new THREE.BoxGeometry(11.6, 9.4, 0.85), 4, 3);
    [-8.2, 8.2].forEach((nx) => {
      const wMesh = new THREE.Mesh(z2NorthSideGeo, this.wallMat);
      wMesh.position.set(nx, 4.7, 0);
      z2NorthWallGroup.add(wMesh);
    });
    const z2NorthUpper = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(4.8, 4.4, 0.85), 2, 1.5),
      this.wallMat
    );
    z2NorthUpper.position.set(0, 7.2, 0);
    const z2NorthArch = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 1.2), this.darkSlateMat);
    z2NorthArch.position.set(0, 4.85, 0.15);
    z2NorthWallGroup.add(z2NorthUpper, z2NorthArch);
    scene.add(z2NorthWallGroup);

    // Room 2 West Wall (x = -14, y = -1.2): Door `door_zone_3_south` (z = 32) + Window #4 (z = 40.5)
    this.buildSideWallWithDoorAndWindow(scene, {
      wallX: -14.0,
      baseY: -1.2,
      zMin: 26.0,
      zMax: 54.0,
      isWest: true,
      doorId: 'door_zone_3_south',
      doorTitle: 'Escalinata Sur (Galería Real · Piso +1)',
      doorCost: 1000,
      roomIdUnlocked: 3,
      doorCenterZ: 32.0,
      windowId: 4,
      windowCenterZ: 40.5,
      roomId: 2,
      windows,
      interactables
    });

    // Room 2 East Wall (x = +14, y = -1.2): Door `door_zone_4_south` (z = 32) + Window #5 (z = 40.5)
    this.buildSideWallWithDoorAndWindow(scene, {
      wallX: 14.0,
      baseY: -1.2,
      zMin: 26.0,
      zMax: 54.0,
      isWest: false,
      doorId: 'door_zone_4_south',
      doorTitle: 'Rampa de Fundición (Minas Profundas · Piso -1)',
      doorCost: 1000,
      roomIdUnlocked: 4,
      doorCenterZ: 32.0,
      windowId: 5,
      windowCenterZ: 40.5,
      roomId: 2,
      windows,
      interactables
    });

    // Room 2 South Wall on the Elevated Gallery (z = 54.0, y = +0.2m): Door `door_zone_5` (1750 pts) to Zone 5!
    this.buildZoneOneSouthGatewayWall(
      scene,
      interactables,
      'door_zone_5',
      'Puerta del Abismo (Puente de Khazad-dûm y Forja)',
      1750,
      5,
      new THREE.Vector3(0, 0.2, 54.0)
    );

    // 4 Monumental Pillars of Khazad-dûm inside Room 2 (y = -1.2m)
    const z2Pillars = [
      new THREE.Vector3(-7.6, -1.2, 30.2),
      new THREE.Vector3(7.6, -1.2, 30.2),
      new THREE.Vector3(-7.6, -1.2, 40.8),
      new THREE.Vector3(7.6, -1.2, 40.8)
    ];
    z2Pillars.forEach((pos, idx) => {
      this.buildOctagonalColumn(scene, pos.x, pos.y, pos.z);
      addObstacle(pos.x, pos.z, 2.0, 2.0);
      this.buildIronTorchBrazier(
        scene,
        pos.x + (pos.x < 0 ? 0.98 : -0.98),
        pos.y + 3.1,
        pos.z,
        idx === 1 || idx === 2,
        torchLights,
        torchFlames
      );
    });

    // Room 2 Centerpiece: El Altar de Mithril de Durin + Flanking Tactical Ruins (Split Lanes!)
    const shrineGroup = new THREE.Group();
    shrineGroup.position.set(0, -1.2, 35.5);
    const dais1 = new THREE.Mesh(
      this.scaleUVs(new THREE.CylinderGeometry(2.1, 2.35, 0.35, 8), 2, 0.5),
      this.darkSlateMat
    );
    dais1.position.y = 0.175;
    const dais2 = new THREE.Mesh(
      this.scaleUVs(new THREE.CylinderGeometry(1.45, 1.7, 0.55, 8), 2, 0.5),
      this.rockMat
    );
    dais2.position.y = 0.62;
    const mithrilCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.68, 1),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
    );
    mithrilCrystal.scale.set(0.85, 1.65, 0.85);
    mithrilCrystal.position.y = 1.95;
    const mithrilRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.06, 8, 20),
      this.goldMat
    );
    mithrilRing.rotation.x = Math.PI / 3;
    mithrilRing.position.y = 1.95;
    shrineGroup.add(dais1, dais2, mithrilCrystal, mithrilRing);
    scene.add(shrineGroup);
    addObstacle(0, 35.5, 3.2, 3.2);

    // Flanking Ruined Colonnade Walls in Room 2 (Creates 3 parallel lanes like the reference map!)
    this.buildTacticalBarricadeIsland(scene, -4.4, -1.2, 35.5, 1.2, 5.2, addObstacle);
    this.buildTacticalBarricadeIsland(scene, 4.4, -1.2, 35.5, 1.2, 5.2, addObstacle);

    // Glowing Lava Fissure Trench in front of the South Retaining Wall (Visual detail!)
    const fissureRim = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.08, 1.1),
      this.darkSlateMat
    );
    fissureRim.position.set(0, -1.16, 43.8);
    const fissureGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.6, 0.65),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    fissureGlow.rotation.x = -Math.PI / 2;
    fissureGlow.position.set(0, -1.11, 43.8);
    scene.add(fissureRim, fissureGlow);

    // Stations in Room 2:
    // 1. Repetidora de Mithril (1400 pts) on North-East Wall (y = -1.2m)
    this.buildDetailedWallWeaponRack(
      scene,
      'wall_mithril_repeater',
      'mithril_repeater',
      'Repetidora de Mithril',
      1400,
      700,
      new THREE.Vector3(7.6, 0.55, 26.52),
      0,
      0x67e8f9,
      interactables
    );

    // 2. Perk: Luz de Eärendil / Stamin-Up (1500 pts) on the South Elevated Gallery (y = +0.2m)
    this.buildPerkShrine(
      scene,
      'earendil_light',
      perksCatalog.earendil_light,
      new THREE.Vector3(-9.8, 0.2, 52.0),
      Math.PI / 6,
      0x38bdf8,
      interactables,
      addObstacle
    );
  }

  // ===========================================================================
  // ROOM 3 BUILDER (WEST WING — UPPER FLOOR y = +2.8m): GALERÍA REAL DE DURIN
  // ===========================================================================
  private buildRoomThreeWestRoyalGallery(
    scene: THREE.Scene,
    perksCatalog: Record<PerkId, PerkInfo>,
    windows: BarricadeWindow[],
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void,
    torchLights: THREE.PointLight[],
    torchFlames: THREE.Object3D[]
  ): void {
    const y3 = 2.8;

    // 1. North-West Staircase Going UP (x: -14.6 at y=0.0 -> x: -21.2 at y=+2.8, z = -3.5)
    this.buildStoneStaircase(scene, {
      startX: -14.6,
      startY: 0.0,
      startZ: -3.5,
      endX: -21.2,
      endY: y3,
      endZ: -3.5,
      width: 4.4,
      steps: 14,
      withSideRails: true,
      enclosedHeight: 4.8
    });

    // 2. South-West Staircase Going DOWN (x: -21.2 at y=+2.8 -> x: -14.6 at y=-1.2, z = 32.0)
    this.buildStoneStaircase(scene, {
      startX: -21.2,
      startY: y3,
      startZ: 32.0,
      endX: -14.6,
      endY: -1.2,
      endZ: 32.0,
      width: 4.4,
      steps: 18,
      withSideRails: true,
      enclosedHeight: 5.0
    });

    // 3. Room 3 Main Elevated Floor (x: -35..-22, z: -8.5..36.5, y = +2.8m)
    const r3Floor = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(13.2, 0.5, 45.0), 5, 16),
      this.floorMat
    );
    r3Floor.position.set(-28.5, y3 - 0.25, 14.0);
    r3Floor.receiveShadow = true;

    const r3Ceiling = new THREE.Mesh(
      this.scaleUVs(new THREE.PlaneGeometry(13.2, 45.0), 4, 14),
      this.rockMat
    );
    r3Ceiling.rotation.x = Math.PI / 2;
    r3Ceiling.position.set(-28.5, y3 + 6.8, 14.0);
    scene.add(r3Floor, r3Ceiling);

    // North & South End Walls of Room 3
    const endWallGeo = this.scaleUVs(new THREE.BoxGeometry(13.2, 7.0, 0.75), 4, 2.5);
    const northWall = new THREE.Mesh(endWallGeo, this.wallMat);
    northWall.position.set(-28.5, y3 + 3.5, -8.5);
    const southWall = new THREE.Mesh(endWallGeo, this.wallMat);
    southWall.position.set(-28.5, y3 + 3.5, 36.5);
    scene.add(northWall, southWall);

    // East Inner Wall of Room 3 (x = -22.0, segmented around the two staircase openings at z=-3.5 and z=32.0)
    this.buildSegmentedCorridorWall(
      scene,
      -22.0,
      y3,
      7.0,
      -8.5,
      36.5,
      [
        { min: -5.7, max: -1.3 },
        { min: 29.8, max: 34.2 }
      ]
    );

    // West Outer Wall of Room 3 (x = -35.0) with 2 Barricade Windows (#6 at z = 2.5, #7 at z = 24.5)
    this.buildSegmentedCorridorWall(
      scene,
      -35.0,
      y3,
      7.0,
      -8.5,
      36.5,
      [
        { min: 0.3, max: 4.7 },
        { min: 22.3, max: 26.7 }
      ]
    );
    this.buildCompactArchWindow(
      scene,
      6,
      new THREE.Vector3(-35.0, y3, 2.5),
      Math.PI / 2,
      new THREE.Vector3(-41.0, y3, 2.5),
      new THREE.Vector3(-32.6, y3, 2.5),
      windows,
      interactables,
      3
    );
    this.buildCompactArchWindow(
      scene,
      7,
      new THREE.Vector3(-35.0, y3, 24.5),
      Math.PI / 2,
      new THREE.Vector3(-41.0, y3, 24.5),
      new THREE.Vector3(-32.6, y3, 24.5),
      windows,
      interactables,
      3
    );

    // Central Sunken Lightwell / Chasm Bridge in the middle of Room 3 (x = -28.5, z = 11..17)
    // Forces players & zombies onto the Left (x = -32.2) or Right (x = -24.8) catwalks!
    const chasmRim = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(3.4, 1.05, 6.8), 2, 3),
      this.darkSlateMat
    );
    chasmRim.position.set(-28.5, y3 + 0.52, 14.0);
    const chasmGoldTrim = new THREE.Mesh(
      new THREE.BoxGeometry(3.52, 0.12, 6.92),
      this.goldMat
    );
    chasmGoldTrim.position.set(-28.5, y3 + 1.08, 14.0);
    const chasmRay = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.6, 6.8, 12, 1, true),
      this.volumetricCyanMat
    );
    chasmRay.position.set(-28.5, y3 + 3.4, 14.0);
    scene.add(chasmRim, chasmGoldTrim, chasmRay);
    addObstacle(-28.5, 14.0, 3.4, 6.8);

    // Royal Dwarven War Table in the North Chamber (-28.5, y3, 1.5)
    const tableBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 3.2),
      this.darkSlateMat
    );
    tableBase.position.set(-28.5, y3 + 0.45, 1.5);
    const tableMap = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.12, 3.4),
      this.marbleMat
    );
    tableMap.position.set(-28.5, y3 + 0.95, 1.5);
    const tableHolo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 2.8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
    );
    tableHolo.rotation.x = -Math.PI / 2;
    tableHolo.position.set(-28.5, y3 + 1.02, 1.5);
    scene.add(tableBase, tableMap, tableHolo);
    addObstacle(-28.5, 1.5, 2.4, 3.4);

    // South Guardhouse Pillar Cover (-28.5, y3, 25.5)
    this.buildOctagonalColumn(scene, -28.5, y3, 25.5);
    addObstacle(-28.5, 25.5, 2.0, 2.0);

    // Torches in Room 3
    this.buildIronTorchBrazier(scene, -23.0, y3 + 2.8, 4.0, true, torchLights, torchFlames);
    this.buildIronTorchBrazier(scene, -23.0, y3 + 2.8, 23.0, false, torchLights, torchFlames);

    // Stations in Room 3:
    // 1. Perk: Pan de Lembas / Speed Cola (1500 pts) at North End (-28.5, 2.8, -6.8)
    this.buildPerkShrine(
      scene,
      'lembas_bread',
      perksCatalog.lembas_bread,
      new THREE.Vector3(-28.5, y3, -6.8),
      0,
      0x22c55e,
      interactables,
      addObstacle
    );

    // 2. Wall Weapon: Bastón de Anor (1250 pts) at East Inner Wall (-22.45, y3 + 1.75, 14.0)
    this.buildDetailedWallWeaponRack(
      scene,
      'wall_staff',
      'anor_staff',
      'Bastón de Anor',
      1250,
      600,
      new THREE.Vector3(-22.45, y3 + 1.75, 14.0),
      -Math.PI / 2,
      0xef4444,
      interactables
    );
  }

  // ===========================================================================
  // ROOM 4 BUILDER (EAST WING — SUBTERRANEAN y = -2.6m): MINAS PROFUNDAS DE MITHRIL
  // ===========================================================================
  private buildRoomFourEastDeepMines(
    scene: THREE.Scene,
    perksCatalog: Record<PerkId, PerkInfo>,
    windows: BarricadeWindow[],
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void,
    torchLights: THREE.PointLight[],
    torchFlames: THREE.Object3D[]
  ): void {
    const y4 = -2.6;

    // 1. North-East Staircase Going DOWN (x: 14.6 at y=0.0 -> x: 21.2 at y=-2.6, z = -3.5)
    this.buildStoneStaircase(scene, {
      startX: 14.6,
      startY: 0.0,
      startZ: -3.5,
      endX: 21.2,
      endY: y4,
      endZ: -3.5,
      width: 4.4,
      steps: 14,
      withSideRails: true,
      enclosedHeight: 4.8
    });

    // 2. South-East Staircase Going UP (x: 21.2 at y=-2.6 -> x: 14.6 at y=-1.2, z = 32.0)
    this.buildStoneStaircase(scene, {
      startX: 21.2,
      startY: y4,
      startZ: 32.0,
      endX: 14.6,
      endY: -1.2,
      endZ: 32.0,
      width: 4.4,
      steps: 12,
      withSideRails: true,
      enclosedHeight: 4.8
    });

    // 3. Room 4 Deep Cavern Floor (x: 22..35, z: -8.5..36.5, y = -2.6m)
    const r4Floor = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(13.2, 0.5, 45.0), 5, 16),
      this.floorMat
    );
    r4Floor.position.set(28.5, y4 - 0.25, 14.0);
    r4Floor.receiveShadow = true;

    const r4Ceiling = new THREE.Mesh(
      this.scaleUVs(new THREE.PlaneGeometry(13.2, 45.0), 4, 14),
      this.rockMat
    );
    r4Ceiling.rotation.x = Math.PI / 2;
    r4Ceiling.position.set(28.5, y4 + 6.8, 14.0);
    scene.add(r4Floor, r4Ceiling);

    // North & South Walls of Room 4
    const endWallGeo = this.scaleUVs(new THREE.BoxGeometry(13.2, 7.0, 0.75), 4, 2.5);
    const northWall = new THREE.Mesh(endWallGeo, this.wallMat);
    northWall.position.set(28.5, y4 + 3.5, -8.5);
    const southWall = new THREE.Mesh(endWallGeo, this.wallMat);
    southWall.position.set(28.5, y4 + 3.5, 36.5);
    scene.add(northWall, southWall);

    // West Inner Wall of Room 4 (x = +22.0, segmented around z = -3.5 and z = 32.0)
    this.buildSegmentedCorridorWall(
      scene,
      22.0,
      y4,
      7.0,
      -8.5,
      36.5,
      [
        { min: -5.7, max: -1.3 },
        { min: 29.8, max: 34.2 }
      ]
    );

    // East Outer Wall of Room 4 (x = +35.0) with 2 Barricade Windows (#8 at z = 2.5, #9 at z = 24.5)
    this.buildSegmentedCorridorWall(
      scene,
      35.0,
      y4,
      7.0,
      -8.5,
      36.5,
      [
        { min: 0.3, max: 4.7 },
        { min: 22.3, max: 26.7 }
      ]
    );
    this.buildCompactArchWindow(
      scene,
      8,
      new THREE.Vector3(35.0, y4, 2.5),
      -Math.PI / 2,
      new THREE.Vector3(41.0, y4, 2.5),
      new THREE.Vector3(32.6, y4, 2.5),
      windows,
      interactables,
      4
    );
    this.buildCompactArchWindow(
      scene,
      9,
      new THREE.Vector3(35.0, y4, 24.5),
      -Math.PI / 2,
      new THREE.Vector3(41.0, y4, 24.5),
      new THREE.Vector3(32.6, y4, 24.5),
      windows,
      interactables,
      4
    );

    // Central Mithril Ore Crusher & Crystal Vein Island at (28.5, y4, 14.0)
    const crusherBase = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(3.2, 1.3, 6.2), 2, 3),
      this.darkSlateMat
    );
    crusherBase.position.set(28.5, y4 + 0.65, 14.0);
    scene.add(crusherBase);

    // Glowing Raw Mithril Crystal Spires erupting from the central island
    [-1.6, 0, 1.6].forEach((zOff, i) => {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55 + (i === 1 ? 0.25 : 0), 1),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0x38bdf8 : 0x67e8f9 })
      );
      crystal.scale.set(0.8, 1.9, 0.8);
      crystal.position.set(28.5, y4 + 1.8, 14.0 + zOff);
      scene.add(crystal);
    });
    addObstacle(28.5, 14.0, 3.2, 6.2);

    // North & South Mine Timber Support Pillars in Room 4
    this.buildOctagonalColumn(scene, 28.5, y4, 2.5);
    addObstacle(28.5, 2.5, 1.9, 1.9);
    this.buildOctagonalColumn(scene, 28.5, y4, 25.5);
    addObstacle(28.5, 25.5, 1.9, 1.9);

    this.buildIronTorchBrazier(scene, 23.0, y4 + 2.8, 5.0, true, torchLights, torchFlames);
    this.buildIronTorchBrazier(scene, 23.0, y4 + 2.8, 22.0, false, torchLights, torchFlames);

    // Stations in Room 4:
    // 1. Cofre de los Noldor (Mystery Box — 950 pts) at North Mithril Vault (28.5, -2.6, -6.5)
    this.buildOrnateMysteryBox(
      scene,
      new THREE.Vector3(28.5, y4, -6.5),
      0,
      interactables,
      addObstacle
    );

    // 2. Perk: Cerveza de la Comarca / Double Tap (1800 pts) at South Smelting Vault (28.5, -2.6, 34.6)
    this.buildPerkShrine(
      scene,
      'shire_ale',
      perksCatalog.shire_ale,
      new THREE.Vector3(28.5, y4, 34.6),
      Math.PI,
      0xf59e0b,
      interactables,
      addObstacle
    );
  }

  // ===========================================================================
  // ROOM 5 BUILDER (SOUTH ABYSS y = -2.4m): PUENTE DE KHAZAD-DÛM & FORJA
  // ===========================================================================
  private buildRoomFiveAbyssalForge(
    scene: THREE.Scene,
    windows: BarricadeWindow[],
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void,
    torchLights: THREE.PointLight[],
    torchFlames: THREE.Object3D[]
  ): void {
    const y5 = -2.4;

    // 1. Abyssal Staircase Going DOWN (z: 54.8 at y=+0.2 -> z: 61.2 at y=-2.4, x = 0)
    this.buildStoneStaircase(scene, {
      startX: 0,
      startY: 0.2,
      startZ: 54.8,
      endX: 0,
      endY: y5,
      endZ: 61.2,
      width: 4.6,
      steps: 14,
      withSideRails: true,
      enclosedHeight: 5.0
    });

    // 2. The Bridge of Khazad-dûm (z: 61.2..68.0, width 6.4m) over Glowing Magma Chasm!
    const bridgeDeck = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(6.4, 0.6, 7.2), 3, 3),
      this.floorMat
    );
    bridgeDeck.position.set(0, y5 - 0.3, 64.6);
    scene.add(bridgeDeck);

    // Glowing Magma Lake below the Bridge on both sides (y = -4.8m)
    const magmaLake = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 14),
      new THREE.MeshBasicMaterial({ color: 0xea580c })
    );
    magmaLake.rotation.x = -Math.PI / 2;
    magmaLake.position.set(0, -4.8, 64.6);
    const magmaAura = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 14),
      this.volumetricWarmMat
    );
    magmaAura.rotation.x = -Math.PI / 2;
    magmaAura.position.set(0, -3.2, 64.6);
    scene.add(magmaLake, magmaAura);

    // Bridge Parapets & Chasm Collision Blocks on Left (x < -3.2) and Right (x > +3.2)
    [-3.1, 3.1].forEach((bx) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 7.0), this.darkSlateMat);
      curb.position.set(bx, y5 + 0.42, 64.6);
      scene.add(curb);
    });
    addObstacle(-7.6, 64.6, 8.8, 6.8);
    addObstacle(7.6, 64.6, 8.8, 6.8);

    // 3. Sanctum of Celebrimbor Floor (x: -11.5..11.5, z: 68.0..79.0, y = -2.4m)
    const sanctumFloor = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(23.0, 0.5, 11.4), 8, 4),
      this.floorMat
    );
    sanctumFloor.position.set(0, y5 - 0.25, 73.5);
    sanctumFloor.receiveShadow = true;

    const sanctumCeiling = new THREE.Mesh(
      this.scaleUVs(new THREE.PlaneGeometry(23.0, 18.0), 6, 5),
      this.rockMat
    );
    sanctumCeiling.rotation.x = Math.PI / 2;
    sanctumCeiling.position.set(0, y5 + 7.4, 70.0);
    scene.add(sanctumFloor, sanctumCeiling);

    // Sanctum Perimeter Walls (North Wing Walls at z = 68.0, West & East Walls at x = ±11.5, South Wall at z = 79.0)
    const wingWallGeo = this.scaleUVs(new THREE.BoxGeometry(8.3, 7.6, 0.75), 3, 2.5);
    [-7.35, 7.35].forEach((wx) => {
      const nw = new THREE.Mesh(wingWallGeo, this.wallMat);
      nw.position.set(wx, y5 + 3.8, 68.0);
      scene.add(nw);
    });

    const sideSanctumGeo = this.scaleUVs(new THREE.BoxGeometry(0.75, 7.6, 11.4), 4, 2.5);
    const westSanctumWall = new THREE.Mesh(sideSanctumGeo, this.wallMat);
    westSanctumWall.position.set(-11.5, y5 + 3.8, 73.5);
    const eastSanctumWall = new THREE.Mesh(sideSanctumGeo, this.wallMat);
    eastSanctumWall.position.set(11.5, y5 + 3.8, 73.5);
    scene.add(westSanctumWall, eastSanctumWall);

    // South Wall of Sanctum (z = 79.0) with Barricade Window #10
    this.buildWallSideWithArchWindow(
      scene,
      10,
      new THREE.Vector3(0, y5, 79.0),
      0,
      new THREE.Vector3(0, y5, 85.5),
      new THREE.Vector3(0, y5, 76.6),
      windows,
      interactables,
      5
    );

    // Twin Columns & Braziers inside the Forge Sanctum
    this.buildOctagonalColumn(scene, -6.2, y5, 72.5);
    addObstacle(-6.2, 72.5, 1.9, 1.9);
    this.buildOctagonalColumn(scene, 6.2, y5, 72.5);
    addObstacle(6.2, 72.5, 1.9, 1.9);
    this.buildIronTorchBrazier(scene, -5.2, y5 + 3.0, 72.5, true, torchLights, torchFlames);
    this.buildIronTorchBrazier(scene, 5.2, y5 + 3.0, 72.5, false, torchLights, torchFlames);

    // Centerpiece: La Forja de Celebrimbor (Pack-a-Punch — 3000 pts) at (0, -2.4, 73.2)
    this.buildForgeOfCelebrimbor(
      scene,
      new THREE.Vector3(0, y5, 73.2),
      Math.PI,
      interactables,
      addObstacle
    );

    // Elite Wall Weapon in Sanctum: Arco Negro de Bardo (1800 pts) on East Wall
    this.buildDetailedWallWeaponRack(
      scene,
      'wall_bard_bow',
      'bard_black_bow',
      'Arco Negro de Bardo',
      1800,
      900,
      new THREE.Vector3(10.95, y5 + 1.75, 73.5),
      -Math.PI / 2,
      0x22c55e,
      interactables
    );
  }

  // ===========================================================================
  // REUSABLE ARCHITECTURAL HELPERS (STAIRCASES, DOORS, WALLS, COVER ISLANDS)
  // ===========================================================================
  private buildStoneStaircase(
    scene: THREE.Scene,
    cfg: {
      startX: number;
      startY: number;
      startZ: number;
      endX: number;
      endY: number;
      endZ: number;
      width: number;
      steps: number;
      withSideRails?: boolean;
      enclosedHeight?: number;
    }
  ): void {
    const group = new THREE.Group();
    const dx = cfg.endX - cfg.startX;
    const dy = cfg.endY - cfg.startY;
    const dz = cfg.endZ - cfg.startZ;
    const horizLen = Math.hypot(dx, dz);
    const stepDepth = horizLen / cfg.steps;
    const stepHeight = Math.abs(dy) / cfg.steps + 0.14;
    const isAlongX = Math.abs(dx) > Math.abs(dz);

    const treadGeo = isAlongX
      ? new THREE.BoxGeometry(stepDepth + 0.06, stepHeight, cfg.width)
      : new THREE.BoxGeometry(cfg.width, stepHeight, stepDepth + 0.06);
    const nosingGeo = isAlongX
      ? new THREE.BoxGeometry(0.06, 0.04, cfg.width - 0.1)
      : new THREE.BoxGeometry(cfg.width - 0.1, 0.04, 0.06);

    for (let i = 0; i < cfg.steps; i++) {
      const t = (i + 0.5) / cfg.steps;
      const sx = cfg.startX + dx * t;
      const sy = cfg.startY + dy * t;
      const sz = cfg.startZ + dz * t;

      const stepMesh = new THREE.Mesh(
        treadGeo,
        i % 2 === 0 ? this.darkSlateMat : this.rockMat
      );
      stepMesh.position.set(sx, sy - stepHeight / 2, sz);
      stepMesh.receiveShadow = true;

      const nose = new THREE.Mesh(nosingGeo, this.goldMat);
      nose.position.set(sx, sy + 0.01, sz);
      group.add(stepMesh, nose);
    }

    if (cfg.enclosedHeight) {
      // Build stepped/sloped tunnel walls & ceiling ribs around the stairwell
      const midX = (cfg.startX + cfg.endX) / 2;
      const midY = (cfg.startY + cfg.endY) / 2;
      const midZ = (cfg.startZ + cfg.endZ) / 2;
      const h = cfg.enclosedHeight;
      const wallOffset = cfg.width / 2 + 0.32;

      if (isAlongX) {
        const wallGeo = this.scaleUVs(new THREE.BoxGeometry(horizLen + 1.6, h + 3.2, 0.65), 4, 2);
        const wN = new THREE.Mesh(wallGeo, this.wallMat);
        wN.position.set(midX, midY + h / 2, midZ - wallOffset);
        const wS = new THREE.Mesh(wallGeo, this.wallMat);
        wS.position.set(midX, midY + h / 2, midZ + wallOffset);
        const ceil = new THREE.Mesh(
          new THREE.BoxGeometry(horizLen + 1.6, 0.5, cfg.width + 1.2),
          this.rockMat
        );
        ceil.position.set(midX, Math.max(cfg.startY, cfg.endY) + h, midZ);
        group.add(wN, wS, ceil);
      } else {
        const wallGeo = this.scaleUVs(new THREE.BoxGeometry(0.65, h + 3.2, horizLen + 1.6), 4, 2);
        const wW = new THREE.Mesh(wallGeo, this.wallMat);
        wW.position.set(midX - wallOffset, midY + h / 2, midZ);
        const wE = new THREE.Mesh(wallGeo, this.wallMat);
        wE.position.set(midX + wallOffset, midY + h / 2, midZ);
        const ceil = new THREE.Mesh(
          new THREE.BoxGeometry(cfg.width + 1.2, 0.5, horizLen + 1.6),
          this.rockMat
        );
        ceil.position.set(midX, Math.max(cfg.startY, cfg.endY) + h, midZ);
        group.add(wW, wE, ceil);
      }
    }

    scene.add(group);
  }

  private buildSegmentedCorridorWall(
    scene: THREE.Scene,
    wallX: number,
    baseY: number,
    height: number,
    zMin: number,
    zMax: number,
    openings: Array<{ min: number; max: number }>
  ): void {
    const sorted = [...openings].sort((a, b) => a.min - b.min);
    let cursor = zMin;

    const addSpan = (z1: number, z2: number) => {
      const len = z2 - z1;
      if (len <= 0.1) return;
      const cz = (z1 + z2) / 2;
      const wall = new THREE.Mesh(
        this.scaleUVs(new THREE.BoxGeometry(0.75, height, len), Math.max(1, len / 3), 2.5),
        this.wallMat
      );
      wall.position.set(wallX, baseY + height / 2, cz);
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.55, len),
        this.darkSlateMat
      );
      plinth.position.set(wallX, baseY + 0.275, cz);
      scene.add(wall, plinth);
    };

    for (const op of sorted) {
      addSpan(cursor, op.min);
      // Lintel header above the opening
      const opLen = op.max - op.min;
      const opCz = (op.min + op.max) / 2;
      const header = new THREE.Mesh(
        this.scaleUVs(new THREE.BoxGeometry(0.75, height - 4.5, opLen), 1.5, 1),
        this.wallMat
      );
      header.position.set(wallX, baseY + 4.5 + (height - 4.5) / 2, opCz);
      scene.add(header);
      cursor = op.max;
    }
    addSpan(cursor, zMax);
  }

  private buildSideWallWithDoorAndWindow(
    scene: THREE.Scene,
    cfg: {
      wallX: number;
      baseY: number;
      zMin: number;
      zMax: number;
      isWest: boolean;
      doorId: DoorId;
      doorTitle: string;
      doorCost: number;
      roomIdUnlocked: number;
      doorCenterZ: number;
      windowId: number;
      windowCenterZ: number;
      roomId: number;
      windows: BarricadeWindow[];
      interactables: InteractableItem[];
    }
  ): void {
    const doorHalf = 2.2;
    const winHalf = 2.2;
    this.buildSegmentedCorridorWall(scene, cfg.wallX, cfg.baseY, 8.4, cfg.zMin, cfg.zMax, [
      { min: cfg.doorCenterZ - doorHalf, max: cfg.doorCenterZ + doorHalf },
      { min: cfg.windowCenterZ - winHalf, max: cfg.windowCenterZ + winHalf }
    ]);

    // 1. Buyable Dwarven Double Doorway at doorCenterZ
    const rotY = cfg.isWest ? Math.PI / 2 : -Math.PI / 2;
    const inwardOffset = cfg.isWest ? 1.0 : -1.0;
    this.buildBuyableDwarvenDoorway(
      scene,
      new THREE.Vector3(cfg.wallX, cfg.baseY, cfg.doorCenterZ),
      rotY,
      cfg.doorId,
      cfg.doorTitle,
      cfg.doorCost,
      cfg.roomIdUnlocked,
      new THREE.Vector3(cfg.wallX + inwardOffset, cfg.baseY + 1.5, cfg.doorCenterZ),
      cfg.interactables
    );

    // 2. Barricade Window at windowCenterZ
    const outX = cfg.isWest ? cfg.wallX - 6.0 : cfg.wallX + 6.0;
    const inX = cfg.isWest ? cfg.wallX + 2.2 : cfg.wallX - 2.2;
    this.buildCompactArchWindow(
      scene,
      cfg.windowId,
      new THREE.Vector3(cfg.wallX, cfg.baseY, cfg.windowCenterZ),
      rotY,
      new THREE.Vector3(outX, cfg.baseY, cfg.windowCenterZ),
      new THREE.Vector3(inX, cfg.baseY, cfg.windowCenterZ),
      cfg.windows,
      cfg.interactables,
      cfg.roomId
    );
  }

  private buildBuyableDwarvenDoorway(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    rotY: number,
    doorId: DoorId,
    title: string,
    cost: number,
    roomIdUnlocked: number,
    interactPos: THREE.Vector3,
    interactables: InteractableItem[]
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const jambGeo = new THREE.CylinderGeometry(0.38, 0.44, 4.8, 8);
    const jambL = new THREE.Mesh(jambGeo, this.darkSlateMat);
    jambL.position.set(-2.2, 2.4, 0);
    const jambR = new THREE.Mesh(jambGeo, this.darkSlateMat);
    jambR.position.set(2.2, 2.4, 0);

    const archHeader = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.6, 1.2), this.darkSlateMat);
    archHeader.position.set(0, 4.65, 0);
    const goldLintel = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.14, 1.26), this.goldMat);
    goldLintel.position.set(0, 4.38, 0);

    group.add(jambL, jambR, archHeader, goldLintel);

    const buildLeaf = (isLeft: boolean): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(isLeft ? -2.05 : 2.05, 0, 0);
      const leafOffset = isLeft ? 1.01 : -1.01;
      const slab = new THREE.Mesh(
        this.scaleUVs(new THREE.BoxGeometry(2.02, 4.3, 0.22), 1.5, 2.5),
        this.darkWoodMat
      );
      slab.position.set(leafOffset, 2.15, 0);
      [0.65, 2.15, 3.65].forEach((sy) => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.15, 0.26), this.ironMat);
        strap.position.set(leafOffset, sy, 0);
        pivot.add(strap);
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 12), this.goldMat);
      ring.position.set(isLeft ? 1.55 : -1.55, 1.85, 0.15);
      pivot.add(slab, ring);
      return pivot;
    };

    const left = buildLeaf(true);
    const right = buildLeaf(false);

    const seal = new THREE.Group();
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.22, 0.22), this.ironMat);
    crossBar.position.set(0, 2.05, 0.18);
    const runeLock = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 1),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    runeLock.position.set(0, 2.05, 0.28);
    const sealAura = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), this.volumetricWarmMat);
    sealAura.position.set(0, 2.1, 0.22);
    seal.add(crossBar, runeLock, sealAura);

    this.doorRigs.set(doorId, { left, right, seal });
    group.add(left, right, seal);
    scene.add(group);

    interactables.push({
      id: doorId,
      doorId,
      type: 'door',
      title,
      subtitle: `Pulsa [F] para abrir el acceso [${cost} pts]`,
      cost,
      roomIdUnlocked,
      position: interactPos,
      radius: 3.4,
      mesh: seal
    });
  }

  private buildCompactArchWindow(
    scene: THREE.Scene,
    windowId: number,
    centerPos: THREE.Vector3,
    rotY: number,
    outsideSpawnPos: THREE.Vector3,
    insideEntryPos: THREE.Vector3,
    windows: BarricadeWindow[],
    interactables: InteractableItem[],
    roomId: number
  ): void {
    const group = new THREE.Group();
    group.position.copy(centerPos);
    group.rotation.y = rotY;

    // Outer spawn floor pad so enemies outside elevated/sunken windows stand on solid rock
    const outerPad = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(7.5, 0.4, 8.5), 3, 3),
      this.outerFloorMat
    );
    outerPad.position.set(0, -0.22, -4.2);

    const sill = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(4.4, 0.9, 1.15), 2, 0.5),
      this.darkSlateMat
    );
    sill.position.set(0, 0.45, 0);

    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.34, 8, 18, Math.PI),
      this.darkSlateMat
    );
    arch.position.set(0, 3.1, 0);

    const windowLightShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 2.2, 5.8, 12, 1, true),
      this.volumetricCyanMat
    );
    windowLightShaft.rotation.x = Math.PI / 2.6;
    windowLightShaft.position.set(0, 1.8, 2.2);

    group.add(outerPad, sill, arch, windowLightShaft);

    const plankGeo = this.scaleUVs(new THREE.BoxGeometry(3.8, 0.24, 0.12), 2, 0.3);
    const studGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.16, 6);
    studGeo.rotateX(Math.PI / 2);

    const plankMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(plankGeo, this.woodMat);
      plank.position.set(0, 1.15 + i * 0.37, 0);
      plank.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.035;
      const studL = new THREE.Mesh(studGeo, this.ironMat);
      studL.position.set(-1.6, 0, 0);
      const studR = new THREE.Mesh(studGeo, this.ironMat);
      studR.position.set(1.6, 0, 0);
      plank.add(studL, studR);
      group.add(plank);
      plankMeshes.push(plank);
    }

    scene.add(group);

    windows.push({
      id: windowId,
      roomId,
      position: centerPos.clone(),
      rotationY: rotY,
      outsideSpawnPos,
      insideEntryPos,
      planks: 6,
      maxPlanks: 6,
      plankMeshes
    });

    interactables.push({
      id: `window_${windowId}`,
      type: 'window',
      title: `Barricada #${windowId}`,
      subtitle: 'Mantén [F] para reparar tablón (+10 pts)',
      cost: 0,
      windowId,
      position: insideEntryPos.clone(),
      radius: 2.9
    });
  }

  private buildTacticalBarricadeIsland(
    scene: THREE.Scene,
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    addObstacle: (x: number, z: number, w: number, d: number) => void
  ): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const baseWall = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(w, 1.15, d), 1, 2.5),
      this.darkSlateMat
    );
    baseWall.position.y = 0.575;
    baseWall.castShadow = true;
    baseWall.receiveShadow = true;

    const topCap = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.14, 0.14, d + 0.14),
      this.rockMat
    );
    topCap.position.y = 1.18;

    const postN = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 1.45, 0.45), this.darkSlateMat);
    postN.position.set(0, 0.725, -d / 2 + 0.22);
    const postS = postN.clone();
    postS.position.set(0, 0.725, d / 2 - 0.22);

    const goldShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.08, 8),
      this.goldMat
    );
    goldShield.rotation.z = Math.PI / 2;
    goldShield.position.set(x < 0 ? w / 2 + 0.04 : -w / 2 - 0.04, 0.65, 0);

    group.add(baseWall, topCap, postN, postS, goldShield);
    scene.add(group);
    addObstacle(x, z, w, d);
  }

  private buildOverturnedMinecartAndRubble(
    scene: THREE.Scene,
    x: number,
    y: number,
    z: number,
    rotY: number,
    addObstacle: (x: number, z: number, w: number, d: number) => void
  ): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const cartBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.85, 0.95),
      this.ironMat
    );
    cartBox.position.set(0, 0.48, 0);
    cartBox.rotation.z = 0.38;

    const oreMound = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.45, 1),
      this.rockMat
    );
    oreMound.position.set(0.35, 0.32, 0.15);

    group.add(cartBox, oreMound);
    scene.add(group);
    addObstacle(x, z, 1.5, 1.2);
  }

  private buildDetailedFloorArchitecture(scene: THREE.Scene): void {
    const outerOctagon = new THREE.Mesh(
      this.scaleUVs(new THREE.RingGeometry(4.4, 5.4, 8), 4, 1),
      this.darkSlateMat
    );
    outerOctagon.rotation.x = -Math.PI / 2;
    outerOctagon.rotation.z = Math.PI / 8;
    outerOctagon.position.set(0, 0.015, 2.8);
    scene.add(outerOctagon);

    const goldInlayRing = new THREE.Mesh(
      new THREE.RingGeometry(4.32, 4.4, 32),
      this.goldMat
    );
    goldInlayRing.rotation.x = -Math.PI / 2;
    goldInlayRing.position.set(0, 0.018, 2.8);
    scene.add(goldInlayRing);
  }

  private buildVaultedCeiling(scene: THREE.Scene): void {
    const panelConfigs = [
      { x: 0, z: -8.5, w: 28, d: 11 },
      { x: 0, z: 8.5, w: 28, d: 11 },
      { x: -8.5, z: 0, w: 11, d: 6 },
      { x: 8.5, z: 0, w: 11, d: 6 }
    ];
    panelConfigs.forEach((c) => {
      const p = new THREE.Mesh(
        this.scaleUVs(new THREE.PlaneGeometry(c.w, c.d), 4, 2),
        this.rockMat
      );
      p.rotation.x = Math.PI / 2;
      p.position.set(c.x, 8.4, c.z);
      scene.add(p);
    });

    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.42, 10, 24), this.darkSlateMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 8.25, 2.8);
    scene.add(rim);

    const goldOculus = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.09, 8, 24), this.goldMat);
    goldOculus.rotation.x = Math.PI / 2;
    goldOculus.position.set(0, 8.15, 2.8);
    scene.add(goldOculus);

    const godRayCone = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 5.2, 8.4, 20, 1, true),
      this.volumetricCyanMat
    );
    godRayCone.position.set(0.2, 4.2, 2.8);
    godRayCone.rotation.z = -0.05;
    scene.add(godRayCone);
  }

  private buildZoneOneSouthGatewayWall(
    scene: THREE.Scene,
    interactables: InteractableItem[],
    doorId: DoorId = 'door_zone_2',
    title = 'Puerta de Khazad-dûm (Sala de los Pilares)',
    cost = 1250,
    roomIdUnlocked = 2,
    wallPos = new THREE.Vector3(0, 0, 14)
  ): void {
    const wallGroup = new THREE.Group();
    wallGroup.position.copy(wallPos);

    const sideWallGeo = this.scaleUVs(new THREE.BoxGeometry(11.6, 8.4, 0.85), 4, 3);
    const plinthGeo = this.scaleUVs(new THREE.BoxGeometry(11.6, 0.7, 1.25), 4, 0.5);
    const corniceGeo = this.scaleUVs(new THREE.BoxGeometry(11.6, 0.6, 1.35), 4, 0.5);

    [-8.2, 8.2].forEach((xPos) => {
      const wallMesh = new THREE.Mesh(sideWallGeo, this.wallMat);
      wallMesh.position.set(xPos, 4.2, 0);
      wallMesh.receiveShadow = true;

      const plinth = new THREE.Mesh(plinthGeo, this.darkSlateMat);
      plinth.position.set(xPos, 0.35, 0);

      const cornice = new THREE.Mesh(corniceGeo, this.darkSlateMat);
      cornice.position.set(xPos, 8.1, 0);

      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), this.crimsonBannerMat);
      banner.position.set(xPos, 3.1, -0.52);
      const bannerTrim = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), this.goldMat);
      bannerTrim.position.set(xPos, 4.25, -0.52);

      wallGroup.add(wallMesh, plinth, cornice, banner, bannerTrim);
    });

    const upperWall = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(4.8, 3.6, 0.85), 2, 1.2),
      this.wallMat
    );
    upperWall.position.set(0, 6.6, 0);
    wallGroup.add(upperWall);
    scene.add(wallGroup);

    this.buildBuyableDwarvenDoorway(
      scene,
      wallPos,
      Math.PI,
      doorId,
      title,
      cost,
      roomIdUnlocked,
      new THREE.Vector3(wallPos.x, wallPos.y + 1.5, wallPos.z - 1.0),
      interactables
    );
  }

  private buildWallSideWithArchWindow(
    scene: THREE.Scene,
    windowId: number,
    centerPos: THREE.Vector3,
    rotY: number,
    outsideSpawnPos: THREE.Vector3,
    insideEntryPos: THREE.Vector3,
    windows: BarricadeWindow[],
    interactables: InteractableItem[],
    roomId = 1
  ): void {
    const wallGroup = new THREE.Group();
    wallGroup.position.copy(centerPos);
    wallGroup.rotation.y = rotY;

    const sideWallGeo = this.scaleUVs(new THREE.BoxGeometry(11.8, 8.4, 0.85), 4, 3);
    const plinthGeo = this.scaleUVs(new THREE.BoxGeometry(11.8, 0.7, 1.25), 4, 0.5);
    const corniceGeo = this.scaleUVs(new THREE.BoxGeometry(11.8, 0.6, 1.35), 4, 0.5);

    [-8.1, 8.1].forEach((xPos) => {
      const wallMesh = new THREE.Mesh(sideWallGeo, this.wallMat);
      wallMesh.position.set(xPos, 4.2, 0);
      wallMesh.receiveShadow = true;

      const plinth = new THREE.Mesh(plinthGeo, this.darkSlateMat);
      plinth.position.set(xPos, 0.35, 0);

      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), this.crimsonBannerMat);
      banner.position.set(xPos, 3.1, -0.52);
      const bannerTrim = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), this.goldMat);
      bannerTrim.position.set(xPos, 4.25, -0.52);

      const cornice = new THREE.Mesh(corniceGeo, this.darkSlateMat);
      cornice.position.set(xPos, 8.1, 0);
      wallGroup.add(wallMesh, plinth, banner, bannerTrim, cornice);
    });

    const upperWall = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(4.4, 3.9, 0.85), 1.5, 1.3),
      this.wallMat
    );
    upperWall.position.set(0, 6.45, 0);
    wallGroup.add(upperWall);
    scene.add(wallGroup);

    this.buildCompactArchWindow(
      scene,
      windowId,
      centerPos,
      rotY,
      outsideSpawnPos,
      insideEntryPos,
      windows,
      interactables,
      roomId
    );
  }

  private buildOctagonalColumn(scene: THREE.Scene, x: number, y: number, z?: number): void {
    const posZ = z !== undefined ? z : y;
    const posY = z !== undefined ? y : 0;
    const group = new THREE.Group();
    group.position.set(x, posY, posZ);

    const base1 = new THREE.Mesh(
      this.scaleUVs(new THREE.CylinderGeometry(1.22, 1.36, 0.48, 8), 2, 0.5),
      this.darkSlateMat
    );
    base1.position.y = 0.24;

    const base2 = new THREE.Mesh(
      this.scaleUVs(new THREE.CylinderGeometry(0.98, 1.15, 0.42, 8), 2, 0.5),
      this.rockMat
    );
    base2.position.y = 0.68;

    const shaft = new THREE.Mesh(
      this.scaleUVs(new THREE.CylinderGeometry(0.8, 0.88, 6.8, 8), 2, 4),
      this.rockMat
    );
    shaft.position.y = 4.2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;

    const ringLow = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.065, 6, 8), this.goldMat);
    ringLow.rotation.x = Math.PI / 2;
    ringLow.position.y = 2.2;

    const ringHigh = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.065, 6, 8), this.goldMat);
    ringHigh.rotation.x = Math.PI / 2;
    ringHigh.position.y = 5.5;

    const capital = new THREE.Mesh(
      this.scaleUVs(new THREE.CylinderGeometry(1.38, 0.84, 0.8, 8), 2, 1),
      this.darkSlateMat
    );
    capital.position.y = 7.8;

    group.add(base1, base2, shaft, ringLow, ringHigh, capital);
    scene.add(group);
  }

  private buildIronTorchBrazier(
    scene: THREE.Scene,
    x: number,
    y: number,
    z: number,
    withPointLight: boolean,
    torchLights: THREE.PointLight[],
    torchFlames: THREE.Object3D[]
  ): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.55, 6), this.ironMat);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.1, 0.24, 8), this.ironMat);
    bowl.position.y = 0.28;

    const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 6, 8), this.goldMat);
    cageRing.rotation.x = Math.PI / 2;
    cageRing.position.y = 0.38;

    const flameGroup = new THREE.Group();
    flameGroup.position.y = 0.44;

    const outerFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.52, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6b00 })
    );
    const innerFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.35, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff394 })
    );
    const auraSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 8, 8),
      this.volumetricWarmMat
    );
    flameGroup.add(outerFlame, innerFlame, auraSphere);

    group.add(stem, bowl, cageRing, flameGroup);
    scene.add(group);
    torchFlames.push(flameGroup);

    if (withPointLight) {
      const light = new THREE.PointLight(0xff8c2b, 5.2, 32, 1.15);
      light.position.set(x, y + 0.6, z);
      scene.add(light);
      torchLights.push(light);
    }
  }

  private buildBalinsTomb(scene: THREE.Scene, x = 0, y = 0, z = 0): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const step1 = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(3.6, 0.24, 2.2), 2, 1),
      this.darkSlateMat
    );
    step1.position.y = 0.12;
    step1.receiveShadow = true;

    const step2 = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(3.1, 0.22, 1.75), 2, 1),
      this.rockMat
    );
    step2.position.y = 0.35;
    step2.receiveShadow = true;

    const chest = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(2.55, 0.85, 1.3), 2, 1),
      this.marbleMat
    );
    chest.position.y = 0.88;
    chest.castShadow = true;
    chest.receiveShadow = true;

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.94, 2.7, 4),
      this.marbleMat
    );
    lid.rotation.z = Math.PI / 2;
    lid.rotation.x = Math.PI / 4;
    lid.scale.set(1, 1, 0.35);
    lid.position.y = 1.42;

    const runePlaque = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.04, 0.74), this.goldMat);
    runePlaque.position.y = 1.56;

    const runeGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 0.45),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      })
    );
    runeGlow.rotation.x = -Math.PI / 2;
    runeGlow.position.y = 1.585;

    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 16), this.goldMat);
    shield.rotation.x = Math.PI / 2.4;
    shield.position.set(0, 0.62, 0.82);

    group.add(step1, step2, chest, lid, runePlaque, runeGlow, shield);
    scene.add(group);
  }

  private buildEnvironmentalProps(
    scene: THREE.Scene,
    addObstacle: (x: number, z: number, w: number, d: number) => void
  ): void {
    const beamGeo = this.scaleUVs(new THREE.BoxGeometry(0.32, 5.2, 0.32), 0.5, 4);
    const crossStrutGeo = this.scaleUVs(new THREE.BoxGeometry(0.22, 2.8, 0.22), 0.5, 2);
    const collapsedBeams = [
      { x: -12.6, y: 2.3, z: 10.2, rx: 0.42, rz: -0.35 },
      { x: 12.6, y: 2.3, z: 10.2, rx: -0.42, rz: 0.35 }
    ];
    collapsedBeams.forEach((cb) => {
      const beamGroup = new THREE.Group();
      beamGroup.position.set(cb.x, cb.y, cb.z);
      beamGroup.rotation.set(cb.rx, 0, cb.rz);
      const mainTimber = new THREE.Mesh(beamGeo, this.darkWoodMat);
      const strut = new THREE.Mesh(crossStrutGeo, this.woodMat);
      strut.position.set(0.35, -0.5, 0.2);
      strut.rotation.z = 0.55;
      beamGroup.add(mainTimber, strut);
      scene.add(beamGroup);
    });

    const bodyGeo = this.scaleUVs(new THREE.CylinderGeometry(0.42, 0.38, 1.05, 14), 2, 1);
    const hoopGeo = new THREE.TorusGeometry(0.41, 0.028, 6, 14);
    hoopGeo.rotateX(Math.PI / 2);

    const barrelPositions = [
      new THREE.Vector3(-12.3, 0, 9.2),
      new THREE.Vector3(12.3, 0, 0.4)
    ];
    barrelPositions.forEach((pos) => {
      const barrelGroup = new THREE.Group();
      barrelGroup.position.copy(pos);
      const body = new THREE.Mesh(bodyGeo, this.woodMat);
      body.position.y = 0.525;
      const hoop1 = new THREE.Mesh(hoopGeo, this.ironMat);
      hoop1.position.y = 0.26;
      const hoop2 = new THREE.Mesh(hoopGeo, this.ironMat);
      hoop2.position.y = 0.79;
      barrelGroup.add(body, hoop1, hoop2);
      scene.add(barrelGroup);
      addObstacle(pos.x, pos.z, 0.95, 0.95);
    });
  }

  private buildDetailedWallWeaponRack(
    scene: THREE.Scene,
    id: string,
    weaponId: WeaponId,
    name: string,
    cost: number,
    ammoCost: number,
    pos: THREE.Vector3,
    rotY: number,
    glowColor: number,
    interactables: InteractableItem[]
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const glowMat = new THREE.MeshBasicMaterial({ color: glowColor });

    const plaque = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.1, 8), this.darkWoodMat);
    plaque.rotation.x = Math.PI / 2;
    plaque.scale.set(1.2, 1, 0.68);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.055, 6, 8), this.goldMat);
    rim.scale.set(1.2, 0.68, 1);
    rim.position.z = 0.05;

    const aura = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.3),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    aura.position.z = 0.06;

    const weaponMount = new THREE.Group();
    weaponMount.position.z = 0.14;
    if (weaponId === 'erebor_crossbow' || weaponId === 'mithril_repeater') {
      const isMithril = weaponId === 'mithril_repeater';
      const stock = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 1.25, 8),
        isMithril ? this.steelMat : this.woodMat
      );
      stock.rotation.z = Math.PI / 2;
      const bowProd = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.04, 6, 12, Math.PI),
        isMithril ? this.goldMat : this.steelMat
      );
      bowProd.rotation.z = -Math.PI / 2;
      bowProd.position.x = 0.25;
      const runeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.04), glowMat);
      runeStrip.position.z = 0.05;
      weaponMount.add(stock, bowProd, runeStrip);

      if (isMithril) {
        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.34, 8),
          this.goldMat
        );
        drum.rotation.z = Math.PI / 2;
        drum.position.set(-0.05, 0.11, 0.06);
        const secondProd = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.03, 6, 12, Math.PI),
          glowMat
        );
        secondProd.rotation.z = -Math.PI / 2;
        secondProd.position.set(0.36, 0, 0.04);
        weaponMount.add(drum, secondProd);
      }
    } else if (weaponId === 'bard_black_bow' || weaponId === 'lorien_bow') {
      const bowArc = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.036, 8, 18, Math.PI * 0.85),
        this.ironMat
      );
      bowArc.rotation.z = -Math.PI * 0.42;
      bowArc.position.x = -0.15;
      const stringMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.18, 0.02), glowMat);
      stringMesh.position.x = -0.18;
      const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6), this.goldMat);
      arrow.rotation.z = Math.PI / 2;
      weaponMount.add(bowArc, stringMesh, arrow);
    } else {
      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 1.6, 8),
        this.darkWoodMat
      );
      staff.rotation.z = Math.PI / 2;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 1), glowMat);
      crystal.position.x = 0.78;
      weaponMount.add(staff, crystal);
    }

    group.add(plaque, rim, aura, weaponMount);
    scene.add(group);

    interactables.push({
      id,
      type: 'wall_weapon',
      title: name,
      subtitle: `Pulsa [F] Comprar [${cost} pts] / Munición [${ammoCost} pts]`,
      cost,
      ammoCost,
      weaponId,
      position: new THREE.Vector3(pos.x, pos.y, pos.z),
      radius: 2.9,
      mesh: group
    });
  }

  private buildPerkShrine(
    scene: THREE.Scene,
    perkId: PerkId,
    info: PerkInfo,
    pos: THREE.Vector3,
    rotY: number,
    hexColor: number,
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const glowMat = new THREE.MeshBasicMaterial({ color: hexColor });
    const softAuraMat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const stepBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.24, 1.15),
      this.darkSlateMat
    );
    stepBase.position.y = 0.12;

    const lowerCabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.92, 0.92),
      this.rockMat
    );
    lowerCabinet.position.y = 0.7;

    const frontApron = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.68, 0.08),
      this.darkSlateMat
    );
    frontApron.position.set(0, 0.7, 0.45);

    for (let v = 0; v < 3; v++) {
      const ventGlow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.045, 0.04), glowMat);
      ventGlow.position.set(0, 0.52 + v * 0.16, 0.48);
      group.add(ventGlow);
    }

    const counterLedge = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.14, 1.08),
      this.goldMat
    );
    counterLedge.position.y = 1.22;

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 1.45, 0.28),
      this.darkSlateMat
    );
    backWall.position.set(0, 2.0, -0.32);

    const sideColGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.42, 8);
    const colL = new THREE.Mesh(sideColGeo, this.goldMat);
    colL.position.set(-0.54, 2.0, 0.22);
    const colR = new THREE.Mesh(sideColGeo, this.goldMat);
    colR.position.set(0.54, 2.0, 0.22);

    const backlitPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.24), softAuraMat);
    backlitPanel.position.set(0, 2.0, -0.16);

    const relicGroup = new THREE.Group();
    relicGroup.position.set(0, 2.12, 0.08);

    if (perkId === 'beorn_mead') {
      const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.36, 12), this.darkWoodMat);
      keg.rotation.z = Math.PI / 2;
      const heartGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 1), glowMat);
      heartGem.position.z = 0.14;
      relicGroup.add(keg, heartGem);
    } else if (perkId === 'lembas_bread') {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), glowMat);
      const bladeGeo = new THREE.BoxGeometry(0.05, 0.56, 0.02);
      const blade1 = new THREE.Mesh(bladeGeo, this.goldMat);
      blade1.rotation.z = 0.65;
      blade1.position.z = 0.08;
      const blade2 = new THREE.Mesh(bladeGeo, this.goldMat);
      blade2.rotation.z = -0.65;
      blade2.position.z = 0.08;
      relicGroup.add(crystal, blade1, blade2);
    } else if (perkId === 'shire_ale') {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 10), this.goldMat);
      const foam = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8), glowMat);
      foam.position.y = 0.14;
      relicGroup.add(mug, foam);
    } else {
      const phial = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 2), glowMat);
      phial.scale.set(0.85, 1.35, 0.85);
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 18), this.goldMat);
      ring1.rotation.x = Math.PI / 3;
      relicGroup.add(phial, ring1);
    }

    const auraRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.022, 8, 24), glowMat);
    relicGroup.add(auraRing);

    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.18, 0.96), this.darkSlateMat);
    roofCap.position.set(0, 2.74, -0.02);

    const signBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 16), this.goldMat);
    signBezel.rotation.x = Math.PI / 2;
    signBezel.position.set(0, 3.16, 0.12);

    const signFace = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16), glowMat);
    signFace.rotation.x = Math.PI / 2;
    signFace.position.set(0, 3.16, 0.12);

    const machineAura = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.95, 2.9, 12, 1, true),
      softAuraMat
    );
    machineAura.position.set(0, 1.5, 0);

    group.add(
      stepBase,
      lowerCabinet,
      frontApron,
      counterLedge,
      backWall,
      colL,
      colR,
      backlitPanel,
      relicGroup,
      roofCap,
      signBezel,
      signFace,
      machineAura
    );
    scene.add(group);
    addObstacle(pos.x, pos.z, 1.5, 1.25);

    interactables.push({
      id: `perk_${perkId}`,
      type: 'perk',
      title: `${info.name} (${info.codEquivalent})`,
      subtitle: `Pulsa [F] Beber Elixir [${info.cost} pts] — ${info.description}`,
      cost: info.cost,
      perkId,
      position: pos.clone(),
      radius: 2.85,
      mesh: relicGroup
    });
  }

  private buildOrnateMysteryBox(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    rotY: number,
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const chestBody = new THREE.Mesh(
      this.scaleUVs(new THREE.BoxGeometry(2.15, 0.78, 1.15), 2, 1),
      this.darkWoodMat
    );
    chestBody.position.y = 0.39;

    const archedLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 2.18, 12, 1, false, 0, Math.PI),
      this.woodMat
    );
    archedLid.rotation.z = Math.PI / 2;
    archedLid.position.y = 0.78;

    [-0.78, 0, 0.78].forEach((xOffset) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.86, 1.22), this.goldMat);
      strap.position.set(xOffset, 0.42, 0);
      group.add(strap);
    });

    const runeSeal = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.28, 1.24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    runeSeal.position.set(0, 0.74, 0);

    const mysteryBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 7.5, 14, 1, true),
      this.volumetricCyanMat
    );
    mysteryBeacon.position.y = 4.2;

    group.add(chestBody, archedLid, runeSeal, mysteryBeacon);
    scene.add(group);
    addObstacle(pos.x, pos.z, 2.2, 1.2);

    interactables.push({
      id: 'mystery_box',
      type: 'mystery_box',
      title: 'Cofre de los Noldor (Caja Misteriosa)',
      subtitle: 'Pulsa [F] para arma aleatoria [950 pts]',
      cost: 950,
      position: pos.clone(),
      radius: 2.9,
      mesh: group
    });
  }

  private buildForgeOfCelebrimbor(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    rotY: number,
    interactables: InteractableItem[],
    addObstacle: (x: number, z: number, w: number, d: number) => void
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const hearth = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.92, 8), this.darkSlateMat);
    hearth.position.y = 0.46;

    const lavaBed = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.08, 8),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 })
    );
    lavaBed.position.y = 0.91;

    const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.48, 0.56), this.steelMat);
    anvilBase.position.y = 1.15;
    const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.68, 8), this.steelMat);
    anvilHorn.rotation.z = Math.PI / 2;
    anvilHorn.position.set(0.68, 1.24, 0);

    const runeCore = new THREE.Group();
    runeCore.position.y = 2.02;
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xc084fc })
    );
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.03, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    innerRing.rotation.x = Math.PI / 3;
    const innerSphere = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 1),
      new THREE.MeshBasicMaterial({ color: 0xf0abfc })
    );
    runeCore.add(outerRing, innerRing, innerSphere);

    group.add(hearth, lavaBed, anvilBase, anvilHorn, runeCore);
    scene.add(group);
    addObstacle(pos.x, pos.z, 2.4, 2.4);

    interactables.push({
      id: 'pack_a_punch',
      type: 'pack_a_punch',
      title: 'Forja de Celebrimbor (Pack-a-Punch)',
      subtitle: 'Pulsa [F] para mejorar tu arma actual [3000 pts]',
      cost: 3000,
      position: pos.clone(),
      radius: 3.1,
      mesh: runeCore
    });
  }

  private buildDustMotes(scene: THREE.Scene): THREE.Points {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 68;
      positions[i * 3 + 1] = -2.2 + Math.random() * 10.2;
      positions[i * 3 + 2] = -12 + Math.random() * 88;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.065,
      transparent: true,
      opacity: 0.55
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
  }

  // ===========================================================================
  // HIGH-POLY ARTICULATED & ARMORED ENEMY MESHES (Kino der Toten Detail + LOTR)
  // ===========================================================================
  buildSculptedOrcMesh(type: EnemyType): {
    group: THREE.Group;
    head: THREE.Mesh;
    body: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    hpFill: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const scale = type === 'uruk' ? 1.18 : type === 'orc' ? 1.04 : 0.9;
    const mats = this.enemyMaterials[type];

    // 1. ARTICULATED LEGS (Thigh + Knee Guard + Greave Shin + Heavy Boot)
    const buildLeg = (isLeft: boolean): THREE.Mesh => {
      const side = isLeft ? -1 : 1;
      const thigh = new THREE.Mesh(this.enemyThighGeo, mats.cloth);
      thigh.position.set(side * 0.19, 0.62, 0);

      const knee = new THREE.Mesh(this.enemyKneeGeo, mats.armor);
      knee.position.set(0, -0.22, 0.03);

      const shin = new THREE.Mesh(this.enemyShinGeo, mats.armor);
      shin.position.set(0, -0.4, -0.02);

      const boot = new THREE.Mesh(this.enemyBootGeo, mats.armor);
      boot.position.set(0, -0.58, 0.05);

      thigh.add(knee, shin, boot);
      return thigh;
    };

    const leftLeg = buildLeg(true);
    const rightLeg = buildLeg(false);

    // 2. ANATOMICAL TORSO, HUNCHED BACK, PELVIS, BELT & KINO-STYLE CROSS HARNESS STRAPS
    const body = new THREE.Mesh(this.enemyTorsoGeo, mats.armor);
    body.position.set(0, 1.16, 0.04);
    body.rotation.x = 0.16; // Menacing zombie/orc forward hunch!

    const hunch = new THREE.Mesh(this.enemyHunchGeo, mats.skin);
    hunch.position.set(0, 0.18, -0.08);
    hunch.scale.set(1.15, 0.85, 0.95);

    const pelvis = new THREE.Mesh(this.enemyPelvisGeo, mats.cloth);
    pelvis.position.set(0, -0.34, -0.02);

    const belt = new THREE.Mesh(this.enemyBeltGeo, this.leatherMat);
    belt.position.set(0, -0.24, 0);
    const buckle = new THREE.Mesh(this.enemyBuckleGeo, this.goldMat);
    buckle.position.set(0, -0.24, 0.25);

    // Cross-Chest Harness Straps (just like the zombie harness in the Kino der Toten screenshot!)
    const strap1 = new THREE.Mesh(this.enemyStrapGeo, this.leatherMat);
    strap1.rotation.z = 0.58;
    strap1.position.set(0, 0.02, 0.02);
    const strap2 = new THREE.Mesh(this.enemyStrapGeo, this.leatherMat);
    strap2.rotation.z = -0.58;
    strap2.position.set(0, 0.02, 0.02);

    // Armored Hip Tassets
    const tassetL = new THREE.Mesh(this.enemyTassetGeo, mats.armor);
    tassetL.position.set(-0.22, -0.38, 0.14);
    tassetL.rotation.z = 0.2;
    const tassetR = new THREE.Mesh(this.enemyTassetGeo, mats.armor);
    tassetR.position.set(0.22, -0.38, 0.14);
    tassetR.rotation.z = -0.2;

    // Spiked Shoulder Pauldrons
    const pauldronL = new THREE.Mesh(this.enemyPauldronGeo, mats.armor);
    pauldronL.position.set(-0.37, 0.26, 0);
    pauldronL.rotation.z = 0.35;
    const pauldronR = new THREE.Mesh(this.enemyPauldronGeo, mats.armor);
    pauldronR.position.set(0.37, 0.26, 0);
    pauldronR.rotation.z = -0.35;

    if (type !== 'goblin') {
      const spikeL = new THREE.Mesh(this.enemySpikeGeo, this.steelMat);
      spikeL.position.set(-0.06, 0.22, 0);
      spikeL.rotation.z = 0.35;
      pauldronL.add(spikeL);

      const spikeR = new THREE.Mesh(this.enemySpikeGeo, this.steelMat);
      spikeR.position.set(0.06, 0.22, 0);
      spikeR.rotation.z = -0.35;
      pauldronR.add(spikeR);
    }

    body.add(
      hunch,
      pelvis,
      belt,
      buckle,
      strap1,
      strap2,
      tassetL,
      tassetR,
      pauldronL,
      pauldronR
    );

    // 3. SCULPTED HEAD (Cranium + Heavy Brow + Fanged Jaw + Pointed Ears + Helmet + Blazing Eyes)
    const head = new THREE.Mesh(this.enemyHeadGeo, mats.skin);
    head.position.set(0, 1.72, 0.14);

    const jaw = new THREE.Mesh(this.enemyJawGeo, mats.skin);
    jaw.position.set(0, -0.11, 0.05);
    const brow = new THREE.Mesh(this.enemyBrowGeo, mats.skin);
    brow.position.set(0, 0.07, 0.15);

    // Lower Fangs/Tusks
    const fangL = new THREE.Mesh(this.enemyFangGeo, this.boneMat);
    fangL.position.set(-0.065, 0.06, 0.1);
    const fangR = new THREE.Mesh(this.enemyFangGeo, this.boneMat);
    fangR.position.set(0.065, 0.06, 0.1);
    jaw.add(fangL, fangR);

    // Pointed Ears
    const earL = new THREE.Mesh(this.enemyEarGeo, mats.skin);
    earL.position.set(-0.22, 0.0, -0.02);
    earL.rotation.z = Math.PI / 2.6;
    const earR = new THREE.Mesh(this.enemyEarGeo, mats.skin);
    earR.position.set(0.22, 0.0, -0.02);
    earR.rotation.z = -Math.PI / 2.6;

    // Forged Iron Helmet + Nasal Guard
    const helmet = new THREE.Mesh(this.enemyHelmetGeo, mats.armor);
    helmet.position.y = 0.02;
    const noseGuard = new THREE.Mesh(this.enemyNoseGuardGeo, mats.armor);
    noseGuard.position.set(0, 0.02, 0.22);
    helmet.add(noseGuard);

    if (type === 'uruk') {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.42), mats.armor);
      crest.position.set(0, 0.24, 0);
      helmet.add(crest);
    }

    // Blazing Orange/Yellow Eyes + Additive Glow Halo (Exact Kino der Toten Zombie Eye Glow!)
    const eyeL = new THREE.Mesh(this.enemyEyeGeo, mats.eye);
    eyeL.position.set(-0.078, 0.025, 0.185);
    const eyeR = new THREE.Mesh(this.enemyEyeGeo, mats.eye);
    eyeR.position.set(0.078, 0.025, 0.185);

    const haloL = new THREE.Mesh(this.enemyEyeHaloGeo, mats.eyeHalo);
    haloL.position.set(-0.078, 0.025, 0.21);
    const haloR = new THREE.Mesh(this.enemyEyeHaloGeo, mats.eyeHalo);
    haloR.position.set(0.078, 0.025, 0.21);

    head.add(jaw, brow, earL, earR, helmet, eyeL, eyeR, haloL, haloR);

    // 4. ARTICULATED ARMS WITH BENT FOREARMS, BRACERS, CLAWED HANDS & JAGGED CLEAVER
    const buildArm = (isLeft: boolean): THREE.Mesh => {
      const side = isLeft ? -1 : 1;
      const upperArm = new THREE.Mesh(this.enemyUpperArmGeo, mats.skin);
      upperArm.position.set(side * 0.42, 1.38, 0.12);
      upperArm.rotation.x = -Math.PI / 2.6;
      upperArm.rotation.z = side * 0.14;

      // Forearm bent forward & slightly inward like a lunging zombie/orc
      const forearm = new THREE.Mesh(this.enemyForearmGeo, mats.armor);
      forearm.position.set(0, -0.32, 0.08);
      forearm.rotation.x = -0.42;
      forearm.rotation.z = -side * 0.18;

      const hand = new THREE.Mesh(this.enemyHandGeo, mats.skin);
      hand.position.set(0, -0.22, 0.02);

      // 3 Spread Claws/Fingers per hand reaching toward the player
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(this.enemyClawGeo, this.boneMat);
        claw.position.set(c * 0.03, -0.08, 0.03);
        claw.rotation.x = Math.PI * 0.82;
        hand.add(claw);
      }

      if (!isLeft && type !== 'goblin') {
        // Forged Jagged Orc Cleaver / Scimitar in right hand
        const weaponGroup = new THREE.Group();
        weaponGroup.position.set(0, -0.06, 0.04);
        weaponGroup.rotation.x = Math.PI / 2.2;

        const hilt = new THREE.Mesh(this.enemyHiltGeo, this.darkWoodMat);
        const blade = new THREE.Mesh(this.enemyCleaverBladeGeo, this.bladeMat);
        blade.position.set(0, 0.36, 0.03);
        const bladeTip = new THREE.Mesh(this.enemyCleaverTipGeo, this.bladeMat);
        bladeTip.scale.set(0.3, 1, 1.2);
        bladeTip.position.set(0, 0.72, 0.04);

        weaponGroup.add(hilt, blade, bladeTip);
        hand.add(weaponGroup);
      }

      forearm.add(hand);
      upperArm.add(forearm);
      return upperArm;
    };

    const leftArm = buildArm(true);
    const rightArm = buildArm(false);

    // 5. FLOATING HEALTH BAR
    const hpBg = new THREE.Mesh(this.enemyHpBgGeo, this.hpBgMat);
    hpBg.position.set(0, 2.24, 0);

    const hpFill = new THREE.Mesh(this.enemyHpFillGeo, this.hpFillMat);
    hpFill.position.set(0, 2.24, 0.01);

    group.add(leftLeg, rightLeg, body, head, leftArm, rightArm, hpBg, hpFill);
    group.scale.setScalar(scale);

    return { group, head, body, leftArm, rightArm, leftLeg, rightLeg, hpFill };
  }

  // ===========================================================================
  // SCULPTED FIRST-PERSON WEAPON MODELS & COD ZOMBIES PACK-A-PUNCH FLUORESCENT CAMO
  // ===========================================================================
  private stringMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  private leatherMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.65,
    metalness: 0.1
  });
  private gloveMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.55,
    metalness: 0.25
  });
  private featherMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.5,
    side: THREE.DoubleSide
  });

  // Procedural Animated CoD Zombies Pack-a-Punch Fluorescent Textures & Materials
  private papPrimaryTex: THREE.CanvasTexture | null = null;
  private papSecondaryTex: THREE.CanvasTexture | null = null;
  private papBodyMat: THREE.MeshStandardMaterial | null = null;
  private papTrimMat: THREE.MeshStandardMaterial | null = null;
  private papAnimClock = 0;

  private activeRig: {
    weaponType: 'bow' | 'crossbow' | 'staff';
    isUpgraded: boolean;
    assembly: THREE.Group;
    stringTop?: THREE.Mesh;
    stringBottom?: THREE.Mesh;
    arrowGroup?: THREE.Group;
    crystalOrb?: THREE.Object3D;
    crownRing?: THREE.Object3D;
    papSpinRings: THREE.Object3D[];
    papLight?: THREE.PointLight;
    topTip: THREE.Vector3;
    bottomTip: THREE.Vector3;
    restNockZ: number;
  } | null = null;

  private ensurePackAPunchMaterials(accentHex: number): {
    bodyMat: THREE.MeshStandardMaterial;
    trimMat: THREE.MeshStandardMaterial;
    auraMat: THREE.MeshBasicMaterial;
  } {
    if (!this.papPrimaryTex) {
      // 1. Primary Fluorescent Damascus Lava / Dark Aether & Runes Texture (512x512 seamless)
      const c1 = document.createElement('canvas');
      c1.width = 512;
      c1.height = 512;
      const ctx1 = c1.getContext('2d')!;

      // Deep cosmic obsidian base so fluorescent veins pop with extreme contrast
      const bgGrad = ctx1.createLinearGradient(0, 0, 512, 512);
      bgGrad.addColorStop(0, '#090214');
      bgGrad.addColorStop(0.5, '#16072c');
      bgGrad.addColorStop(1, '#090214');
      ctx1.fillStyle = bgGrad;
      ctx1.fillRect(0, 0, 512, 512);

      // Multi-layered fluorescent Damascus plasma waves (Magenta, Cyan, Electric Violet, Solar Gold)
      const wavePalette = [
        { color: '#ff1cf7', glow: '#f0abfc', width: 7 },
        { color: '#00f5ff', glow: '#38bdf8', width: 5.5 },
        { color: '#c084fc', glow: '#a855f7', width: 6 },
        { color: '#fde047', glow: '#facc15', width: 4 }
      ];

      ctx1.lineCap = 'round';
      for (let i = 0; i < 28; i++) {
        const pal = wavePalette[i % wavePalette.length];
        const baseY = (i / 28) * 512;
        ctx1.save();
        ctx1.strokeStyle = pal.color;
        ctx1.shadowColor = pal.glow;
        ctx1.shadowBlur = 16;
        ctx1.lineWidth = pal.width;
        ctx1.beginPath();
        for (let x = 0; x <= 512; x += 16) {
          const rad1 = (x / 512) * Math.PI * 4 + i * 0.7;
          const rad2 = (x / 512) * Math.PI * 8 - i * 0.4;
          const y = (baseY + Math.sin(rad1) * 28 + Math.cos(rad2) * 14 + 512) % 512;
          if (x === 0) ctx1.moveTo(x, y);
          else ctx1.lineTo(x, y);
        }
        ctx1.stroke();

        // White-hot core filament inside every 2nd vein
        if (i % 2 === 0) {
          ctx1.strokeStyle = '#ffffff';
          ctx1.shadowBlur = 6;
          ctx1.lineWidth = 1.6;
          ctx1.stroke();
        }
        ctx1.restore();
      }

      // Glowing Celebrimbor Star-Runes & Arcane Circuit Nodes
      ctx1.save();
      ctx1.strokeStyle = '#ffffff';
      ctx1.fillStyle = '#00f5ff';
      ctx1.shadowColor = '#00f5ff';
      ctx1.shadowBlur = 18;
      ctx1.lineWidth = 2.4;
      for (let rx = 64; rx < 512; rx += 128) {
        for (let ry = 64; ry < 512; ry += 128) {
          ctx1.beginPath();
          ctx1.moveTo(rx, ry - 22);
          ctx1.lineTo(rx + 18, ry);
          ctx1.lineTo(rx, ry + 22);
          ctx1.lineTo(rx - 18, ry);
          ctx1.closePath();
          ctx1.stroke();

          ctx1.beginPath();
          ctx1.arc(rx, ry, 5, 0, Math.PI * 2);
          ctx1.fill();
        }
      }
      ctx1.restore();

      const tex1 = new THREE.CanvasTexture(c1);
      tex1.wrapS = THREE.RepeatWrapping;
      tex1.wrapT = THREE.RepeatWrapping;
      tex1.repeat.set(2.2, 2.2);
      tex1.colorSpace = THREE.SRGBColorSpace;
      this.papPrimaryTex = tex1;

      // 2. Secondary Fluorescent Cyber-Runic Trim Texture (256x256 seamless)
      const c2 = document.createElement('canvas');
      c2.width = 256;
      c2.height = 256;
      const ctx2 = c2.getContext('2d')!;
      ctx2.fillStyle = '#0c0620';
      ctx2.fillRect(0, 0, 256, 256);

      const stripeColors = ['#00f5ff', '#ff1cf7', '#fde047', '#ffffff'];
      for (let s = 0; s < 16; s++) {
        const y = s * 16;
        ctx2.save();
        ctx2.strokeStyle = stripeColors[s % stripeColors.length];
        ctx2.shadowColor = stripeColors[s % stripeColors.length];
        ctx2.shadowBlur = 12;
        ctx2.lineWidth = s % 2 === 0 ? 4.5 : 2.5;
        ctx2.beginPath();
        ctx2.moveTo(0, y);
        ctx2.lineTo(256, (y + 64) % 256);
        ctx2.stroke();
        ctx2.restore();
      }

      const tex2 = new THREE.CanvasTexture(c2);
      tex2.wrapS = THREE.RepeatWrapping;
      tex2.wrapT = THREE.RepeatWrapping;
      tex2.repeat.set(3, 3);
      tex2.colorSpace = THREE.SRGBColorSpace;
      this.papSecondaryTex = tex2;

      this.papBodyMat = new THREE.MeshStandardMaterial({
        map: this.papPrimaryTex,
        emissiveMap: this.papPrimaryTex,
        emissive: new THREE.Color(0xf0abfc),
        emissiveIntensity: 2.35,
        normalMap: this.rockMat.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        metalness: 0.86,
        roughness: 0.14,
        color: 0xffffff
      });

      this.papTrimMat = new THREE.MeshStandardMaterial({
        map: this.papSecondaryTex,
        emissiveMap: this.papSecondaryTex,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 2.1,
        metalness: 0.94,
        roughness: 0.1,
        color: 0xffffff
      });
    }

    // Tint the emissive channel toward the weapon's signature upgraded projectile color while preserving fluorescence
    const accentColor = new THREE.Color(accentHex);
    const blendedBodyEmissive = new THREE.Color(0xe879f9).lerp(accentColor, 0.45);
    this.papBodyMat!.emissive.copy(blendedBodyEmissive);

    const auraMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    return {
      bodyMat: this.papBodyMat!,
      trimMat: this.papTrimMat!,
      auraMat
    };
  }

  populateWeaponViewModel(viewModelGroup: THREE.Group, weapon: WeaponConfig): void {
    while (viewModelGroup.children.length > 0) {
      viewModelGroup.remove(viewModelGroup.children[0]);
    }

    const isUpgraded = weapon.isUpgraded;
    const glowColor = isUpgraded ? weapon.upgradedProjectileColor : weapon.projectileColor;
    const glowMat = new THREE.MeshBasicMaterial({ color: glowColor });
    const whiteHotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const papMats = isUpgraded ? this.ensurePackAPunchMaterials(glowColor) : null;
    const metalMat = isUpgraded ? papMats!.trimMat : this.steelMat;
    const trimMat = isUpgraded ? papMats!.trimMat : this.goldMat;
    const papSpinRings: THREE.Object3D[] = [];

    const assembly = new THREE.Group();
    viewModelGroup.add(assembly);

    // First-person fluorescent point light when Pack-a-Punched so the weapon illuminates the player & cavern walls
    let papLight: THREE.PointLight | undefined;
    if (isUpgraded) {
      papLight = new THREE.PointLight(glowColor, 2.2, 4.2);
      papLight.position.set(0, 0.08, -0.25);
      assembly.add(papLight);
    }

    if (weapon.id === 'anor_staff' || weapon.id === 'durin_thunder') {
      // =======================================================================
      // WIZARD STAFF / RUNIC THUNDER STAFF
      // =======================================================================
      const shaftCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.5, 0.22),
        new THREE.Vector3(0.01, -0.15, 0.04),
        new THREE.Vector3(-0.01, 0.18, -0.16),
        new THREE.Vector3(0, 0.36, -0.32)
      ]);
      const shaftGeo = new THREE.TubeGeometry(shaftCurve, 20, 0.024, 10, false);
      const shaft = new THREE.Mesh(
        shaftGeo,
        isUpgraded ? papMats!.bodyMat : this.darkWoodMat
      );

      const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.0065, 6, 14), trimMat);
      band1.position.set(0, 0.02, -0.06);
      band1.rotation.x = Math.PI / 3;
      const band2 = band1.clone();
      band2.position.set(0, 0.24, -0.21);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.4, -0.36);

      const prongCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.05, 0.04),
        new THREE.Vector3(-0.09, 0.04, 0),
        new THREE.Vector3(-0.05, 0.16, -0.04)
      ]);
      const prongCurveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.05, 0.04),
        new THREE.Vector3(0.09, 0.04, 0),
        new THREE.Vector3(0.05, 0.16, -0.04)
      ]);
      const prongL = new THREE.Mesh(
        new THREE.TubeGeometry(prongCurveL, 12, 0.013, 8, false),
        metalMat
      );
      const prongR = new THREE.Mesh(
        new THREE.TubeGeometry(prongCurveR, 12, 0.013, 8, false),
        metalMat
      );

      const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.0085, 8, 22), trimMat);
      crownRing.position.y = 0.06;

      const crystalOrb = new THREE.Mesh(
        new THREE.OctahedronGeometry(isUpgraded ? 0.074 : 0.062, 2),
        glowMat
      );
      crystalOrb.position.y = 0.06;

      headGroup.add(prongL, prongR, crownRing, crystalOrb);

      if (isUpgraded) {
        // Inner white-hot core + 2 extra gyroscopic fluorescent plasma rings around the staff head
        const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 1), whiteHotMat);
        innerCore.position.y = 0.06;
        const gyroRing1 = new THREE.Mesh(
          new THREE.TorusGeometry(0.115, 0.006, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0x00f5ff })
        );
        gyroRing1.position.y = 0.06;
        gyroRing1.rotation.x = Math.PI / 3;
        const gyroRing2 = new THREE.Mesh(
          new THREE.TorusGeometry(0.135, 0.005, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xff1cf7 })
        );
        gyroRing2.position.y = 0.06;
        gyroRing2.rotation.y = Math.PI / 3;
        const orbHalo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), papMats!.auraMat);
        orbHalo.position.y = 0.06;

        headGroup.add(innerCore, gyroRing1, gyroRing2, orbHalo);
        papSpinRings.push(gyroRing1, gyroRing2);

        // Fluorescent energy rings wrapping along the staff shaft
        for (let c = 0; c < 4; c++) {
          const coil = new THREE.Mesh(
            new THREE.TorusGeometry(0.033, 0.004, 6, 16),
            c % 2 === 0 ? glowMat : new THREE.MeshBasicMaterial({ color: 0x00f5ff })
          );
          const t = 0.25 + c * 0.18;
          const pt = shaftCurve.getPoint(t);
          coil.position.copy(pt);
          coil.rotation.x = Math.PI / 2.8;
          assembly.add(coil);
          papSpinRings.push(coil);
        }
      }

      assembly.add(shaft, band1, band2, headGroup);

      this.activeRig = {
        weaponType: 'staff',
        isUpgraded,
        assembly,
        crystalOrb,
        crownRing,
        papSpinRings,
        papLight,
        topTip: new THREE.Vector3(),
        bottomTip: new THREE.Vector3(),
        restNockZ: 0
      };
    } else if (weapon.id === 'erebor_crossbow' || weapon.id === 'mithril_repeater') {
      // =======================================================================
      // DWARVEN HEAVY ARBALEST OF EREBOR / REPETIDORA DE MITHRIL
      // =======================================================================
      const isMithril = weapon.id === 'mithril_repeater';
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.068, 0.095, 0.78),
        isUpgraded ? papMats!.bodyMat : isMithril ? this.steelMat : this.darkWoodMat
      );
      const barrelRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.048, 0.032, 0.76),
        isUpgraded ? papMats!.trimMat : isMithril ? this.goldMat : metalMat
      );
      barrelRail.position.set(0, 0.038, -0.02);

      // Metallic Cooling/Reinforcement Ribs (fluorescent plasma coils when Pack-a-Punched!)
      for (let r = 0; r < 5; r++) {
        const ribMat = isUpgraded
          ? r % 2 === 0
            ? glowMat
            : new THREE.MeshBasicMaterial({ color: 0x00f5ff })
          : trimMat;
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(isUpgraded ? 0.054 : 0.048, isUpgraded ? 0.0085 : 0.007, 6, 14),
          ribMat
        );
        rib.position.set(0, 0.01, -0.06 - r * 0.065);
        assembly.add(rib);
        if (isUpgraded) {
          papSpinRings.push(rib);
        }
      }

      if (isMithril || isUpgraded) {
        // Side-offset Revolving Drum Magazine with glowing runic bands
        const drumMag = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.036, 0.16, 10),
          isUpgraded ? papMats!.bodyMat : this.goldMat
        );
        drumMag.rotation.x = Math.PI / 2;
        drumMag.position.set(0.046, 0.045, -0.08);
        const drumRune = new THREE.Mesh(
          new THREE.TorusGeometry(0.039, 0.005, 6, 14),
          glowMat
        );
        drumRune.position.set(0.046, 0.045, -0.08);
        assembly.add(drumMag, drumRune);
        if (isUpgraded) {
          papSpinRings.push(drumRune);
        }
      }

      // Glowing Circular Iron Sight Ring on top of Crossbow
      const sightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.045, 6), metalMat);
      sightPost.position.set(0, 0.07, -0.22);
      const sightRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.022, 0.0032, 6, 16),
        isUpgraded ? glowMat : metalMat
      );
      sightRing.position.set(0, 0.1, -0.22);
      const sightCross = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.003, 0.003), glowMat);
      sightCross.position.set(0, 0.1, -0.22);
      const sightVert = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.018, 0.003), glowMat);
      sightVert.position.set(0, 0.1, -0.22);

      assembly.add(stock, barrelRail, sightPost, sightRing, sightCross, sightVert);

      const leftProdCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.035, -0.36),
        new THREE.Vector3(-0.16, 0.035, -0.39),
        new THREE.Vector3(-0.28, 0.035, -0.32),
        new THREE.Vector3(-0.34, 0.035, -0.25)
      ]);
      const rightProdCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.035, -0.36),
        new THREE.Vector3(0.16, 0.035, -0.39),
        new THREE.Vector3(0.28, 0.035, -0.32),
        new THREE.Vector3(0.34, 0.035, -0.25)
      ]);
      const prodMat = isUpgraded ? papMats!.bodyMat : isMithril ? this.goldMat : metalMat;
      const leftLimb = new THREE.Mesh(
        new THREE.TubeGeometry(leftProdCurve, 12, 0.021, 8, false),
        prodMat
      );
      const rightLimb = new THREE.Mesh(
        new THREE.TubeGeometry(rightProdCurve, 12, 0.021, 8, false),
        prodMat
      );
      assembly.add(leftLimb, rightLimb);

      if (isMithril || isUpgraded) {
        const auxMat = isUpgraded ? papMats!.trimMat : this.goldMat;
        const upperLeftLimb = new THREE.Mesh(
          new THREE.TubeGeometry(leftProdCurve, 12, 0.015, 8, false),
          auxMat
        );
        upperLeftLimb.scale.set(0.78, 0.78, 0.78);
        upperLeftLimb.position.set(0, 0.032, -0.06);
        const upperRightLimb = new THREE.Mesh(
          new THREE.TubeGeometry(rightProdCurve, 12, 0.015, 8, false),
          auxMat
        );
        upperRightLimb.scale.set(0.78, 0.78, 0.78);
        upperRightLimb.position.set(0, 0.032, -0.06);
        assembly.add(upperLeftLimb, upperRightLimb);
      }

      if (isUpgraded) {
        // Glowing fluorescent plasma veins along the stock sides & front muzzle core
        const sideVeinGeo = new THREE.BoxGeometry(0.004, 0.018, 0.68);
        const veinL = new THREE.Mesh(sideVeinGeo, glowMat);
        veinL.position.set(-0.036, 0.01, -0.02);
        const veinR = new THREE.Mesh(sideVeinGeo, glowMat);
        veinR.position.set(0.036, 0.01, -0.02);

        const muzzleHalo = new THREE.Mesh(
          new THREE.TorusGeometry(0.044, 0.005, 8, 18),
          new THREE.MeshBasicMaterial({ color: 0xff1cf7 })
        );
        muzzleHalo.position.set(0, 0.038, -0.39);
        assembly.add(veinL, veinR, muzzleHalo);
        papSpinRings.push(muzzleHalo);
      }

      const strRadius = isUpgraded ? 0.0042 : 0.003;
      const cylGeo = new THREE.CylinderGeometry(strRadius, strRadius, 1, 6);
      const activeStringMat = isUpgraded ? glowMat : this.stringMat;
      const stringL = new THREE.Mesh(cylGeo, activeStringMat);
      const stringR = new THREE.Mesh(cylGeo, activeStringMat);
      assembly.add(stringL, stringR);

      const boltGroup = this.buildDetailedArrowOrBolt(
        0.46,
        glowMat,
        metalMat,
        isUpgraded,
        papMats?.auraMat
      );
      boltGroup.position.set(0, 0.055, -0.05);
      assembly.add(boltGroup);

      this.activeRig = {
        weaponType: 'crossbow',
        isUpgraded,
        assembly,
        stringTop: stringL,
        stringBottom: stringR,
        arrowGroup: boltGroup,
        papSpinRings,
        papLight,
        topTip: new THREE.Vector3(-0.34, 0.035, -0.25),
        bottomTip: new THREE.Vector3(0.34, 0.035, -0.25),
        restNockZ: -0.05
      };

      this.updateBowstringAndArrow(0, 1);
    } else {
      // =======================================================================
      // RECURVE ELVEN BOW OF LOTHLÓRIEN / BLACK BOW OF BARD
      // =======================================================================
      const isBlackBow = weapon.id === 'bard_black_bow';
      const limbMat = isUpgraded
        ? papMats!.bodyMat
        : isBlackBow
        ? this.ironMat
        : this.woodMat;

      // 1. Sleek Ergonomic Riser + Gloved Hand Grip + Illuminated Elven Ring Sight
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.017, 0.13, 12),
        isUpgraded ? papMats!.trimMat : this.leatherMat
      );
      grip.position.set(0, -0.01, -0.01);

      // Compact Gloved Archer Hand wrapping the grip
      const glovePalm = new THREE.Mesh(
        new THREE.BoxGeometry(0.034, 0.072, 0.042),
        this.gloveMat
      );
      glovePalm.position.set(-0.006, -0.015, -0.008);
      const gloveCuff = new THREE.Mesh(
        new THREE.TorusGeometry(0.022, 0.004, 6, 10),
        isUpgraded ? glowMat : trimMat
      );
      gloveCuff.position.set(0, -0.052, -0.01);
      gloveCuff.rotation.x = Math.PI / 2;

      const riserCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.11, -0.01),
        new THREE.Vector3(0, -0.04, -0.01),
        new THREE.Vector3(0.015, 0.03, -0.012),
        new THREE.Vector3(0.013, 0.09, -0.012),
        new THREE.Vector3(0, 0.13, -0.015)
      ]);
      const riserBody = new THREE.Mesh(
        new THREE.TubeGeometry(riserCurve, 16, 0.0135, 10, false),
        trimMat
      );

      // Delicate Golden Arrow Rest + Illuminated Elven Sight Ring on inner-left sight window
      const arrowRest = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.005, 0.032), trimMat);
      arrowRest.position.set(-0.009, 0.022, -0.012);

      const sightRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.016, 0.0024, 6, 16),
        isUpgraded ? glowMat : trimMat
      );
      sightRing.position.set(-0.024, 0.042, -0.02);
      const sightPin = new THREE.Mesh(
        new THREE.SphereGeometry(isUpgraded ? 0.0045 : 0.0035, 6, 6),
        isUpgraded ? whiteHotMat : glowMat
      );
      sightPin.position.set(-0.024, 0.042, -0.02);

      assembly.add(grip, glovePalm, gloveCuff, riserBody, arrowRest, sightRing, sightPin);

      // 2. Graceful S-Curved Recurve Upper & Lower Limbs
      const upperCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.12, -0.015),
        new THREE.Vector3(0, 0.22, -0.052),
        new THREE.Vector3(0, 0.30, 0.01),
        new THREE.Vector3(0, 0.35, 0.065)
      ]);
      const lowerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.10, -0.01),
        new THREE.Vector3(0, -0.21, -0.052),
        new THREE.Vector3(0, -0.29, 0.01),
        new THREE.Vector3(0, -0.35, 0.065)
      ]);

      const upperLimb = new THREE.Mesh(
        new THREE.TubeGeometry(upperCurve, 18, 0.012, 10, false),
        limbMat
      );
      const lowerLimb = new THREE.Mesh(
        new THREE.TubeGeometry(lowerCurve, 18, 0.012, 10, false),
        limbMat
      );
      assembly.add(upperLimb, lowerLimb);

      // Decorative Elven Limb Tips & Glowing Runic Filigree
      const tipGeo = new THREE.ConeGeometry(0.013, 0.044, 8);
      const topTipMesh = new THREE.Mesh(tipGeo, isUpgraded ? glowMat : trimMat);
      topTipMesh.position.set(0, 0.362, 0.074);
      topTipMesh.rotation.x = 0.52;

      const botTipMesh = new THREE.Mesh(tipGeo, isUpgraded ? glowMat : trimMat);
      botTipMesh.position.set(0, -0.362, 0.074);
      botTipMesh.rotation.x = Math.PI - 0.52;

      const runeInlayTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.006, 0.14, 0.01),
        glowMat
      );
      runeInlayTop.position.set(-0.011, 0.20, -0.036);
      const runeInlayBot = runeInlayTop.clone();
      runeInlayBot.position.set(-0.011, -0.20, -0.036);

      assembly.add(topTipMesh, botTipMesh, runeInlayTop, runeInlayBot);

      if (isUpgraded) {
        // Pack-a-Punch Fluorescent Energy Filaments & Spinning Runic Halos along Bow Limbs
        const neonArcMat = new THREE.MeshBasicMaterial({
          color: 0x00f5ff,
          transparent: true,
          opacity: 0.85
        });
        const upperNeonArc = new THREE.Mesh(
          new THREE.TubeGeometry(upperCurve, 18, 0.0045, 6, false),
          neonArcMat
        );
        upperNeonArc.position.set(-0.01, 0, -0.014);
        const lowerNeonArc = new THREE.Mesh(
          new THREE.TubeGeometry(lowerCurve, 18, 0.0045, 6, false),
          neonArcMat
        );
        lowerNeonArc.position.set(-0.01, 0, -0.014);
        assembly.add(upperNeonArc, lowerNeonArc);

        // Orbiting fluorescent runic rings at upper/lower limb midpoints & arrow rest
        [0.18, -0.18].forEach((ry, idx) => {
          const limbHalo = new THREE.Mesh(
            new THREE.TorusGeometry(0.024, 0.0032, 6, 16),
            idx === 0 ? glowMat : new THREE.MeshBasicMaterial({ color: 0xff1cf7 })
          );
          limbHalo.position.set(0, ry, -0.038);
          limbHalo.rotation.x = Math.PI / 2.2;
          assembly.add(limbHalo);
          papSpinRings.push(limbHalo);
        });
      }

      // 3. Real 3D Animated Bowstring (Fluorescent Laser Bowstring when Pack-a-Punched!)
      const strRadius = isUpgraded ? 0.0034 : 0.0022;
      const strGeo = new THREE.CylinderGeometry(strRadius, strRadius, 1, 6);
      const activeStringMat = isUpgraded ? glowMat : this.stringMat;
      const stringTop = new THREE.Mesh(strGeo, activeStringMat);
      const stringBottom = new THREE.Mesh(strGeo, activeStringMat);
      assembly.add(stringTop, stringBottom);

      // 4. Detailed Nocked Arrow
      const arrowGroup = this.buildDetailedArrowOrBolt(
        0.64,
        glowMat,
        metalMat,
        isUpgraded,
        papMats?.auraMat
      );
      arrowGroup.position.set(-0.016, 0.03, 0.068);
      assembly.add(arrowGroup);

      this.activeRig = {
        weaponType: 'bow',
        isUpgraded,
        assembly,
        stringTop,
        stringBottom,
        arrowGroup,
        papSpinRings,
        papLight,
        topTip: new THREE.Vector3(0, 0.35, 0.065),
        bottomTip: new THREE.Vector3(0, -0.35, 0.065),
        restNockZ: 0.068
      };

      this.updateBowstringAndArrow(0, 1);
    }

    viewModelGroup.position.set(0.28, -0.18, -0.58);
  }

  private buildDetailedArrowOrBolt(
    length: number,
    glowMat: THREE.Material,
    metalMat: THREE.Material,
    isUpgraded = false,
    auraMat?: THREE.Material
  ): THREE.Group {
    const arrowGroup = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(
        isUpgraded ? 0.0062 : 0.005,
        isUpgraded ? 0.007 : 0.006,
        length,
        8
      ),
      isUpgraded ? glowMat : this.woodMat
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -length / 2;
    arrowGroup.add(shaft);

    const nockCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.0055, 0.022, 8),
      isUpgraded ? glowMat : this.goldMat
    );
    nockCap.rotation.x = Math.PI / 2;
    nockCap.position.z = -0.011;
    arrowGroup.add(nockCap);

    const featherGeo = new THREE.BoxGeometry(0.0022, 0.022, 0.095);
    const activeFeatherMat = isUpgraded
      ? new THREE.MeshBasicMaterial({ color: 0x00f5ff, side: THREE.DoubleSide })
      : this.featherMat;
    for (let i = 0; i < 3; i++) {
      const vanePivot = new THREE.Group();
      vanePivot.position.z = -0.065;
      vanePivot.rotation.z = (i * Math.PI * 2) / 3;

      const vane = new THREE.Mesh(featherGeo, activeFeatherMat);
      vane.position.y = 0.011;
      vane.rotation.x = -0.07;
      vanePivot.add(vane);
      arrowGroup.add(vanePivot);
    }

    const runeCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0095, 0.008, 0.042, 8),
      glowMat
    );
    runeCollar.rotation.x = Math.PI / 2;
    runeCollar.position.z = -length + 0.022;
    arrowGroup.add(runeCollar);

    const broadhead = new THREE.Mesh(
      new THREE.ConeGeometry(isUpgraded ? 0.024 : 0.018, isUpgraded ? 0.095 : 0.075, 4),
      isUpgraded ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : metalMat
    );
    broadhead.rotation.x = -Math.PI / 2;
    broadhead.scale.set(1.3, 0.45, 1.0);
    broadhead.position.z = -length - 0.032;
    arrowGroup.add(broadhead);

    if (isUpgraded) {
      // Blazing Plasma Tip Halo + Energy Ring around the nocked arrow/bolt
      const tipGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.022, 1),
        auraMat ?? glowMat
      );
      tipGem.position.z = -length - 0.025;
      const tipRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.026, 0.0035, 6, 14),
        new THREE.MeshBasicMaterial({ color: 0xff1cf7 })
      );
      tipRing.position.z = -length + 0.01;
      arrowGroup.add(tipGem, tipRing);
    }

    return arrowGroup;
  }

  private updateBowstringAndArrow(drawDistance: number, arrowNockProgress: number): void {
    if (!this.activeRig) return;
    const rig = this.activeRig;

    if (rig.weaponType === 'bow' || rig.weaponType === 'crossbow') {
      const isBow = rig.weaponType === 'bow';
      const nockX = isBow ? -0.016 : 0;
      const nockY = isBow ? 0.03 : 0.055;
      const nockZ = rig.restNockZ + drawDistance;
      const nockPos = new THREE.Vector3(nockX, nockY, nockZ);

      if (rig.stringTop && rig.stringBottom) {
        this.alignStringSegment(rig.stringTop, rig.topTip, nockPos);
        this.alignStringSegment(rig.stringBottom, rig.bottomTip, nockPos);
      }

      if (rig.arrowGroup) {
        if (arrowNockProgress <= 0.05) {
          rig.arrowGroup.visible = false;
        } else {
          rig.arrowGroup.visible = true;
          const t = Math.min(1, (arrowNockProgress - 0.05) / 0.95);
          const easeOut = 1 - Math.pow(1 - t, 3);
          const dipX = (1 - easeOut) * 0.12;
          const dipY = (1 - easeOut) * -0.24;
          const dipZ = (1 - easeOut) * 0.14;
          const dipRotX = (1 - easeOut) * -0.42;
          const dipRotY = (1 - easeOut) * -0.28;

          rig.arrowGroup.position.set(nockX + dipX, nockY + dipY, nockZ + dipZ);
          rig.arrowGroup.rotation.set(dipRotX, (isBow ? 0.06 : 0) + dipRotY, 0);
        }
      }
    }
  }

  private alignStringSegment(
    mesh: THREE.Mesh,
    start: THREE.Vector3,
    end: THREE.Vector3
  ): void {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    mesh.position.copy(mid);
    mesh.scale.set(1, Math.max(0.001, len), 1);
    if (len > 0.0001) {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    }
  }

  updateWeaponAnim(
    viewModelGroup: THREE.Group,
    state: {
      dt: number;
      walkBobTimer: number;
      isSprinting: boolean;
      isAiming: boolean;
      aimBlend: number;
      recoil: number;
      drawDistance: number;
      arrowNockProgress: number;
      isReloading: boolean;
      reloadProgress: number;
      switchPhase?: 'none' | 'holster' | 'draw';
      switchProgress?: number;
    }
  ): void {
    if (!this.activeRig) return;

    // Animate CoD Zombies Pack-a-Punch Flowing Fluorescent Camo & Spinning Energy Rings
    if (this.activeRig.isUpgraded) {
      this.papAnimClock += state.dt;
      if (this.papPrimaryTex) {
        this.papPrimaryTex.offset.x = (this.papPrimaryTex.offset.x + state.dt * 0.24) % 1;
        this.papPrimaryTex.offset.y = (this.papPrimaryTex.offset.y + state.dt * 0.16) % 1;
      }
      if (this.papSecondaryTex) {
        this.papSecondaryTex.offset.x = (this.papSecondaryTex.offset.x - state.dt * 0.35) % 1;
        this.papSecondaryTex.offset.y = (this.papSecondaryTex.offset.y + state.dt * 0.22) % 1;
      }
      const pulse = 2.15 + Math.sin(this.papAnimClock * 5.2) * 0.55 + state.recoil * 3.5;
      if (this.papBodyMat) {
        this.papBodyMat.emissiveIntensity = pulse;
      }
      if (this.papTrimMat) {
        this.papTrimMat.emissiveIntensity = pulse * 0.92;
      }
      if (this.activeRig.papLight) {
        this.activeRig.papLight.intensity = 2.1 + Math.sin(this.papAnimClock * 6.0) * 0.45 + state.recoil * 4.5;
      }
      this.activeRig.papSpinRings.forEach((ring, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        ring.rotation.z += state.dt * 3.8 * dir;
      });
    }

    // During reload, add a crisp bowstring nock tension snap at 70-90% progress
    let effectiveDraw = state.drawDistance;
    if (state.isReloading) {
      const p = state.reloadProgress / 100;
      if (p > 0.65 && p < 0.92) {
        effectiveDraw += Math.sin(((p - 0.65) / 0.27) * Math.PI) * 0.055;
      }
    }

    this.updateBowstringAndArrow(effectiveDraw, state.arrowNockProgress);

    if (this.activeRig.weaponType === 'staff') {
      if (this.activeRig.crystalOrb) {
        this.activeRig.crystalOrb.rotation.y += state.dt * (state.isAiming ? 6 : 2.5);
        const s = 1 + state.aimBlend * 0.35 + state.recoil * 1.5;
        this.activeRig.crystalOrb.scale.setScalar(s);
      }
      if (this.activeRig.crownRing) {
        this.activeRig.crownRing.rotation.z += state.dt * 1.5;
      }
    }

    const bobScale = state.isAiming ? 0.15 : state.isSprinting ? 1.8 : 1.0;
    const bobX = Math.cos(state.walkBobTimer) * 0.012 * bobScale;
    const bobY = Math.abs(Math.sin(state.walkBobTimer)) * 0.015 * bobScale;

    let hipX = 0.27;
    let hipY = -0.17;
    let hipZ = -0.58;

    let adsX = 0.155;
    let adsY = -0.075;
    let adsZ = -0.52;

    if (this.activeRig.weaponType === 'crossbow') {
      hipX = 0.24;
      hipY = -0.22;
      hipZ = -0.54;
      adsX = 0.0;
      adsY = -0.105;
      adsZ = -0.46;
    } else if (this.activeRig.weaponType === 'staff') {
      hipX = 0.28;
      hipY = -0.26;
      hipZ = -0.56;
      adsX = 0.16;
      adsY = -0.22;
      adsZ = -0.50;
    }

    const baseX = THREE.MathUtils.lerp(hipX, adsX, state.aimBlend);
    const baseY = THREE.MathUtils.lerp(hipY, adsY, state.aimBlend);
    const baseZ = THREE.MathUtils.lerp(hipZ, adsZ, state.aimBlend);

    let reloadOffsetX = 0;
    let reloadOffsetY = 0;
    let reloadOffsetZ = 0;
    let reloadRotZ = 0;
    let reloadRotX = 0;
    let reloadRotY = 0;

    if (state.isReloading) {
      const p = state.reloadProgress / 100;
      // 3-stage tactical archery/crossbow reload choreography:
      // 1) Tilt horizontally to quiver (0..0.35), 2) Nock arrow onto rest (0.35..0.78), 3) Snap back to ready (0.78..1.0)
      const tiltEnvelope = Math.sin(p * Math.PI);
      const nockSnap = p > 0.65 && p < 0.88 ? Math.sin(((p - 0.65) / 0.23) * Math.PI) : 0;

      reloadOffsetX = -tiltEnvelope * 0.075 + nockSnap * 0.02;
      reloadOffsetY = -tiltEnvelope * 0.09 - nockSnap * 0.025;
      reloadOffsetZ = tiltEnvelope * 0.05 + nockSnap * 0.035;
      reloadRotZ = tiltEnvelope * 0.68;
      reloadRotX = -tiltEnvelope * 0.28 + nockSnap * 0.18;
      reloadRotY = tiltEnvelope * 0.22;
    }

    // Weapon Holster ("guardar") & Draw ("sacar") 3D Choreography
    let switchOffsetX = 0;
    let switchOffsetY = 0;
    let switchOffsetZ = 0;
    let switchRotX = 0;
    let switchRotY = 0;
    let switchRotZ = 0;

    const phase = state.switchPhase ?? 'none';
    const sp = Math.max(0, Math.min(1, state.switchProgress ?? 0));

    if (phase === 'holster') {
      // Smooth ease-in drop down toward the belt/back
      const easeIn = sp * sp * (2.2 - 1.2 * sp);
      switchOffsetX = easeIn * 0.085;
      switchOffsetY = -easeIn * 0.46;
      switchOffsetZ = easeIn * 0.11;
      switchRotX = -easeIn * 0.88;
      switchRotY = -easeIn * 0.32;
      switchRotZ = easeIn * 0.54;
    } else if (phase === 'draw') {
      // Smooth ease-out rise from below with a subtle CoD Zombies ready snap at the top
      const easeOut = 1 - Math.pow(1 - sp, 3);
      const inv = 1 - easeOut;
      const readySnap = Math.sin(sp * Math.PI) * (1 - sp) * 0.028;
      switchOffsetX = -inv * 0.075;
      switchOffsetY = -inv * 0.46 + readySnap;
      switchOffsetZ = inv * 0.12;
      switchRotX = -inv * 0.84 + readySnap * 1.6;
      switchRotY = inv * 0.28;
      switchRotZ = -inv * 0.48;
    }

    viewModelGroup.position.set(
      baseX + bobX + reloadOffsetX + switchOffsetX,
      baseY - bobY + reloadOffsetY + switchOffsetY,
      baseZ + reloadOffsetZ + switchOffsetZ + state.recoil * 0.45
    );

    if (this.activeRig.weaponType === 'bow') {
      const cantZ = THREE.MathUtils.lerp(0.18, 0.22, state.aimBlend);
      const yawY = THREE.MathUtils.lerp(0.08, 0.04, state.aimBlend);
      this.activeRig.assembly.rotation.set(
        state.recoil * 0.7 + reloadRotX + switchRotX,
        yawY + reloadRotY + switchRotY,
        cantZ + reloadRotZ + switchRotZ
      );
    } else {
      this.activeRig.assembly.rotation.set(
        state.recoil * 0.7 + reloadRotX + switchRotX,
        reloadRotY + switchRotY,
        reloadRotZ + switchRotZ
      );
    }
  }
}
