/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { GameState, SoulDoll, NPC, Chest, Enemy, InventoryItem, BattleSoul, ItemId, GrassPatch, Signpost, GameSaveData, ActiveDialogue, ResourceNode, WorldBoss } from '../types';
import { buildWorld, getTerrainHeight, TreeData, CollisionBox, FountainData } from '../world/worldGen';
import { ChunkManager, PerformanceProfile, detectPerformanceProfile } from '../world/chunkManager';
import { disposeTextures } from '../world/textureManager';
import { PlayerController } from '../world/playerController';
import { audioManager } from '../audio/audioManager';
import { vfxEngine } from '../core/vfxEngine';
import { createRandomWildSoul } from '../data/mobs';
import { getEncounterTypesForPosition, getRegionAt } from '../data/regions';
import { getDistanceToRiver, RIVER_HALF_WIDTH, isPointOnBridge, sampleBiomeAt, OCEAN_WATER_LEVEL } from '../world/proceduralTerrain';
import { createExclamationTexture, createDustTexture } from '../world/textures';
import { StateMachine, GameStateKey } from '../core/stateMachine';
import { GameLoop } from '../core/gameLoop';
import { InputManager } from '../core/inputManager';
import { eventBus } from '../core/eventBus';
import { SaveManager } from '../save/saveManager';
import { DebugManager } from '../core/debugManager';
import { GAME_CONSTANTS } from '../data/constants';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { ObjectPool } from '../core/pool';

interface DustParticle {
  mesh: THREE.Sprite;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private perfProfile: PerformanceProfile;
  private chunkManager!: ChunkManager;

  private stateMachine: StateMachine;
  private gameLoop: GameLoop;
  private inputManager: InputManager;
  private debugManager: DebugManager;

  private player!: PlayerController;
  private soulDolls: SoulDoll[] = [];
  private trees: TreeData[] = [];
  private collisionBoxes: CollisionBox[] = [];
  private lakeCenter: { x: number; z: number } = { x: 100, z: -80 };
  private npcs: NPC[] = [];
  private chests: Chest[] = [];
  private enemies: Enemy[] = [];
  private grassPatches: GrassPatch[] = [];
  private fountains: FountainData[] = [];
  private signposts: Signpost[] = [];
  private resourceNodes: ResourceNode[] = [];
  private worldBosses: WorldBoss[] = [];
  private pendingBossId: string | null = null;
  private encounterTimeoutId: number | null = null;
  private discoveredGrass: number[] = [];
  private updateWorldFn!: (delta: number, px: number, pz: number) => void;
  private setTimeOfDayFn!: (t: number) => void;
  private isInsideGrassFn!: (x: number, z: number) => boolean;

  private exclamationSprite!: THREE.Sprite;
  private grassDistanceWalked: number = 0;
  private graceSteps: number = 6;

  private timeOfDay: number = 0.0;
  private targetTimeOfDay: number = 0.0;
  private transitionTimer: number = 0;
  private transitionDuration: number = 3.0;
  private isTransitioning: boolean = false;
  private autoCycle: boolean = true;
  private cycleTimer: number = 60; // Start at mid-day (120/2)

  private lastFootstepTime: number = 0;
  private velocityX: number = 0;
  private velocityZ: number = 0;
  private currentSpeed: number = 0;
  private walkTimer: number = 0;
  private isSprintingMobile: boolean = false;
  
  private activeDustParticles: DustParticle[] = [];
  private dustPool: ObjectPool<THREE.Sprite>;
  private dustTimer: number = 0;

  private gameState: GameState = 'title';
  private onStateChange?: (
    state: GameState,
    souls: number,
    total: number,
    isDay: boolean,
    autoCycle: boolean,
    hp: number,
    maxHp: number,
    gold: number,
    inventory: InventoryItem[],
    activeDialogue: ActiveDialogue | null,
    questState: 'none' | 'active' | 'completed',
    playerPos: { x: number; z: number; rotation: number },
    discoveredGrass: number[],
    pixelEffectEnabled: boolean
  ) => void;
  private onSoulCollected?: (soul: SoulDoll) => void;
  private onCombatTrigger?: (rivalSoul: BattleSoul, introText: string) => void;
  private onChestReward?: (items: { id: ItemId; name: string; count: number }[], gold: number) => void;
  private onHealTeam?: () => void;
  private hasWaterSoulFn?: () => boolean;
  private onWaterQuestReward?: () => void;
  private onItemReward?: (items: { id: ItemId; name: string; count: number }[]) => void;
  private onGetAvgLevel?: () => number;
  private getSaveData: () => Partial<GameSaveData>;


  private activeDialogue: ActiveDialogue | null = null;
  private dialogueIndex: number = 0;
  private currentNPC: NPC | null = null;

  private hp: number = 100;
  private maxHp: number = 100;
  private gold: number = 50;
  private inventory: InventoryItem[] = [];
  private questState: 'none' | 'active' | 'completed' = 'none';
  private pixelEffectEnabled: boolean = true;
  private isEditorOpen: boolean = false;

  private currentLookTarget: THREE.Vector3 = new THREE.Vector3();
  private cameraInitialized: boolean = false;
  private currentCamAngle: number = 0;
  private currentCamDistance: number = GAME_CONSTANTS.CAMERA_DISTANCE;
  private currentCamHeight: number = GAME_CONSTANTS.CAMERA_HEIGHT;
  private lookAheadVec: THREE.Vector3 = new THREE.Vector3();
  private smoothedPlayerX: number = 0;
  private smoothedPlayerZ: number = 0;
  private smoothedPlayerY: number = 0;

  constructor(
    container: HTMLElement,
    onStateChange?: any,
    onSoulCollected?: (soul: SoulDoll) => void,
    onCombatTrigger?: (rivalSoul: BattleSoul, introText: string) => void,
    onChestReward?: (items: { id: ItemId; name: string; count: number }[], gold: number) => void,
    onHealTeam?: () => void,
    hasWaterSoulFn?: () => boolean,
    onWaterQuestReward?: () => void,
    onItemReward?: (items: { id: ItemId; name: string; count: number }[]) => void,
    onGetAvgLevel?: () => number,
    getSaveData?: () => Partial<GameSaveData>
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onSoulCollected = onSoulCollected;
    this.onCombatTrigger = onCombatTrigger;
    this.onChestReward = onChestReward;
    this.onHealTeam = onHealTeam;
    this.hasWaterSoulFn = hasWaterSoulFn;
    this.onWaterQuestReward = onWaterQuestReward;
    this.onItemReward = onItemReward;
    this.onGetAvgLevel = onGetAvgLevel;
    this.getSaveData = getSaveData || (() => ({}));

    // 1. Performance profile & Renderer setup
    this.perfProfile = detectPerformanceProfile();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(1);
    this.renderer.domElement.style.imageRendering = 'pixelated';
    this.renderer.domElement.tabIndex = -1;
    this.renderer.domElement.style.outline = 'none';
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    if (this.perfProfile.enableBloom) {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.65, 0.4, 0.85
      );
      this.composer.addPass(bloomPass);
    }

    // 3. Core modules
    this.inputManager = new InputManager(this.renderer.domElement);
    this.stateMachine = new StateMachine();
    this.debugManager = new DebugManager(this);
    this.initStateMachine();

    // 4. Build world & player
    const world = buildWorld(this.scene, this.camera, 'fixed-seed', this.perfProfile);
    this.soulDolls = world.soulDolls;
    this.trees = world.trees;
    this.collisionBoxes = world.collisionBoxes;
    this.lakeCenter = world.lakeCenter;
    this.npcs = world.npcs;
    this.chests = world.chests;
    this.enemies = world.enemies;
    this.grassPatches = world.grassPatches;
    this.fountains = world.fountains;
    this.signposts = world.signposts;
    this.resourceNodes = world.resourceNodes;
    this.worldBosses = world.worldBosses;
    this.chunkManager = world.chunkManager;
    this.updateWorldFn = world.updateWorld;
    this.setTimeOfDayFn = world.setTimeOfDay;
    this.isInsideGrassFn = world.isInsideGrass;

    this.player = new PlayerController(this.scene);
    this.timeOfDay = 1.0;
    this.setTimeOfDayFn(1.0);

    this.loadGame(false);

    const exMat = new THREE.SpriteMaterial({ map: createExclamationTexture(), transparent: true });
    this.exclamationSprite = new THREE.Sprite(exMat);
    this.exclamationSprite.scale.set(1.8, 1.8, 1);
    this.exclamationSprite.visible = false;
    this.scene.add(this.exclamationSprite);

    // Dust Pooling
    const dustTex = createDustTexture();
    this.dustPool = new ObjectPool<THREE.Sprite>(
      () => {
        const mat = new THREE.SpriteMaterial({ map: dustTex, transparent: true, opacity: 0, depthWrite: false });
        const s = new THREE.Sprite(mat);
        s.scale.set(0.6, 0.6, 1);
        s.visible = false;
        this.scene.add(s);
        return s;
      },
      (s) => {
        s.visible = false;
        (s.material as THREE.SpriteMaterial).opacity = 0;
      },
      16
    );

    this.initEventListeners();
    this.onWindowResize();

    // 5. Game Loop
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );
  }

  private initStateMachine() {
    this.stateMachine.registerState('title', {
      enter: () => { this.gameState = 'title'; this.notifyState(); },
    });
    this.stateMachine.registerState('world', {
      enter: () => { this.gameState = 'playing'; this.notifyState(); },
      update: (dt) => this.updateWorldLogic(dt),
    });
    this.stateMachine.registerState('transitionToEncounter', {
      enter: () => { this.gameState = 'combat'; this.notifyState(); },
    });
    this.stateMachine.registerState('combat', {
      enter: () => { this.gameState = 'combat'; this.notifyState(); },
    });
    this.stateMachine.registerState('partyMenu', {
      enter: () => { this.gameState = 'playing'; this.notifyState(); },
    });
    this.stateMachine.registerState('bag', {
      enter: () => { this.gameState = 'playing'; this.notifyState(); },
    });
    this.stateMachine.registerState('pause', {
      enter: () => { this.notifyState(); },
    });
    this.stateMachine.registerState('error', {
      enter: () => { this.notifyState(); },
    });
  }

  private activeSlot: number = 0;

  public setActiveSlot(slot: number) { this.activeSlot = slot; this.loadGame(true); }

  private loadGame(notify: boolean = true) {
    // Reset world modification flags before applying slot save
    this.chests.forEach(c => { c.opened = false; });
    this.soulDolls.forEach(s => { s.collected = false; });
    this.resourceNodes.forEach(r => { r.harvested = false; });
    this.worldBosses.forEach(b => { b.defeated = false; });
    this.pendingBossId = null;

    const data = SaveManager.loadFromSlot(this.activeSlot);
    if (data) {
      this.gold = data.gold ?? 50;
      this.questState = data.questState ?? 'none';
      if (data.openedChests && Array.isArray(data.openedChests)) {
        this.chests.forEach(c => {
          if (data.openedChests!.includes(c.id)) c.opened = true;
        });
      }
      if (data.collectedWorldSouls && Array.isArray(data.collectedWorldSouls)) {
        this.soulDolls.forEach(s => {
          if (data.collectedWorldSouls!.includes(s.id)) s.collected = true;
        });
      }
      if (data.harvestedResources && Array.isArray(data.harvestedResources)) {
        this.resourceNodes.forEach(r => {
          if (data.harvestedResources!.includes(r.id)) r.harvested = true;
        });
      }
      if (data.defeatedBosses && Array.isArray(data.defeatedBosses)) {
        this.worldBosses.forEach(b => {
          if (data.defeatedBosses!.includes(b.id)) b.defeated = true;
        });
      }
      if (data.playerPos && this.player) {
        const tx = data.playerPos.x ?? 0;
        const tz = data.playerPos.z ?? 16.0;
        this.chunkManager?.preloadAround(tx, tz);
        if (this.checkPointCollision(tx, tz)) {
          this.player.state.x = 0;
          this.player.state.z = 16.0;
        } else {
          this.player.state.x = tx;
          this.player.state.z = tz;
        }
        this.player.updatePosition(0);
        this.cameraInitialized = false;
      }
    } else if (this.player) {
      this.player.state.x = 0;
      this.player.state.z = 16.0;
      this.chunkManager?.preloadAround(0, 16.0);
      this.player.updatePosition(0);
      this.cameraInitialized = false;
    }
    if (notify) {
      this.notifyState();
    }
  }

  public saveGame() {
    const data = this.getSaveData();
    const pos = this.player ? { x: this.player.state.x, z: this.player.state.z } : { x: 0, z: 0 };
    SaveManager.saveToSlot(this.activeSlot, {
      ...data,
      hp: this.hp,
      gold: this.gold,
      questState: this.questState,
      playerPos: pos,
    } as GameSaveData);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F2') {
      const cmd = prompt('Debug command: tp x z | encuentro [mob] | darNivel n | darObjeto n | curar | semilla n | noche/dia | guardar/cargar');
      if (cmd) {
        this.debugManager.handleCommand(cmd);
      }
    }
    
    if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (this.stateMachine.getState() === 'title') {
        this.stateMachine.transition('world');
      }
    }

    if (e.code === 'KeyT') {
      this.autoCycle = false;
      this.targetTimeOfDay = this.targetTimeOfDay === 0 ? 1 : 0;
      this.isTransitioning = true;
      this.transitionTimer = 0;
      this.notifyState();
    }

    if (e.code === 'KeyC') {
      this.autoCycle = !this.autoCycle;
      this.notifyState();
    }

    if (e.code === 'KeyN') {
      audioManager.toggleMute();
    }

    if (e.code === 'KeyE' && this.stateMachine.getState() === 'world') {
      this.handleInteraction();
    }

    if (e.code === 'Space' && this.stateMachine.getState() === 'world' && !this.activeDialogue) {
      this.handleAttack();
    }

    if (e.code === 'KeyB' && this.stateMachine.getState() === 'world' && !this.activeDialogue) {
      this.triggerGrassEncounter('RUNIKA');
    }
  };

  private handleMouseDown = () => {
    if (this.stateMachine.getState() === 'title') {
      this.stateMachine.transition('world');
    }
  };

  private handleTouchStart = () => {
    if (this.stateMachine.getState() === 'title') {
      this.stateMachine.transition('world');
    }
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.gameLoop.pause();
      audioManager.pauseAll? audioManager.pauseAll() : null;
    } else {
      this.gameLoop.resume();
      audioManager.resumeAll? audioManager.resumeAll() : null;
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    console.warn('[Engine] WebGL Context Lost');
    this.gameLoop.pause();
    // Show overlay or notify user if needed
  };

  private handleContextRestored = () => {
    console.log('[Engine] WebGL Context Restored. Reconstructing...');
    this.renderer.setAnimationLoop(null);
    // In a real app we might need to recreate materials/textures here.
    // Three.js handles most of it if we don't dispose things prematurely.
    this.gameLoop.resume();
  };

  private initEventListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    dom.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    
    dom.addEventListener('webglcontextlost', this.handleContextLost, false);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('orientationchange', this.onWindowResize);
    window.visualViewport?.addEventListener('resize', this.onWindowResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleInteraction() {
    const px = this.player.state.x;
    const pz = this.player.state.z;

    if (this.activeDialogue) {
      if (this.currentNPC) {
        this.dialogueIndex++;
        if (this.dialogueIndex < this.currentNPC.dialogue.length) {
          this.activeDialogue = {
            name: this.currentNPC.name,
            text: this.currentNPC.dialogue[this.dialogueIndex],
            spriteIndex: this.currentNPC.spriteIndex ?? 0,
            spriteRef: this.currentNPC.spriteRef,
          };
          if (this.currentNPC.questGiven && this.questState === 'none') {
            this.questState = 'active';
          }
        } else {
          this.activeDialogue = null;
          this.currentNPC = null;
        }
        this.notifyState();
      } else {
        this.activeDialogue = null;
        this.notifyState();
      }
      return;
    }

    for (let i = 0; i < this.fountains.length; i++) {
      const f = this.fountains[i];
      const dist = Math.hypot(f.x - px, f.z - pz);
      if (dist < 3.8) {
        this.hp = this.maxHp;
        audioManager.playHeal();
        vfxEngine.triggerSkillVFX('heal', window.innerWidth * 0.5, window.innerHeight * 0.5);
        vfxEngine.showFloatingText('¡Salud Restaurada!', 50, 40, '#34d399', 'text-2xl');
        if (this.onHealTeam) {
          this.onHealTeam();
        }
        if (this.onItemReward) {
          this.onItemReward([{ id: 'potion', name: 'Poción', count: 1 }]);
        }
        this.activeDialogue = {
          name: 'Fuente Sagrada',
          text: '¡Las aguas sagradas han restaurado por completo tu equipo y te han otorgado una Poción Ancestral extra!',
        };
        this.currentNPC = null;
        // this.saveGame();
        this.notifyState();
        return;
      }
    }

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      const dist = Math.hypot(npc.x - px, npc.z - pz);
      if (dist < 4.2) {
        this.currentNPC = npc;
        this.dialogueIndex = 0;

        if (npc.id === 'npc-elder') {
          if (this.questState === 'none') {
            this.questState = 'active';
            this.activeDialogue = {
              name: npc.name,
              text: '¡Saludos, caminante de almas! Las aguas de nuestro lago oriental albergan a las almas de Agua más puras. ¿Podrías capturar un alma de tipo AGUA para nuestro santuario? ¡Te daré 3 Cristales Superiores!',
              spriteIndex: npc.spriteIndex ?? 0,
              spriteRef: npc.spriteRef,
            };
          } else if (this.questState === 'active') {
            const hasWater = this.hasWaterSoulFn ? this.hasWaterSoulFn() : false;
            if (hasWater) {
              this.questState = 'completed';
              if (this.onWaterQuestReward) {
                this.onWaterQuestReward();
              }
              audioManager.playVictory();
              this.activeDialogue = {
                name: npc.name,
                text: '¡Increíble! Percibo la pureza del alma de Agua que has capturado. Has cumplido la misión sagrada. ¡Toma estos 3 Cristales Superiores para tu viaje!',
                spriteIndex: npc.spriteIndex ?? 0,
                spriteRef: npc.spriteRef,
              };
            } else {
              this.activeDialogue = {
                name: npc.name,
                text: 'Aún no has capturado un alma de tipo AGUA (Aquelle o Tomoe). Búscalas en la hierba alta cerca del lago al este.',
                spriteIndex: npc.spriteIndex ?? 0,
                spriteRef: npc.spriteRef,
              };
            }
          } else {
            this.activeDialogue = {
              name: npc.name,
              text: 'Gracias a ti, las corrientes sagradas fluyen en paz. Que las almas guíen tus pasos en el bosque.',
              spriteIndex: npc.spriteIndex ?? 0,
              spriteRef: npc.spriteRef,
            };
          }
        } else {
          this.activeDialogue = {
            name: npc.name,
            text: npc.dialogue[0],
            spriteIndex: npc.spriteIndex ?? 0,
            spriteRef: npc.spriteRef,
          };
        }

        audioManager.playCollectSoul();
        // this.saveGame();
        this.notifyState();
        return;
      }
    }

    for (let i = 0; i < this.chests.length; i++) {
      const chest = this.chests[i];
      if (!chest.opened) {
        const dist = Math.hypot(chest.x - px, chest.z - pz);
        if (dist < 3.5) {
          chest.opened = true;
          this.gold += chest.rewardAmount;
          audioManager.playCollectSoul();
          vfxEngine.triggerSkillVFX('levelup', window.innerWidth * 0.5, window.innerHeight * 0.5);
          vfxEngine.showFloatingText(`+${chest.rewardAmount} ORO Y TESORO!`, 50, 40, '#fde047', 'text-2xl');

          const itemsGiven: { id: ItemId; name: string; count: number }[] = [];
          const potCount = Math.random() < 0.6 ? Math.floor(1 + Math.random() * 2) : 0;
          const crysCount = Math.floor(1 + Math.random() * 2);
          if (potCount > 0) itemsGiven.push({ id: 'potion', name: 'Poción', count: potCount });
          itemsGiven.push({ id: 'soul_crystal', name: 'Cristal de alma', count: crysCount });

          if (this.onChestReward) {
            this.onChestReward(itemsGiven, chest.rewardAmount);
          }

          // this.saveGame();
          this.notifyState();
          return;
        }
      }
    }

    for (let i = 0; i < this.worldBosses.length; i++) {
      const boss = this.worldBosses[i];
      if (!boss.defeated) {
        const dist = Math.hypot(boss.x - px, boss.z - pz);
        if (dist < 5.2) {
          this.pendingBossId = boss.id;
          this.triggerGrassEncounter(boss.forcedSoulName);
          return;
        }
      }
    }

    for (let i = 0; i < this.resourceNodes.length; i++) {
      const node = this.resourceNodes[i];
      if (!node.harvested) {
        const dist = Math.hypot(node.x - px, node.z - pz);
        if (dist < 3.6) {
          node.harvested = true;
          this.gold += node.rewardGold;
          const itemLabel =
            node.rewardItem === 'potion'
              ? 'Poción'
              : node.rewardItem === 'super_crystal'
              ? 'Cristal superior'
              : 'Cristal de alma';
          audioManager.playCollectSoul();
          vfxEngine.triggerSkillVFX('capture', window.innerWidth * 0.5, window.innerHeight * 0.5);
          vfxEngine.showFloatingText(`+${node.rewardCount}x ${itemLabel} & +${node.rewardGold} Oro`, 50, 40, node.color, 'text-2xl');
          if (this.onItemReward) {
            this.onItemReward([{ id: node.rewardItem, name: itemLabel, count: node.rewardCount }]);
          }
          this.currentNPC = null;
          this.activeDialogue = {
            name: `Veta Regional: ${node.name}`,
            text: `¡Has extraído ${node.name}! Obtienes ${node.rewardCount}x ${itemLabel} y ${node.rewardGold} de oro.`,
          };
          this.notifyState();
          return;
        }
      }
    }

    for (let i = 0; i < this.signposts.length; i++) {
      const sign = this.signposts[i];
      const dist = Math.hypot(sign.x - px, sign.z - pz);
      if (dist < 3.2) {
        this.currentNPC = null;
        this.activeDialogue = {
          name: sign.name,
          text: sign.text,
        };
        audioManager.playCollectSoul();
        this.notifyState();
        return;
      }
    }
  }

  private handleAttack() {
    const px = this.player.state.x;
    const pz = this.player.state.z;
    audioManager.playHitSpirit();

    for (let i = 0; i < this.enemies.length; i++) {
      const en = this.enemies[i];
      if (en.alive) {
        const dist = Math.hypot(en.x - px, en.z - pz);
        if (dist < 4.5) {
          en.hp--;
          if (en.hp <= 0) {
            en.alive = false;
            this.gold += 25;
            audioManager.playCollectSoul();
            // this.saveGame();
          }
        }
      }
    }
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;

    this.camera.aspect = w / h;
    const baseFov = 60;
    if (this.camera.aspect < 1.0) {
      const refAspect = 1.25;
      const targetHFovRad = 2 * Math.atan(Math.tan((baseFov * Math.PI / 180) / 2) * refAspect);
      const calculatedVFovDeg = 2 * Math.atan(Math.tan(targetHFovRad / 2) / this.camera.aspect) * (180 / Math.PI);
      this.camera.fov = Math.min(80, Math.max(baseFov, calculatedVFovDeg));
    } else {
      this.camera.fov = baseFov;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  };

  private notifyState() {
    const collected = this.soulDolls.filter(s => s.collected).length;
    if (this.onStateChange) {
      const isDay = this.timeOfDay >= 0.5;
      const playerPosAndRot = {
        x: this.player ? this.player.state.x : 0,
        z: this.player ? this.player.state.z : 0,
        rotation: this.player ? this.player.state.rotation : 0,
      };
      this.onStateChange(
        this.gameState,
        collected,
        this.soulDolls.length,
        isDay,
        this.autoCycle,
        this.hp,
        this.maxHp,
        this.gold,
        this.inventory,
        this.activeDialogue,
        this.questState,
        playerPosAndRot,
        this.discoveredGrass,
        this.pixelEffectEnabled
      );
    }
  }

  public setGameState(state: GameState) {
    if (state === 'playing') {
      this.stateMachine.transition('world');
    } else if (state === 'combat') {
      this.stateMachine.transition('combat');
    } else if (state === 'title') {
      this.stateMachine.transition('title');
    }
  }

  public restartGame() {
    this.player.reset();
    this.soulDolls.forEach(s => { s.collected = false; });
    this.resourceNodes.forEach(r => { r.harvested = false; });
    this.worldBosses.forEach(b => { b.defeated = false; });
    this.pendingBossId = null;
    this.chunkManager?.preloadAround(0, 16);
    this.stateMachine.transition('world');
  }

  public start() {
    this.gameLoop.start();
  }

  private checkPointCollision(testX: number, testZ: number): boolean {
    if (testX < -250 || testX > 250 || testZ < -250 || testZ > 250) return true;
    const playerRadius = GAME_CONSTANTS.PLAYER_RADIUS;

    // Deep coastal ocean water check (player can walk on golden beaches, blocked by deep sea)
    if (!isPointOnBridge(testX, testZ) && getTerrainHeight(testX, testZ) < OCEAN_WATER_LEVEL + 0.15) {
      return true;
    }

    // Per-chunk natural formations (mountain boulders, alpine ice spires, spectral shards)
    if (this.chunkManager && this.chunkManager.checkCollision(testX, testZ, playerRadius)) {
      return true;
    }

    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      const dist = Math.hypot(tree.x - testX, tree.z - testZ);
      if (dist < tree.radius + playerRadius) {
        return true;
      }
    }

    for (let i = 0; i < this.collisionBoxes.length; i++) {
      const box = this.collisionBoxes[i];
      if (
        Math.abs(testX - box.x) < box.rx + playerRadius &&
        Math.abs(testZ - box.z) < box.rz + playerRadius
      ) {
        return true;
      }
    }

    if (this.lakeCenter) {
      const lakeDist = Math.hypot(testX - this.lakeCenter.x, testZ - this.lakeCenter.z);
      if (lakeDist < 22 + playerRadius) {
        return true;
      }
    }

    // River water check: player cannot walk into deep river water unless on the timber bridge
    if (!isPointOnBridge(testX, testZ)) {
      const riverInfo = getDistanceToRiver(testX, testZ);
      if (riverInfo.distance < (RIVER_HALF_WIDTH * 0.72)) {
        return true;
      }
    }

    // Mountain & Alpine sheer cliff check: steep rock crests (slope > 0.88) are naturally impassable
    const biome = sampleBiomeAt(testX, testZ, getTerrainHeight);
    if ((biome.biome === 'mountain' || biome.biome === 'snow') && biome.slope > 0.88) {
      return true;
    }

    return false;
  }

  private spawnDustParticle(x: number, y: number, z: number, isSprinting: boolean) {
    const mesh = this.dustPool.get();
    mesh.visible = true;
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.5,
      y + 0.15,
      z + (Math.random() - 0.5) * 0.5
    );
    mesh.scale.set(0.45, 0.45, 1);
    (mesh.material as THREE.SpriteMaterial).opacity = 0.75;
    
    this.activeDustParticles.push({
      mesh,
      life: 0,
      maxLife: isSprinting ? 0.32 : 0.42,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.5 + Math.random() * 0.4,
      vz: (Math.random() - 0.5) * 0.6,
    });
  }

  private update(dt: number) {
    if (this.autoCycle) {
      this.cycleTimer += dt;
      const cycleDuration = GAME_CONSTANTS.DAY_NIGHT_CYCLE_DURATION;
      const progress = (this.cycleTimer % cycleDuration) / cycleDuration;
      this.timeOfDay = (Math.sin(progress * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      this.setTimeOfDayFn(this.timeOfDay);
    } else if (this.isTransitioning) {
      this.transitionTimer += dt;
      const p = Math.min(1.0, this.transitionTimer / this.transitionDuration);
      const easeP = p * p * (3 - 2 * p);
      const startT = this.targetTimeOfDay === 1 ? 0 : 1;
      this.timeOfDay = THREE.MathUtils.lerp(startT, this.targetTimeOfDay, easeP);
      this.setTimeOfDayFn(this.timeOfDay);

      if (p >= 1.0) {
        this.isTransitioning = false;
      }
    }

    // State machine update
    if (this.stateMachine.getState() === 'world') {
      this.updateWorldLogic(dt);
    }
  }

  private updateWorldLogic(dt: number) {
    const rot = this.player.state.rotation;

    let moveForward = 0;
    let moveRight = 0;

    if (!this.isEditorOpen) {
      if (this.inputManager.isActionActive('turnLeft')) {
        this.player.state.rotation += 2.2 * dt;
      }
      if (this.inputManager.isActionActive('turnRight')) {
        this.player.state.rotation -= 2.2 * dt;
      }

      const yawDelta = this.inputManager.consumeYawDelta();
      if (yawDelta !== 0) {
        this.player.state.rotation += yawDelta;
      }
    }

    const analog = this.inputManager.getAnalogMove();
    const analogLen = Math.hypot(analog.x, analog.y);

    if (!this.activeDialogue && !this.isEditorOpen) {
      if (analogLen > 0.01) {
        moveRight = analog.x;
        moveForward = analog.y;
      } else {
        if (this.inputManager.isActionActive('moveForward')) moveForward += 1;
        if (this.inputManager.isActionActive('moveBackward')) moveForward -= 1;
        if (this.inputManager.isActionActive('strafeRight')) moveRight += 1;
        if (this.inputManager.isActionActive('strafeLeft')) moveRight -= 1;
      }
    }

    const hasInput = moveForward !== 0 || moveRight !== 0;
    const isSprinting = (this.inputManager.isActionActive('sprint') || this.isSprintingMobile) && hasInput;
    const baseMaxSpeed = isSprinting ? GAME_CONSTANTS.PLAYER_SPRINT_SPEED : GAME_CONSTANTS.PLAYER_BASE_SPEED;
    const analogSpeedScale = analogLen > 0.01 ? THREE.MathUtils.lerp(0.38, 1.0, Math.min(1.0, analogLen)) : 1.0;
    const maxSpeed = baseMaxSpeed * analogSpeedScale;

    let targetDirX = 0;
    let targetDirZ = 0;
    let strafeDir = 0;
    let forwardDir = 0;

    if (hasInput) {
      const inputLen = Math.hypot(moveForward, moveRight);
      const normF = moveForward / inputLen;
      const normR = moveRight / inputLen;
      strafeDir = normR;
      forwardDir = normF;

      targetDirX = -Math.sin(rot) * normF + Math.cos(rot) * normR;
      targetDirZ = -Math.cos(rot) * normF - Math.sin(rot) * normR;
    }

    const targetVX = targetDirX * maxSpeed;
    const targetVZ = targetDirZ * maxSpeed;
    const accelRate = hasInput ? 24 : 18;

    this.velocityX = THREE.MathUtils.lerp(this.velocityX, targetVX, Math.min(1.0, dt * accelRate));
    this.velocityZ = THREE.MathUtils.lerp(this.velocityZ, targetVZ, Math.min(1.0, dt * accelRate));

    this.currentSpeed = Math.hypot(this.velocityX, this.velocityZ);
    const moving = this.currentSpeed > 0.15;
    this.player.state.isMoving = moving;

    if (moving) {
      const stepX = this.velocityX * dt;
      const stepZ = this.velocityZ * dt;

      const prevX = this.player.state.x;
      const prevZ = this.player.state.z;

      const testBothX = Math.max(-248, Math.min(248, prevX + stepX));
      const testBothZ = Math.max(-248, Math.min(248, prevZ + stepZ));

      const midX = (prevX + testBothX) * 0.5;
      const midZ = (prevZ + testBothZ) * 0.5;
      const midCollision = this.checkPointCollision(midX, midZ);

      if (!midCollision && !this.checkPointCollision(testBothX, testBothZ)) {
        this.player.state.x = testBothX;
        this.player.state.z = testBothZ;
      } else {
        const canMoveX = !this.checkPointCollision(testBothX, prevZ);
        const canMoveZ = !this.checkPointCollision(prevX, testBothZ);

        if (canMoveX) this.player.state.x = testBothX;
        if (canMoveZ) this.player.state.z = testBothZ;
      }

      const actualStepDist = Math.hypot(this.player.state.x - prevX, this.player.state.z - prevZ);

      this.dustTimer += dt;
      const dustInterval = isSprinting ? 0.08 : 0.15;
      if (this.dustTimer > dustInterval) {
        this.dustTimer = 0;
        this.spawnDustParticle(this.player.state.x, this.player.state.y - 2.8, this.player.state.z, isSprinting);
      }

      const footstepInterval = isSprinting ? 220 : 360;
      if (performance.now() - this.lastFootstepTime > footstepInterval) {
        this.lastFootstepTime = performance.now();
        const px = this.player.state.x;
        const pz = this.player.state.z;
        let surface: 'stone' | 'wood' | 'grass' = 'stone';
        if (this.isInsideGrassFn(px, pz)) {
          surface = 'grass';
        } else if (isPointOnBridge(px, pz)) {
          surface = 'wood';
        } else if (Math.abs(px) < 4.0 && pz < -18 && pz > -35) {
          surface = 'wood';
        } else if (
          (Math.abs(px + 10.5) < 3.0 && ((pz > -4 && pz < 4) || (pz > 19 && pz < 26))) ||
          (Math.abs(px - 10.5) < 3.0 && ((pz > -4 && pz < 4) || (pz > 19 && pz < 26)))
        ) {
          surface = 'wood';
        }
        audioManager.playFootstep(surface);
      }

      if (actualStepDist > 0.001) {
        this.grassPatches.forEach((gp, idx) => {
          if (!this.discoveredGrass.includes(idx)) {
            if (Math.hypot(gp.x - this.player.state.x, gp.z - this.player.state.z) < gp.radius + 20) {
              this.discoveredGrass.push(idx);
            }
          }
        });

        if (this.isInsideGrassFn && this.isInsideGrassFn(this.player.state.x, this.player.state.z)) {
          this.grassDistanceWalked += actualStepDist;
          if (this.grassDistanceWalked >= 1.0) {
            this.grassDistanceWalked = 0;
            if (this.graceSteps > 0) {
              this.graceSteps--;
            } else if (this.gameState === 'playing' && Math.random() < GAME_CONSTANTS.GRASS_ENCOUNTER_CHANCE) {
              this.triggerGrassEncounter();
            }
          }
        }
      }
    } else {
      this.velocityX = 0;
      this.velocityZ = 0;
    }

    for (let i = this.activeDustParticles.length - 1; i >= 0; i--) {
      const p = this.activeDustParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.dustPool.release(p.mesh);
        this.activeDustParticles.splice(i, 1);
      } else {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        const progress = p.life / p.maxLife;
        (p.mesh.material as THREE.SpriteMaterial).opacity = (1 - progress) * 0.75;
        const s = 0.45 + progress * 0.35;
        p.mesh.scale.set(s, s, 1);
      }
    }

    this.player.updatePosition(dt, strafeDir, forwardDir, isSprinting);

    const px = this.player.state.x;
    const pz = this.player.state.z;
    const py = this.player.state.y;

    const aspect = this.camera.aspect || 1.0;
    const isPortrait = aspect < 1.0;
    const portraitFactor = isPortrait
      ? THREE.MathUtils.lerp(1.2, 1.0, Math.max(0, Math.min(1.0, (aspect - 0.45) / 0.55)))
      : 1.0;

    // Dynamic distance & height: gentle pullback when sprinting (+1.4m dist, +0.7m height)
    const sprintDistExtra = isSprinting ? 1.4 : 0.0;
    const sprintHeightExtra = isSprinting ? 0.7 : 0.0;
    const targetCamDist = (GAME_CONSTANTS.CAMERA_DISTANCE + sprintDistExtra) * portraitFactor;
    const targetCamHeight = (GAME_CONSTANTS.CAMERA_HEIGHT + sprintHeightExtra) * portraitFactor;

    if (!this.cameraInitialized) {
      this.currentCamAngle = rot;
      this.currentCamDistance = targetCamDist;
      this.currentCamHeight = targetCamHeight;
      this.smoothedPlayerX = px;
      this.smoothedPlayerZ = pz;
      this.smoothedPlayerY = py;
      this.lookAheadVec.set(0, 0, 0);

      const portraitShift = isPortrait ? 2.0 : 0.0;
      const shiftX = -Math.sin(this.currentCamAngle) * portraitShift;
      const shiftZ = -Math.cos(this.currentCamAngle) * portraitShift;

      const targetLookX = px + shiftX;
      const targetLookY = py + (isPortrait ? 2.6 : 2.0);
      const targetLookZ = pz + shiftZ;

      this.currentLookTarget.set(targetLookX, targetLookY, targetLookZ);

      const camX = px + shiftX * 0.35 + Math.sin(this.currentCamAngle) * this.currentCamDistance;
      const camZ = pz + shiftZ * 0.35 + Math.cos(this.currentCamAngle) * this.currentCamDistance;
      const camY = py + this.currentCamHeight;
      this.camera.position.set(camX, camY, camZ);
      this.cameraInitialized = true;
    } else {
      // 1. Pure Circular Orbit Damping: Eliminates chord cutting / accordion wobble during rotation
      const angleDiff = ((rot - this.currentCamAngle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      const angleDamp = 1 - Math.exp(-8.5 * dt);
      this.currentCamAngle += angleDiff * angleDamp;

      // 2. Dynamic Distance & Height Damping (Smooth speed pullback during sprint)
      this.currentCamDistance = THREE.MathUtils.damp(this.currentCamDistance, targetCamDist, 4.5, dt);
      this.currentCamHeight = THREE.MathUtils.damp(this.currentCamHeight, targetCamHeight, 4.5, dt);

      // 3. Horizontal & Vertical Smoothing: Absorbs stairs & elevation steps with soft steadicam spring
      this.smoothedPlayerX = THREE.MathUtils.damp(this.smoothedPlayerX, px, 10.0, dt);
      this.smoothedPlayerZ = THREE.MathUtils.damp(this.smoothedPlayerZ, pz, 10.0, dt);
      this.smoothedPlayerY = THREE.MathUtils.damp(this.smoothedPlayerY, py, 6.0, dt);

      // 4. Look-Ahead Velocity Anticipation (Extends vision forward in direction of movement)
      const maxSpeedRef = isSprinting ? GAME_CONSTANTS.PLAYER_SPRINT_SPEED : GAME_CONSTANTS.PLAYER_BASE_SPEED;
      const speedRatio = Math.min(1.0, this.currentSpeed / (maxSpeedRef || 1.0));
      const maxLead = isSprinting ? 2.5 : 1.6;
      const dirLen = this.currentSpeed > 0.05 ? this.currentSpeed : 1.0;
      const targetLeadX = (this.velocityX / dirLen) * maxLead * speedRatio;
      const targetLeadZ = (this.velocityZ / dirLen) * maxLead * speedRatio;

      this.lookAheadVec.x = THREE.MathUtils.damp(this.lookAheadVec.x, targetLeadX, 3.8, dt);
      this.lookAheadVec.z = THREE.MathUtils.damp(this.lookAheadVec.z, targetLeadZ, 3.8, dt);

      // 5. Mobile Portrait Framing (Lifts character to upper 55% of viewport to clear bottom D-pad / HUD)
      const portraitShift = isPortrait ? 2.0 : 0.0;
      const shiftX = -Math.sin(this.currentCamAngle) * portraitShift;
      const shiftZ = -Math.cos(this.currentCamAngle) * portraitShift;

      // Desired look target
      const targetLookX = this.smoothedPlayerX + this.lookAheadVec.x + shiftX;
      const targetLookY = this.smoothedPlayerY + (isPortrait ? 2.6 : 2.0);
      const targetLookZ = this.smoothedPlayerZ + this.lookAheadVec.z + shiftZ;

      this.currentLookTarget.x = THREE.MathUtils.damp(this.currentLookTarget.x, targetLookX, 10.0, dt);
      this.currentLookTarget.y = THREE.MathUtils.damp(this.currentLookTarget.y, targetLookY, 8.0, dt);
      this.currentLookTarget.z = THREE.MathUtils.damp(this.currentLookTarget.z, targetLookZ, 10.0, dt);

      // 6. Camera Position along true circular orbit
      const desiredCamX = this.smoothedPlayerX + shiftX * 0.35 + Math.sin(this.currentCamAngle) * this.currentCamDistance;
      const desiredCamZ = this.smoothedPlayerZ + shiftZ * 0.35 + Math.cos(this.currentCamAngle) * this.currentCamDistance;
      const desiredCamY = this.smoothedPlayerY + this.currentCamHeight;

      this.camera.position.x = desiredCamX;
      this.camera.position.y = desiredCamY;
      this.camera.position.z = desiredCamZ;
    }



    this.camera.lookAt(this.currentLookTarget);
    this.updateWorldFn(dt, px, pz);

    this.soulDolls.forEach(soul => {
      if (!soul.collected) {
        const dist = Math.hypot(soul.x - px, soul.z - pz);
        if (dist < 3.5) {
          soul.collected = true;
          audioManager.playCollectSoul();
          vfxEngine.triggerSkillVFX('capture', window.innerWidth * 0.5, window.innerHeight * 0.5);
          vfxEngine.showFloatingText(`¡Alma "${soul.name}" Obtenida!`, 50, 40, '#c084fc', 'text-2xl');
          const collectedCount = this.soulDolls.filter(s => s.collected).length;
          if (this.onSoulCollected) {
            this.onSoulCollected(soul);
          }
          eventBus.emit('soulCollected', soul);
          this.notifyState();

          if (collectedCount >= this.soulDolls.length) {
            audioManager.playVictory();
            this.setGameState('victory' as any);
          }
        }
      }
    });
  }

  private render() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.debugManager.update(this.renderer, this.scene, this.trees, this.grassPatches);
  }

  public focusCanvas() {
    try {
      window.focus();
      this.renderer?.domElement?.focus({ preventScroll: true });
    } catch {
      // Ignore focus errors in restricted environments
    }
  }

  private resumeWorldFromCombat() {
    if (this.encounterTimeoutId !== null) {
      clearTimeout(this.encounterTimeoutId);
      this.encounterTimeoutId = null;
    }
    this.exclamationSprite.visible = false;
    this.activeDialogue = null;
    this.currentNPC = null;
    this.velocityX = 0;
    this.velocityZ = 0;
    this.currentSpeed = 0;
    this.grassDistanceWalked = 0;
    this.inputManager.resetAll();
    if (this.player) {
      this.player.state.isMoving = false;
      this.player.updatePosition(0);
    }
    if (this.stateMachine.getState() !== 'world') {
      const transitioned = this.stateMachine.transition('world');
      if (!transitioned) {
        this.gameState = 'playing';
      }
    } else {
      this.gameState = 'playing';
    }
    this.focusCanvas();
  }

  public triggerGrassEncounter(forcedMobName?: string) {
    const currentState = this.stateMachine.getState();
    if (currentState === 'combat' || currentState === 'transitionToEncounter') return;

    this.velocityX = 0;
    this.velocityZ = 0;
    this.currentSpeed = 0;
    this.inputManager.resetAll();
    if (this.player) {
      this.player.state.isMoving = false;
      this.player.updatePosition(0);
    }

    this.stateMachine.transition('transitionToEncounter');

    const px = this.player.state.x;
    const pz = this.player.state.z;
    const allowedTypes = getEncounterTypesForPosition(px, pz, getTerrainHeight);
    const region = getRegionAt(px, pz);
    const avgLevel = this.onGetAvgLevel ? this.onGetAvgLevel() : 5;
    const { soul, introText } = createRandomWildSoul(forcedMobName, allowedTypes, region.levelRange, avgLevel);

    this.exclamationSprite.position.set(px, this.player.state.y + 4.2, pz);
    this.exclamationSprite.visible = true;
    audioManager.playBattleStart();

    if (this.encounterTimeoutId !== null) {
      clearTimeout(this.encounterTimeoutId);
    }
    this.encounterTimeoutId = window.setTimeout(() => {
      this.encounterTimeoutId = null;
      this.exclamationSprite.visible = false;
      this.stateMachine.transition('combat');
      eventBus.emit('encounterStarted', soul);
      if (this.onCombatTrigger) {
        this.onCombatTrigger(soul, introText);
      }
    }, 600);
  }

  public teleportPlayer(x: number, z: number) {
    if (!this.player) return;
    this.chunkManager?.preloadAround(x, z);
    this.player.teleport(x, z);
    this.velocityX = 0;
    this.velocityZ = 0;
    this.currentSpeed = 0;
    this.currentLookTarget.set(x, this.player.state.y, z);
    this.camera.position.set(x, this.player.state.y + 14, z + 16);
    this.camera.lookAt(x, this.player.state.y, z);
    audioManager.playTeleport();
    this.notifyState();
  }

  public respawnAtVillage() {
    this.pendingBossId = null;
    this.chunkManager?.preloadAround(0, 16.0);
    this.player.state.x = 0;
    this.player.state.z = 16.0;
    this.player.state.rotation = 0;
    this.hp = this.maxHp;
    this.graceSteps = 10;
    this.cameraInitialized = false;
    this.resumeWorldFromCombat();
    this.notifyState();
    eventBus.emit('combatEnded', { defeat: true });
  }

  public onCombatVictory(gold: number) {
    this.gold += gold;
    this.graceSteps = 8;

    if (this.pendingBossId) {
      const defeatedBoss = this.worldBosses.find(b => b.id === this.pendingBossId);
      if (defeatedBoss) {
        defeatedBoss.defeated = true;
        vfxEngine.showFloatingText('¡GUARDIÁN DEL ABISMO DERROTADO! +2 Cristales Superiores', 50, 35, '#fde047', 'text-2xl');
        if (this.onItemReward) {
          this.onItemReward([{ id: 'super_crystal', name: 'Cristal superior', count: 2 }]);
        }
      }
      this.pendingBossId = null;
    }

    this.resumeWorldFromCombat();
    this.notifyState();
    eventBus.emit('combatEnded', { victory: true });
  }

  public onCombatFlee() {
    this.pendingBossId = null;
    this.graceSteps = 8;
    this.resumeWorldFromCombat();
    this.notifyState();
    eventBus.emit('combatEnded', { flee: true });
  }

  public toggleAudio(): boolean {
    return audioManager.toggleMute();
  }

  public setTargetTimeOfDay(t: number) {
    this.targetTimeOfDay = t;
    this.isTransitioning = true;
    this.transitionTimer = 0;
    this.notifyState();
  }

  public teleport(x: number, z: number) {
    if (this.player) {
      this.chunkManager?.preloadAround(x, z);
      this.player.state.x = x;
      this.player.state.z = z;
      this.player.updatePosition(0);
      this.cameraInitialized = false; // Reset camera to snap
    }
  }

  public addGold(amount: number) {
    this.gold += amount;
    this.notifyState();
  }

  public healFull() {
    this.hp = this.maxHp;
    this.notifyState();
  }

  public getStateMachine() { return this.stateMachine; }

  public getPlayerPos(): { x: number; z: number } {
    return { x: this.player ? this.player.state.x : 0, z: this.player ? this.player.state.z : 0 };
  }

  public getLakeCenter(): { x: number; z: number } {
    return this.lakeCenter;
  }

  public getGrassPatches(): GrassPatch[] {
    return this.grassPatches;
  }

  public getSoulDolls(): SoulDoll[] {
    return this.soulDolls;
  }

  public getDiscoveredGrass(): number[] {
    return this.discoveredGrass;
  }

  public getChests(): Chest[] {
    return this.chests;
  }

  public getOpenedChestIds(): string[] {
    return this.chests.filter(c => c.opened).map(c => c.id);
  }

  public getCollectedWorldSoulIds(): string[] {
    return this.soulDolls.filter(s => s.collected).map(s => s.id);
  }

  public getHarvestedResourceIds(): string[] {
    return this.resourceNodes.filter(r => r.harvested).map(r => r.id);
  }

  public getDefeatedBossIds(): string[] {
    return this.worldBosses.filter(b => b.defeated).map(b => b.id);
  }

  public getFountains(): FountainData[] {
    return this.fountains;
  }

  public setVirtualKey(code: string, isDown: boolean) {
    if (code === 'KeyW' || code === 'ArrowUp') this.inputManager.setVirtualAction('moveForward', isDown);
    if (code === 'KeyS' || code === 'ArrowDown') this.inputManager.setVirtualAction('moveBackward', isDown);
    if (code === 'KeyA') this.inputManager.setVirtualAction('strafeLeft', isDown);
    if (code === 'KeyD') this.inputManager.setVirtualAction('strafeRight', isDown);
    if (code === 'KeyQ' || code === 'ArrowLeft') this.inputManager.setVirtualAction('turnLeft', isDown);
    if (code === 'KeyE' || code === 'ArrowRight') this.inputManager.setVirtualAction('turnRight', isDown);
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.inputManager.setVirtualAction('sprint', isDown);

    if (isDown && ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      if (this.stateMachine.getState() === 'title') {
        this.stateMachine.transition('world');
      }
    }
  }

  public setVirtualJoystick(x: number, y: number) {
    this.inputManager.setAnalogMove(x, y);
    if ((Math.abs(x) > 0.05 || Math.abs(y) > 0.05) && this.stateMachine.getState() === 'title') {
      this.stateMachine.transition('world');
    }
  }

  public triggerInteract() {
    if (this.isEditorOpen) return;
    if (this.stateMachine.getState() === 'world') {
      this.handleInteraction();
    }
  }

  public triggerAttack() {
    if (this.isEditorOpen) return;
    if (this.stateMachine.getState() === 'world' && !this.activeDialogue) {
      this.handleAttack();
    }
  }

  public isEditorActive(): boolean {
    return this.isEditorOpen;
  }

  public setEditorActive(active: boolean): void {
    this.isEditorOpen = active;
  }

  public getChunkManager(): ChunkManager | null {
    return this.chunkManager ?? null;
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getPlayerPosition(): { x: number; y: number; z: number } {
    return {
      x: this.player?.state.x ?? 0,
      y: this.player?.state.y ?? 0,
      z: this.player?.state.z ?? 0,
    };
  }

  public getGroundIntersection(clientX: number, clientY: number): { x: number; y: number; z: number } | null {
    const dom = this.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const meshes = this.chunkManager?.getTerrainMeshes() ?? [];
    if (meshes.length > 0) {
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        return {
          x: hits[0].point.x,
          y: hits[0].point.y,
          z: hits[0].point.z,
        };
      }
    }

    const py = this.player?.state.y ?? 0;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -py);
    const target = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, target);
    if (hit) {
      const y = getTerrainHeight(target.x, target.z);
      return { x: target.x, y, z: target.z };
    }
    return null;
  }

  public toggleSprint(active?: boolean) {
    if (active !== undefined) {
      this.isSprintingMobile = active;
    } else {
      this.isSprintingMobile = !this.isSprintingMobile;
    }
  }

  public isSprinting(): boolean {
    return this.isSprintingMobile || this.inputManager.isActionActive('sprint');
  }

  public togglePixelEffect() {
    this.pixelEffectEnabled = !this.pixelEffectEnabled;
    
    if (this.pixelEffectEnabled) {
      this.renderer.setPixelRatio(1);
      this.renderer.domElement.style.imageRendering = 'pixelated';
    } else {
      this.renderer.setPixelRatio(window.devicePixelRatio || 1);
      this.renderer.domElement.style.imageRendering = 'auto';
    }
    
    // Trigger resize to update composer size correctly
    this.onWindowResize();
    this.notifyState();
  }

  public destroy() {
    if (this.encounterTimeoutId !== null) {
      clearTimeout(this.encounterTimeoutId);
      this.encounterTimeoutId = null;
    }
    this.gameLoop.stop();
    this.inputManager.destroy();
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onWindowResize);
    window.visualViewport?.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    dom.removeEventListener('touchstart', this.handleTouchStart);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);
    
    if (this.container && this.container.contains(dom)) {
        this.container.removeChild(dom);
    }
    
    // Thorough cleanup of all 3D resources
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh || obj instanceof THREE.Sprite) {
        if (obj.geometry) obj.geometry.dispose();
        
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });

    this.chunkManager?.dispose();
    disposeTextures();
    if (this.composer) {
      this.composer.dispose();
    }
    this.renderer.dispose();
  }
}
