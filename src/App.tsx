/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { GameHUD } from './components/GameHUD';
import { BattleScreen } from './components/BattleScreen';
import { StarterSelectModal } from './components/StarterSelectModal';
import { SlotSelectionModal } from './components/SlotSelectionModal';
import { LuminadexModal } from './components/LuminadexModal';
import { SoulBagModal } from './components/SoulBagModal';
import { GameState, SoulDoll, InventoryItem, BattleSoul, BagItem, ItemId, GameSaveData, GrassPatch, ActiveDialogue } from './types';
import { getDefaultPlayerSoul, getDefaultBag, createRandomWildSoul, getStarterSouls } from './data/mobs';
import { SaveManager } from './save/saveManager';
import { FountainData } from './world/worldGen';
import { VFXOverlay } from './components/VFXOverlay';
import { LoadingScreen } from './components/LoadingScreen';
import { TitleScreen } from './components/TitleScreen';
import { WorldMapModal } from './components/WorldMapModal';
import { RegionBanner } from './components/RegionBanner';
import { FAST_TRAVEL_POINTS, FastTravelPoint, WorldRegion, getRegionAt } from './data/regions';
import { NPC_SHEETS } from './world/npcSprites';
import { MapEditorModal } from './components/editor/MapEditorModal';

function detectBiomeBackground(rival: BattleSoul): string {
  switch (rival.type) {
    case 'Fuego':
    case 'Sombra':
      return '/assets/battle/dungeon.webp';
    case 'Planta':
      return '/assets/battle/forest.webp';
    case 'Agua':
    case 'Luz':
      return '/assets/battle/valley.webp';
    case 'Rayo':
      return '/assets/battle/mystic.webp';
    default:
      return '/assets/battle/plains.webp';
  }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [startupScreen, setStartupScreen] = useState<'loading' | 'title' | 'slots' | 'game'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [soulsCollected, setSoulsCollected] = useState(0);
  const [totalSouls, setTotalSouls] = useState(10);
  const [isDay, setIsDay] = useState(true);
  const [autoCycle, setAutoCycle] = useState(true);
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [gold, setGold] = useState(50);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activeDialogue, setActiveDialogue] = useState<ActiveDialogue | null>(null);
  const [questState, setQuestState] = useState<'none' | 'active' | 'completed'>('none');
  const [pixelEffectEnabled, setPixelEffectEnabled] = useState(true);

  const [lastCollectedSoul, setLastCollectedSoul] = useState<SoulDoll | null>(null);
  const [allSouls, setAllSouls] = useState<SoulDoll[]>([]);

  // Team, Box, Bag, and Starter states
  const [starterChosen, setStarterChosen] = useState<boolean>(true); // will be checked on mount
  const [team, setTeam] = useState<BattleSoul[]>([getDefaultPlayerSoul()]);
  const [box, setBox] = useState<BattleSoul[]>([]);
  const [bag, setBag] = useState<BagItem[]>(getDefaultBag());
  const [activeSoulIndex, setActiveSoulIndex] = useState<number>(0);

  // Active Rival Combat State
  const [rivalSoul, setRivalSoul] = useState<BattleSoul | null>(null);
  const [battleIntroText, setBattleIntroText] = useState<string>('');
  const [battleBackground, setBattleBackground] = useState<string>('/assets/battle/plains.webp');

  // World and Radar navigation state
  const [playerPosAndRot, setPlayerPosAndRot] = useState<{ x: number; z: number; rotation: number }>({ x: 0, z: 0, rotation: 0 });
  const [discoveredGrass, setDiscoveredGrass] = useState<number[]>([]);
  const [grassPatches, setGrassPatches] = useState<GrassPatch[]>([]);
  const [lakeCenter, setLakeCenter] = useState<{ x: number; z: number }>({ x: 100, z: -80 });
  const [fountains, setFountains] = useState<FountainData[]>([]);

  // Luminadex / Registro de Almas (Key J)
  const [showLuminadex, setShowLuminadex] = useState(false);
  // Codex de Almas & Bolsa (Key U / Key I)
  const [showSoulBag, setShowSoulBag] = useState(false);
  const [soulBagInitialTab, setSoulBagInitialTab] = useState<'team' | 'bag' | 'box' | 'taller'>('team');

  const [isSprinting, setIsSprinting] = useState(false);
  const [discoveredSouls, setDiscoveredSouls] = useState<Record<string, 'seen' | 'captured'>>({});
  
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [fadeOverlayActive, setFadeOverlayActive] = useState<boolean>(false);

  // Master Map State (Tecla M / Atlas de Luminati)
  const [showWorldMap, setShowWorldMap] = useState<boolean>(false);
  // World Engine Map Editor State (Tecla F2 o ~)
  const [showMapEditor, setShowMapEditor] = useState<boolean>(false);
  const [discoveredWaypoints, setDiscoveredWaypoints] = useState<string[]>(['fountain_villa']);
  const [unlockedFogCells, setUnlockedFogCells] = useState<number[]>(() => {
    const initCells: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        initCells.push((10 + dx) * 20 + (10 + dz));
      }
    }
    return initCells;
  });

  const [bannerRegion, setBannerRegion] = useState<WorldRegion | null>(null);
  const [showRegionBanner, setShowRegionBanner] = useState<boolean>(false);
  const lastRegionIdRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    const loadingStartedAt = performance.now();
    const starterAssets = getStarterSouls().map(soul => soul.spritesheet);
    const assets = [...new Set([
      '/assets/player_spritesheet.webp',
      NPC_SHEETS.female.url,
      NPC_SHEETS.male.url,
      ...starterAssets,
    ])];
    let completed = 0;

    setLoadProgress(0);
    setLoadError(null);

    Promise.all(assets.map(src => new Promise<string | null>(resolve => {
      const image = new Image();
      image.onload = () => resolve(null);
      image.onerror = () => resolve(`No se pudo cargar un recurso del juego (${src}).`);
      image.src = src;
    }).then(error => {
      completed++;
      if (!cancelled) setLoadProgress(Math.round((completed / assets.length) * 100));
      return error;
    }))).then(errors => {
      const finishLoading = () => {
        if (cancelled) return;
        const firstError = errors.find((error): error is string => error !== null);
        if (firstError) {
          setLoadError(firstError);
        } else {
          setStartupScreen('title');
        }
      };

      const minimumLoadingTime = 700;
      const remainingTime = minimumLoadingTime - (performance.now() - loadingStartedAt);
      if (remainingTime > 0) {
        window.setTimeout(finishLoading, remainingTime);
      } else {
        finishLoading();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  // Initial load from SaveManager
  useEffect(() => {
    if (startupScreen !== 'game') return;
    
    const data = SaveManager.loadFromSlot(activeSlot);
    if (data) {
      if (data.team && data.team.length > 0) {
        setTeam(data.team);
        setStarterChosen(true);
      } else {
        setStarterChosen(false);
      }
      setBox(data.box || []);
      setBag(data.bag || getDefaultBag());
      setGold(data.gold ?? 50);
      setQuestState(data.questState || 'none');
      setDiscoveredSouls(data.discoveredSouls || {});
      setDiscoveredGrass(data.discoveredGrass || []);
      if (data.discoveredWaypoints && data.discoveredWaypoints.length > 0) {
        setDiscoveredWaypoints(data.discoveredWaypoints);
      } else {
        setDiscoveredWaypoints(['fountain_villa']);
      }
      if (data.unlockedFogCells && data.unlockedFogCells.length > 0) {
        setUnlockedFogCells(data.unlockedFogCells);
      }
    } else {
      setStarterChosen(false);
      setBag(getDefaultBag());
    }
  }, [activeSlot, startupScreen]);

  const teamRef = useRef(team);
  teamRef.current = team;

  const boxRef = useRef(box);
  boxRef.current = box;

  const bagRef = useRef(bag);
  bagRef.current = bag;

  const goldRef = useRef(gold);
  goldRef.current = gold;

  const questStateRef = useRef(questState);
  questStateRef.current = questState;

  const discoveredSoulsRef = useRef(discoveredSouls);
  discoveredSoulsRef.current = discoveredSouls;

  const discoveredGrassRef = useRef(discoveredGrass);
  discoveredGrassRef.current = discoveredGrass;

  const discoveredWaypointsRef = useRef(discoveredWaypoints);
  discoveredWaypointsRef.current = discoveredWaypoints;

  const unlockedFogCellsRef = useRef(unlockedFogCells);
  unlockedFogCellsRef.current = unlockedFogCells;

  const activeSlotRef = useRef(activeSlot);
  activeSlotRef.current = activeSlot;

  const hpRef = useRef(hp);
  hpRef.current = hp;

  // Save game state using SaveManager
  const saveGameState = useCallback((
    currentTeam: BattleSoul[] = teamRef.current,
    currentBox: BattleSoul[] = boxRef.current,
    currentBag: BagItem[] = bagRef.current,
    currentGold: number = goldRef.current,
    currentQuest: 'none' | 'active' | 'completed' = questStateRef.current,
    currentDiscoveredSouls: Record<string, 'seen' | 'captured'> = discoveredSoulsRef.current,
    currentDiscoveredGrass: number[] = discoveredGrassRef.current,
    currentDiscoveredWaypoints: string[] = discoveredWaypointsRef.current,
    currentUnlockedFogCells: number[] = unlockedFogCellsRef.current
  ) => {
    const eng = engineRef.current;
    const pos = eng ? eng.getPlayerPos() : { x: 0, z: 16 };
    SaveManager.saveToSlot(activeSlotRef.current, {
      team: currentTeam,
      box: currentBox,
      bag: currentBag,
      playerPos: pos,
      gold: currentGold,
      hp: hpRef.current,
      questState: currentQuest,
      starterChosen: true,
      openedChests: eng ? eng.getOpenedChestIds() : [],
      collectedWorldSouls: eng ? eng.getCollectedWorldSoulIds() : [],
      harvestedResources: eng ? eng.getHarvestedResourceIds() : [],
      defeatedBosses: eng ? eng.getDefeatedBossIds() : [],
      discoveredSouls: currentDiscoveredSouls,
      discoveredGrass: currentDiscoveredGrass,
      discoveredWaypoints: currentDiscoveredWaypoints,
      unlockedFogCells: currentUnlockedFogCells,
    });
  }, []);

  // Handle Healing Fountain: Restore all souls in player team
  const handleHealTeam = useCallback(() => {
    setTeam(prevTeam => {
      const healedTeam = prevTeam.map(s => ({
        ...s,
        hp: s.maxHp,
        moves: s.moves.map(m => ({ ...m, pp: m.maxPp })),
      }));
      setHp(100);
      saveGameState(healedTeam, boxRef.current, bagRef.current, goldRef.current, questStateRef.current, discoveredSoulsRef.current, discoveredGrassRef.current);
      return healedTeam;
    });
  }, [saveGameState]);

  // Water Soul check function
  const hasWaterSoul = useCallback(() => {
    return (
      teamRef.current.some(s => s.type === 'Agua') ||
      boxRef.current.some(s => s.type === 'Agua') ||
      discoveredSoulsRef.current['AQUELLE'] === 'captured' ||
      discoveredSoulsRef.current['TOMOE'] === 'captured'
    );
  }, []);

  // Water Soul Quest Reward: 3 Super Crystals
  const handleWaterQuestReward = useCallback(() => {
    setBag(prevBag => {
      const newBag = [...prevBag];
      const supIdx = newBag.findIndex(i => i.id === 'super_crystal');
      if (supIdx >= 0) {
        newBag[supIdx] = { ...newBag[supIdx], count: newBag[supIdx].count + 3 };
      } else {
        newBag.push({
          id: 'super_crystal',
          name: 'Cristal superior',
          count: 3,
          description: 'Cristal refinado con mayor índice de captura.',
          effect: 'capture',
          catchBonus: 1.8,
        });
      }
      setInventory(prevInv => [
        ...prevInv,
        {
          id: `item-water-reward-${Date.now()}`,
          name: '3x Cristales Superiores',
          icon: 'crystal',
          count: 3,
          description: 'Recompensa del Anciano Kaelen por purificar las aguas.',
        },
      ]);
      setQuestState('completed');
      saveGameState(teamRef.current, boxRef.current, newBag, goldRef.current + 100, 'completed', discoveredSoulsRef.current, discoveredGrassRef.current);
      return newBag;
    });
  }, [saveGameState]);

  const handleItemReward = useCallback((rewardItems: { id: ItemId; name: string; count: number }[]) => {
    setBag(prevBag => {
      const newBag = prevBag.map(item => {
        const found = rewardItems.find(ri => ri.id === item.id);
        if (found) {
          return { ...item, count: item.count + found.count };
        }
        return item;
      });

      rewardItems.forEach(ri => {
        if (!newBag.some(b => b.id === ri.id)) {
          newBag.push({
            id: ri.id,
            name: ri.name,
            count: ri.count,
            description: ri.id === 'potion' ? 'Restaura 20 HP al alma activa.' : 'Cristal para capturar almas salvajes.',
            effect: ri.id === 'potion' ? 'heal' : 'capture',
          });
        }
      });

      saveGameState(teamRef.current, boxRef.current, newBag, goldRef.current, questStateRef.current, discoveredSoulsRef.current, discoveredGrassRef.current);
      return newBag;
    });
  }, [saveGameState]);

  useEffect(() => {
    if (!containerRef.current) return;

    let engine: GameEngine | null = null;

    engine = new GameEngine(
      containerRef.current,
      (
        state: GameState,
        souls: number,
        total: number,
        day: boolean,
        auto: boolean,
        currentHp: number,
        currentMaxHp: number,
        currentGold: number,
        currentInv: InventoryItem[],
        dialogue: ActiveDialogue | null,
        quest: 'none' | 'active' | 'completed',
        posAndRot: { x: number; z: number; rotation: number },
        grassIdxs: number[],
        pxlEffect: boolean
      ) => {
        setGameState(state);
        setSoulsCollected(souls);
        setTotalSouls(total);
        setIsDay(day);
        setAutoCycle(auto);
        setHp(currentHp);
        setMaxHp(currentMaxHp);
        setGold(currentGold);
        setInventory(currentInv);
        setActiveDialogue(dialogue);
        setQuestState(quest);
        const activeEngine = engine ?? engineRef.current;
        if (activeEngine) {
          setAllSouls([...activeEngine.getSoulDolls()]);
        }
        if (posAndRot) setPlayerPosAndRot(posAndRot);
        if (grassIdxs) setDiscoveredGrass([...grassIdxs]);
        setPixelEffectEnabled(pxlEffect);
      },
      (soul: SoulDoll) => {
        setLastCollectedSoul(soul);
        const activeEngine = engine ?? engineRef.current;
        if (activeEngine) {
          setAllSouls([...activeEngine.getSoulDolls()]);
        }
        saveGameState();
      },
      (rival: BattleSoul, intro: string) => {
        setFadeOverlayActive(true);
        setTimeout(() => {
          // Register soul as seen in Luminadex
          setDiscoveredSouls(prev => {
            const upper = rival.name.toUpperCase();
            if (prev[upper] === 'captured') return prev;
            const next = { ...prev, [upper]: 'seen' as const };
            saveGameState(teamRef.current, boxRef.current, bagRef.current, goldRef.current, questStateRef.current, next, discoveredGrassRef.current);
            return next;
          });

          setRivalSoul(rival);
          setBattleIntroText(intro);
          setBattleBackground(detectBiomeBackground(rival));
          setGameState('combat');
          setTimeout(() => {
            setFadeOverlayActive(false);
          }, 400);
        }, 500);
      },
      (chestItems: { id: ItemId; name: string; count: number }[], chestGold: number) => {
        // Add items to bag
        setBag(prevBag => {
          const newBag = prevBag.map(item => {
            const found = chestItems.find(ci => ci.id === item.id);
            if (found) {
              return { ...item, count: item.count + found.count };
            }
            return item;
          });

          chestItems.forEach(ci => {
            if (!newBag.some(b => b.id === ci.id)) {
              newBag.push({
                id: ci.id,
                name: ci.name,
                count: ci.count,
                description: ci.id === 'potion' ? 'Restaura 20 HP al alma activa.' : 'Cristal para capturar almas salvajes.',
                effect: ci.id === 'potion' ? 'heal' : 'capture',
              });
            }
          });

          saveGameState(teamRef.current, boxRef.current, newBag, goldRef.current + chestGold, questStateRef.current, discoveredSoulsRef.current, discoveredGrassRef.current);
          return newBag;
        });
      },
      handleHealTeam,
      hasWaterSoul,
      handleWaterQuestReward,
      handleItemReward,
      () => {
        return teamRef.current.length > 0
          ? Math.floor(teamRef.current.reduce((acc, s) => acc + s.level, 0) / teamRef.current.length)
          : 5;
      },
      () => {
        const activeEngine = engine ?? engineRef.current;
        return {
          team: teamRef.current,
          box: boxRef.current,
          bag: bagRef.current,
          starterChosen: starterChosen,
          discoveredSouls: discoveredSoulsRef.current,
          discoveredGrass: discoveredGrassRef.current,
          openedChests: activeEngine ? activeEngine.getOpenedChestIds() : [],
          collectedWorldSouls: activeEngine ? activeEngine.getCollectedWorldSoulIds() : [],
          harvestedResources: activeEngine ? activeEngine.getHarvestedResourceIds() : [],
          defeatedBosses: activeEngine ? activeEngine.getDefeatedBossIds() : [],
        };
      }
    );

    engineRef.current = engine;
    engine.setActiveSlot(activeSlot);

    setAllSouls([...engine.getSoulDolls()]);
    setGrassPatches(engine.getGrassPatches());
    setLakeCenter(engine.getLakeCenter());
    setFountains(engine.getFountains());
    engine.start();

    return () => {
      engine?.destroy();
    };
  }, [handleHealTeam, hasWaterSoul, handleWaterQuestReward, handleItemReward, saveGameState]);

  // Global keydown for Luminadex (Key J), World Map (Key M), and Map Editor (Key F2 or Backquote)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.code === 'Backquote') {
        e.preventDefault();
        setShowMapEditor(prev => !prev);
      } else if (gameState === 'playing' && e.code === 'KeyJ') {
        setShowLuminadex(prev => !prev);
      } else if (gameState === 'playing' && e.code === 'KeyM') {
        setShowWorldMap(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // 1. Detect Region Transitions & Display Diegetic Banner
  useEffect(() => {
    if (startupScreen !== 'game') return;

    const currentReg = getRegionAt(playerPosAndRot.x, playerPosAndRot.z);
    if (!lastRegionIdRef.current) {
      lastRegionIdRef.current = currentReg.id;
      setBannerRegion(currentReg);
      setShowRegionBanner(true);
      const timer = setTimeout(() => setShowRegionBanner(false), 3400);
      return () => clearTimeout(timer);
    } else if (lastRegionIdRef.current !== currentReg.id) {
      lastRegionIdRef.current = currentReg.id;
      setBannerRegion(currentReg);
      setShowRegionBanner(true);
      const timer = setTimeout(() => setShowRegionBanner(false), 3400);
      return () => clearTimeout(timer);
    }
  }, [playerPosAndRot.x, playerPosAndRot.z, startupScreen]);

  // 2. Discover Waypoints and Clear Fog of War dynamically
  useEffect(() => {
    if (startupScreen !== 'game') return;

    // Check Waypoints proximity (within 16 units)
    FAST_TRAVEL_POINTS.forEach(wp => {
      const dist = Math.hypot(wp.x - playerPosAndRot.x, wp.z - playerPosAndRot.z);
      if (dist <= 16) {
        setDiscoveredWaypoints(prev => {
          if (!prev.includes(wp.id)) {
            const next = [...prev, wp.id];
            saveGameState(
              teamRef.current,
              boxRef.current,
              bagRef.current,
              goldRef.current,
              questStateRef.current,
              discoveredSoulsRef.current,
              discoveredGrassRef.current,
              next,
              unlockedFogCellsRef.current
            );
            return next;
          }
          return prev;
        });
      }
    });

    // Fog of war cell unlocking (20x20 grid, -200 to +200)
    const playerGx = Math.floor((playerPosAndRot.x + 200) / 20);
    const playerGz = Math.floor((playerPosAndRot.z + 200) / 20);

    const cellsToUnlock: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = playerGx + dx;
        const cz = playerGz + dz;
        if (cx >= 0 && cx < 20 && cz >= 0 && cz < 20) {
          cellsToUnlock.push(cx * 20 + cz);
        }
      }
    }

    setUnlockedFogCells(prev => {
      let changed = false;
      const next = [...prev];
      cellsToUnlock.forEach(idx => {
        if (!next.includes(idx)) {
          next.push(idx);
          changed = true;
        }
      });
      if (changed) {
        saveGameState(
          teamRef.current,
          boxRef.current,
          bagRef.current,
          goldRef.current,
          questStateRef.current,
          discoveredSoulsRef.current,
          discoveredGrassRef.current,
          discoveredWaypointsRef.current,
          next
        );
        return next;
      }
      return prev;
    });
  }, [playerPosAndRot.x, playerPosAndRot.z, startupScreen, saveGameState]);

  // Handle Fast Travel with graceful teleport transition
  const handleFastTravel = useCallback((wp: FastTravelPoint) => {
    setFadeOverlayActive(true);
    setTimeout(() => {
      if (engineRef.current) {
        engineRef.current.teleportPlayer(wp.x, wp.z);
      }
      setTimeout(() => {
        setFadeOverlayActive(false);
      }, 350);
    }, 400);
  }, []);

  // Starter Selection
  const handleSelectStarter = (starterSoul: BattleSoul) => {
    const initialTeam = [starterSoul];
    const initialBag = getDefaultBag();
    setTeam(initialTeam);
    setBag(initialBag);
    setActiveSoulIndex(0);
    setStarterChosen(true);

    const initialDiscovered = {
      ...discoveredSouls,
      [starterSoul.name.toUpperCase()]: 'captured' as const,
    };
    setDiscoveredSouls(initialDiscovered);
    saveGameState(initialTeam, [], initialBag, gold, questState, initialDiscovered, discoveredGrass);
  };

  const handleStart = () => {
    if (engineRef.current) {
      engineRef.current.setGameState('playing');
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.restartGame();
    }
  };

  const handleReturnToTitle = useCallback(() => {
    saveGameState();
    setStartupScreen('title');
    setGameState('title');
    if (engineRef.current) {
      engineRef.current.setGameState('title');
    }
  }, [saveGameState]);

  const handleToggleAudio = () => {
    if (engineRef.current) {
      return engineRef.current.toggleAudio();
    }
    return true;
  };

  const handleTogglePixelEffect = () => {
    if (engineRef.current) {
      engineRef.current.togglePixelEffect();
    }
  };

  // Consume bag item in combat
  const handleUseBagItem = (itemId: ItemId) => {
    setBag(prevBag => {
      const updated = prevBag.map(item => {
        if (item.id === itemId && item.count > 0) {
          return { ...item, count: item.count - 1 };
        }
        return item;
      });
      saveGameState(team, box, updated, gold, questState, discoveredSouls, discoveredGrass);
      return updated;
    });
  };

  // Combat victory or capture with full progression update
  const handleBattleVictory = (
    expGained: number,
    goldGained: number,
    captured?: boolean,
    capturedSoul?: BattleSoul,
    updatedActiveSoul?: BattleSoul
  ) => {
    setFadeOverlayActive(true);
    setTimeout(() => {
      const newGold = goldRef.current + goldGained;
      setGold(newGold);

      let updatedTeam = [...teamRef.current];
      let updatedBox = [...boxRef.current];
      let updatedDiscovered = { ...discoveredSoulsRef.current };

      // Apply updated soul stats, level, EXP and learned moves
      if (updatedActiveSoul && updatedTeam[activeSoulIndex]) {
        updatedTeam[activeSoulIndex] = { ...updatedActiveSoul };
      }

      if (captured && capturedSoul) {
        if (updatedTeam.length < 6) {
          updatedTeam.push(capturedSoul);
        } else {
          updatedBox.push(capturedSoul);
        }
        updatedDiscovered[capturedSoul.name.toUpperCase()] = 'captured';
        setDiscoveredSouls(updatedDiscovered);
      }

      setTeam(updatedTeam);
      setBox(updatedBox);

      setRivalSoul(null);
      setGameState('playing');

      if (engineRef.current) {
        engineRef.current.onCombatVictory(goldGained);
      }

      saveGameState(updatedTeam, updatedBox, bagRef.current, newGold, questStateRef.current, updatedDiscovered, discoveredGrassRef.current);
      setTimeout(() => {
        setFadeOverlayActive(false);
        engineRef.current?.focusCanvas();
      }, 400);
    }, 500);
  };

  // Combat defeat: restore team HP and respawn in village
  const handleBattleDefeat = () => {
    setFadeOverlayActive(true);
    setTimeout(() => {
      const restoredTeam = teamRef.current.map(soul => ({
        ...soul,
        hp: soul.maxHp,
      }));
      setTeam(restoredTeam);
      setActiveSoulIndex(0);

      setRivalSoul(null);
      setGameState('playing');

      if (engineRef.current) {
        engineRef.current.respawnAtVillage();
      }

      saveGameState(restoredTeam, boxRef.current, bagRef.current, goldRef.current, questStateRef.current, discoveredSoulsRef.current, discoveredGrassRef.current);
      setTimeout(() => {
        setFadeOverlayActive(false);
        engineRef.current?.focusCanvas();
      }, 400);
    }, 500);
  };

  // Flee combat
  const handleBattleFlee = () => {
    setFadeOverlayActive(true);
    setTimeout(() => {
      setRivalSoul(null);
      setGameState('playing');

      if (engineRef.current) {
        engineRef.current.onCombatFlee();
      }
      saveGameState(teamRef.current, boxRef.current, bagRef.current, goldRef.current, questStateRef.current, discoveredSoulsRef.current, discoveredGrassRef.current);
      setTimeout(() => {
        setFadeOverlayActive(false);
        engineRef.current?.focusCanvas();
      }, 400);
    }, 500);
  };

  // Quick debug/demo button or B key trigger
  const handleTriggerCombatDemo = () => {
    if (engineRef.current) {
      engineRef.current.triggerGrassEncounter('RUNIKA');
    } else {
      const { soul, introText } = createRandomWildSoul('RUNIKA');
      setRivalSoul(soul);
      setBattleIntroText(introText);
      setGameState('combat');
    }
  };

  const handleRespawn = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.respawnAtVillage();
    }
  }, []);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-slate-950 select-none">
      <VFXOverlay />
      {/* 3D WebGL Canvas Container: blurred & darkened during combat */}
      <div
        ref={containerRef}
        className={`absolute inset-0 w-full h-full transition-all duration-500 ${
          gameState === 'combat' ? 'filter blur-md brightness-35 scale-105 pointer-events-none' : ''
        }`}
        style={{
          imageRendering: pixelEffectEnabled ? 'pixelated' : 'auto',
        }}
      />

      {/* CSS-based ambient light filter reflecting time of day (isDay state) */}
      <div
        className={`absolute inset-0 w-full h-full pointer-events-none transition-all duration-1000 mix-blend-overlay z-10 ${
          isDay 
            ? 'bg-gradient-to-b from-amber-400/20 via-yellow-500/10 to-transparent' 
            : 'bg-gradient-to-b from-indigo-950/60 via-blue-950/40 to-slate-950/70'
        }`}
      />

      {/* Branded startup and resource loading */}
      {startupScreen === 'loading' && (
        <LoadingScreen
          progress={loadProgress}
          error={loadError}
          onRetry={() => setLoadAttempt(attempt => attempt + 1)}
        />
      )}
      {startupScreen === 'title' && (
        <TitleScreen onPlay={() => setStartupScreen('slots')} />
      )}

      {/* Starter Soul Selection Modal at start of game */}
      {startupScreen === 'game' && !starterChosen && (
        <StarterSelectModal onSelect={handleSelectStarter} />
      )}

      {/* Slot Selection Modal at start of game */}
      {startupScreen === 'slots' && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="mb-2 text-[9px] uppercase tracking-[0.3em] text-[#c6a9ff]">Crónicas de Luminati</div>
          <div className="mb-8 text-3xl font-black tracking-[0.1em] text-[#f6d477] drop-shadow-[0_0_18px_rgba(246,212,119,0.4)] sm:text-4xl">
            SOULDOLLS
          </div>
          <SlotSelectionModal 
            onSelectSlot={(slot) => {
              setActiveSlot(slot);
              engineRef.current?.setActiveSlot(slot);
              setStartupScreen('game');
              setGameState('playing');
              engineRef.current?.setGameState('playing');
            }} 
          />
          <button
            type="button"
            onClick={() => setStartupScreen('title')}
            className="mt-5 min-h-10 px-4 text-[8px] uppercase tracking-[0.16em] text-[#aaa0bb] transition hover:text-[#fff5cf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f8d77b]"
          >
            Volver
          </button>
        </div>
      )}

      {/* Main Game HUD (only when not in combat) */}
      {startupScreen === 'game' && gameState !== 'combat' && starterChosen && (
        <GameHUD
          gameState={gameState}
          soulsCollected={soulsCollected}
          totalSouls={totalSouls}
          isDay={isDay}
          autoCycle={autoCycle}
          hp={hp}
          maxHp={maxHp}
          gold={gold}
          inventory={inventory}
          activeDialogue={activeDialogue}
          questState={questState}
          onStart={handleStart}
          onRestart={handleRestart}
          onToggleAudio={handleToggleAudio}
          lastCollectedSoul={lastCollectedSoul}
          allSouls={allSouls}
          playerPosAndRot={playerPosAndRot}
          lakeCenter={lakeCenter}
          grassPatches={grassPatches}
          discoveredGrass={discoveredGrass}
          fountains={fountains}
          onOpenLuminadex={() => setShowLuminadex(true)}
          onOpenWorldMap={() => setShowWorldMap(true)}
          onOpenSoulBag={(tab = 'team') => {
            setSoulBagInitialTab(tab);
            setShowSoulBag(true);
          }}
          onTriggerCombatDemo={handleTriggerCombatDemo}
          onVirtualKey={(code, isDown) => engineRef.current?.setVirtualKey(code, isDown)}
          onVirtualJoystick={(x, y) => engineRef.current?.setVirtualJoystick(x, y)}
          onTriggerInteract={() => engineRef.current?.triggerInteract()}
          onTriggerAttack={() => engineRef.current?.triggerAttack()}
          onToggleSprint={() => {
            engineRef.current?.toggleSprint();
            setIsSprinting(engineRef.current?.isSprinting() ?? false);
          }}
          isSprinting={isSprinting}
          onRespawn={handleRespawn}
          pixelEffectEnabled={pixelEffectEnabled}
          onTogglePixelEffect={handleTogglePixelEffect}
          onSaveGame={() => saveGameState()}
          onReturnToTitle={handleReturnToTitle}
          isAnyModalOpen={showWorldMap || showLuminadex || showSoulBag || showMapEditor}
          discoveredWaypoints={discoveredWaypoints}
          onOpenMapEditor={() => setShowMapEditor(prev => !prev)}
        />
      )}

      {/* World Engine — Map Editor Modal (Tecla F2 o ~) */}
      <MapEditorModal
        isOpen={showMapEditor}
        onClose={() => setShowMapEditor(false)}
        engine={engineRef.current}
      />

      {/* World Map / Atlas de Luminati Modal (Tecla M) */}
      <WorldMapModal
        isOpen={showWorldMap}
        onClose={() => setShowWorldMap(false)}
        playerPos={playerPosAndRot}
        grassPatches={grassPatches}
        discoveredGrass={discoveredGrass}
        discoveredWaypoints={discoveredWaypoints}
        unlockedFogCells={unlockedFogCells}
        onFastTravel={handleFastTravel}
      />

      {/* Diegetic Region Banner */}
      <RegionBanner region={bannerRegion} visible={showRegionBanner} />

      {/* Luminadex Modal (Tecla J) */}
      {showLuminadex && (
        <LuminadexModal
          discovered={discoveredSouls}
          onClose={() => setShowLuminadex(false)}
        />
      )}

      {/* Codex de Almas & Bolsa / Equipo Modal (Tecla U para Equipo, Tecla I para Bolsa) */}
      {showSoulBag && (
        <SoulBagModal
          initialTab={soulBagInitialTab}
          team={team}
          box={box}
          bag={bag}
          gold={gold}
          onClose={() => setShowSoulBag(false)}
          onUpdateTeam={newTeam => {
            setTeam(newTeam);
            saveGameState(newTeam, box, bag, gold, questState, discoveredSouls, discoveredGrass);
          }}
          onUpdateBox={newBox => {
            setBox(newBox);
            saveGameState(team, newBox, bag, gold, questState, discoveredSouls, discoveredGrass);
          }}
          onUpdateBag={newBag => {
            setBag(newBag);
            saveGameState(team, box, newBag, gold, questState, discoveredSouls, discoveredGrass);
          }}
          onUpdateGold={newGold => {
            setGold(newGold);
            saveGameState(team, box, bag, newGold, questState, discoveredSouls, discoveredGrass);
          }}
        />
      )}

      {/* Turn-based 9:16 Combat Screen */}
      {gameState === 'combat' && rivalSoul && (
        <BattleScreen
          team={team}
          activeSoulIndex={activeSoulIndex}
          rivalSoul={rivalSoul}
          bag={bag}
          onSwitchSoul={idx => setActiveSoulIndex(idx)}
          onUseBagItem={handleUseBagItem}
          onVictory={handleBattleVictory}
          onDefeat={handleBattleDefeat}
          onFlee={handleBattleFlee}
          initialMessage={battleIntroText}
          battleBackground={battleBackground}
        />
      )}

      {/* Smooth Fade Transition Overlay between World (playing) and Combat */}
      <div 
        className={`fixed inset-0 z-[200] pointer-events-none bg-[#0e091c] transition-opacity duration-600 ease-in-out flex items-center justify-center ${
          fadeOverlayActive ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
      >
        <div className="text-[#b4862a] font-pixel text-xl animate-pulse tracking-widest">
          ✦ TRANSCENDIENDO ✦
        </div>
      </div>
    </div>
  );
}
