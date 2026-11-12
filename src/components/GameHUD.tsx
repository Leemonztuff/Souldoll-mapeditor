import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, SoulDoll, InventoryItem, GrassPatch, ActiveDialogue } from '../types';
import { Compass } from './Compass';
import { FountainData } from '../world/worldGen';
import { getNPCCoords } from '../world/npcSprites';
import { getStoryNPCs } from '../data/npcRegistry';
import { FAST_TRAVEL_POINTS } from '../data/regions';
import { audioManager } from '../audio/audioManager';
import {
  BrandPanel,
  BrandButton,
  BrandBadge,
  BrandWidget,
  BrandProgress,
  BrandSectionTitle,
} from './ui/BrandKit';

interface GameHUDProps {
  gameState: GameState;
  soulsCollected: number;
  totalSouls: number;
  isDay: boolean;
  autoCycle: boolean;
  hp: number;
  maxHp: number;
  gold: number;
  inventory: InventoryItem[];
  activeDialogue: ActiveDialogue | null;
  questState: 'none' | 'active' | 'completed';
  onStart: () => void;
  onRestart: () => void;
  onToggleAudio: () => boolean;
  lastCollectedSoul: SoulDoll | null;
  allSouls: SoulDoll[];
  playerPosAndRot?: { x: number; z: number; rotation: number };
  lakeCenter?: { x: number; z: number };
  grassPatches?: GrassPatch[];
  discoveredGrass?: number[];
  fountains?: FountainData[];
  onOpenLuminadex?: () => void;
  onOpenWorldMap?: () => void;
  onOpenSoulBag?: (tab?: 'team' | 'bag' | 'box' | 'taller') => void;
  onTriggerCombatDemo?: () => void;
  onVirtualKey?: (code: string, isDown: boolean) => void;
  onVirtualJoystick?: (x: number, y: number) => void;
  onTriggerInteract?: () => void;
  onTriggerAttack?: () => void;
  onToggleSprint?: () => void;
  isSprinting?: boolean;
  onRespawn?: () => void;
  onSaveGame?: () => void;
  onReturnToTitle?: () => void;
  pixelEffectEnabled?: boolean;
  onTogglePixelEffect?: () => void;
  isAnyModalOpen?: boolean;
  discoveredWaypoints?: string[];
  onOpenMapEditor?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  gameState,
  soulsCollected,
  totalSouls,
  isDay,
  autoCycle,
  hp,
  maxHp,
  gold,
  inventory,
  activeDialogue,
  questState,
  onStart,
  onRestart,
  onToggleAudio,
  lastCollectedSoul,
  allSouls,
  playerPosAndRot = { x: 0, z: 0, rotation: 0 },
  lakeCenter = { x: 100, z: -80 },
  grassPatches = [],
  discoveredGrass = [],
  fountains = [
    { x: -64, z: -62, radius: 3.5 },
    { x: 82, z: 8, radius: 3.5 },
    { x: 8, z: 72, radius: 3.5 },
  ],
  onOpenLuminadex,
  onOpenWorldMap,
  onOpenSoulBag,
  onTriggerCombatDemo,
  onVirtualKey,
  onVirtualJoystick,
  onTriggerInteract,
  onTriggerAttack,
  onToggleSprint,
  isSprinting = false,
  onRespawn,
  onSaveGame,
  onReturnToTitle,
  pixelEffectEnabled = true,
  onTogglePixelEffect,
  isAnyModalOpen = false,
  discoveredWaypoints = [],
  onOpenMapEditor,
}) => {
  const [showControlsHint, setShowControlsHint] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [notification, setNotification] = useState<SoulDoll | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(true);
  const [joystickState, setJoystickState] = useState<{
    active: boolean;
    knobX: number;
    knobY: number;
    pctX: number;
    pctY: number;
    normX: number;
    normY: number;
    isSprintZone: boolean;
  }>({
    active: false,
    knobX: 0,
    knobY: 0,
    pctX: 0,
    pctY: 0,
    normX: 0,
    normY: 0,
    isSprintZone: false,
  });
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const joystickPointerIdRef = useRef<number | null>(null);

  // Typewriter effect state for dialogue
  const [displayedText, setDisplayedText] = useState('');

  const releaseJoystick = useCallback(() => {
    joystickPointerIdRef.current = null;
    setJoystickState((prev) =>
      prev.active || prev.knobX !== 0 || prev.knobY !== 0
        ? { active: false, knobX: 0, knobY: 0, pctX: 0, pctY: 0, normX: 0, normY: 0, isSprintZone: false }
        : prev
    );
    onVirtualJoystick?.(0, 0);
    onVirtualKey?.('KeyW', false);
    onVirtualKey?.('KeyS', false);
    onVirtualKey?.('KeyA', false);
    onVirtualKey?.('KeyD', false);
    onVirtualKey?.('ShiftLeft', false);
  }, [onVirtualJoystick, onVirtualKey]);

  const updateJoystickFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = joystickBaseRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxRadius = Math.max(36, rect.width * 0.33);

      const dx = clientX - cx;
      const dy = clientY - cy;
      const rawDist = Math.hypot(dx, dy);
      const clampedDist = Math.min(rawDist, maxRadius);
      const angle = rawDist > 0.001 ? Math.atan2(dy, dx) : 0;

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;
      const pctX = rect.width > 0 ? (knobX / rect.width) * 100 : 0;
      const pctY = rect.height > 0 ? (knobY / rect.height) * 100 : 0;
      const normTilt = clampedDist / maxRadius;

      const DEADZONE = 0.14;
      const SPRINT_THRESHOLD = 0.88;

      if (normTilt < DEADZONE) {
        setJoystickState({
          active: true,
          knobX,
          knobY,
          pctX,
          pctY,
          normX: 0,
          normY: 0,
          isSprintZone: false,
        });
        onVirtualJoystick?.(0, 0);
        onVirtualKey?.('KeyW', false);
        onVirtualKey?.('KeyS', false);
        onVirtualKey?.('KeyA', false);
        onVirtualKey?.('KeyD', false);
        onVirtualKey?.('ShiftLeft', false);
        return;
      }

      const effectiveMag = Math.min(1, (normTilt - DEADZONE) / (1 - DEADZONE));
      const ux = dx / rawDist;
      const uy = dy / rawDist;
      const strafeRight = ux * effectiveMag;
      const moveForward = -uy * effectiveMag;
      const inSprintZone = normTilt >= SPRINT_THRESHOLD;

      setJoystickState({
        active: true,
        knobX,
        knobY,
        pctX,
        pctY,
        normX: ux,
        normY: uy,
        isSprintZone: inSprintZone,
      });

      if (onVirtualJoystick) {
        onVirtualJoystick(strafeRight, moveForward);
        onVirtualKey?.('ShiftLeft', inSprintZone);
      } else {
        onVirtualKey?.('KeyW', uy < -0.38);
        onVirtualKey?.('KeyS', uy > 0.38);
        onVirtualKey?.('KeyA', ux < -0.38);
        onVirtualKey?.('KeyD', ux > 0.38);
        onVirtualKey?.('ShiftLeft', inSprintZone);
      }
    },
    [onVirtualJoystick, onVirtualKey]
  );

  // Ensure joystick and virtual camera orbit keys reset cleanly if UI state changes mid-drag
  useEffect(() => {
    if (gameState !== 'playing' || activeDialogue || showMenuModal || isAnyModalOpen || !showTouchControls) {
      releaseJoystick();
      onVirtualKey?.('KeyQ', false);
      onVirtualKey?.('KeyE', false);
    }
  }, [gameState, activeDialogue, showMenuModal, isAnyModalOpen, showTouchControls, releaseJoystick, onVirtualKey]);

  useEffect(() => {
    const handleBlurOrHide = () => {
      releaseJoystick();
      onVirtualKey?.('KeyQ', false);
      onVirtualKey?.('KeyE', false);
    };
    window.addEventListener('blur', handleBlurOrHide);
    document.addEventListener('visibilitychange', handleBlurOrHide);
    return () => {
      window.removeEventListener('blur', handleBlurOrHide);
      document.removeEventListener('visibilitychange', handleBlurOrHide);
      releaseJoystick();
      onVirtualKey?.('KeyQ', false);
      onVirtualKey?.('KeyE', false);
    };
  }, [releaseJoystick, onVirtualKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowControlsHint(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (lastCollectedSoul) {
      setNotification(lastCollectedSoul);
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [lastCollectedSoul]);

  // Inventory, Team, Luminadex, and Menu toggle via keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      // ESC key opens/closes the action menu
      if (e.code === 'Escape' || e.key === 'Escape') {
        if (showMenuModal) {
          audioManager.playMenuBeep();
          setShowMenuModal(false);
          return;
        } else if (!isAnyModalOpen && !activeDialogue) {
          audioManager.playMenuBeep();
          setShowMenuModal(true);
          return;
        }
      }

      if (showMenuModal) {
        if (e.code === 'KeyI' && onOpenSoulBag) {
          setShowMenuModal(false);
          onOpenSoulBag('bag');
        } else if (e.code === 'KeyU' && onOpenSoulBag) {
          setShowMenuModal(false);
          onOpenSoulBag('team');
        } else if (e.code === 'KeyM' && onOpenWorldMap) {
          setShowMenuModal(false);
          onOpenWorldMap();
        } else if (e.code === 'KeyJ' && onOpenLuminadex) {
          setShowMenuModal(false);
          onOpenLuminadex();
        } else if ((e.key === 'F2' || e.code === 'Backquote') && onOpenMapEditor) {
          setShowMenuModal(false);
          onOpenMapEditor();
        }
        return;
      }

      if (isAnyModalOpen || activeDialogue) return;

      if (e.key === 'F2' || e.code === 'Backquote') {
        onOpenMapEditor?.();
      } else if (e.code === 'KeyI') {
        onOpenSoulBag?.('bag');
      } else if (e.code === 'KeyU') {
        onOpenSoulBag?.('team');
      } else if (e.code === 'KeyJ' && onOpenLuminadex) {
        onOpenLuminadex();
      } else if (e.code === 'KeyM' && onOpenWorldMap) {
        onOpenWorldMap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, activeDialogue, isAnyModalOpen, showMenuModal, onOpenLuminadex, onOpenWorldMap, onOpenSoulBag, onOpenMapEditor]);

  // Typewriter effect with typewriter blip audio
  useEffect(() => {
    if (!activeDialogue) {
      setDisplayedText('');
      return;
    }
    let i = 0;
    setDisplayedText('');
    const fullText = activeDialogue.text;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setDisplayedText(prev => prev + fullText.charAt(i));
        if (i % 2 === 0) {
          audioManager.playTextBlip();
        }
        i++;
      } else {
        clearInterval(interval);
      }
    }, 22);
    return () => clearInterval(interval);
  }, [activeDialogue]);

  const handleStartClick = () => {
    setFadingOut(true);
    setTimeout(() => {
      onStart();
    }, 600);
  };

  const handleAudioClick = () => {
    const res = onToggleAudio();
    setAudioEnabled(res);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden font-pixel select-none">
      {/* TITLE SCREEN (Unslop Retro Grimoire Aesthetic) */}
      {gameState === 'title' && (
        <div
          className={`absolute inset-0 pointer-events-auto bg-[#07050d]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-50 transition-opacity duration-600 ${
            fadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="max-w-xl mx-auto space-y-6 animate-fade-in border-2 border-[#b4862a] bg-[#110c1f] p-6 sm:p-8 rounded-xs shadow-[0_0_50px_rgba(0,0,0,0.95)] relative">
            {/* Runic Corners */}
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-[#c59b27] border border-[#fef08a]" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#c59b27] border border-[#fef08a]" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-[#c59b27] border border-[#fef08a]" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#c59b27] border border-[#fef08a]" />

            <div className="space-y-2">
              <div className="text-[10px] text-[#fbbf24] tracking-widest uppercase">
                ✦ CRÓNICAS DE LUMINATI ✦
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-[#fbbf24] drop-shadow-[0_4px_16px_rgba(251,191,36,0.4)]">
                SOULDOLLS
              </h1>
              <p className="text-[#38bdf8] text-[9px] sm:text-[10px] tracking-widest uppercase">
                2.5D Pixel-Art RPG · Coleccionismo de Almas & Combate Táctico
              </p>
            </div>

            <p className="text-[#cbd5e1] text-xs leading-relaxed max-w-md mx-auto">
              Explora aldeas místicas, habla con sus habitantes (E), purifica las almas en las Fuentes Sagradas y descubre espíritus salvajes en la hierba alta.
            </p>

            <div className="pt-2 flex flex-col items-center justify-center gap-2">
              <button
                onClick={handleStartClick}
                className="px-6 py-3 bg-[#24173d] hover:bg-[#342257] border-2 border-[#fbbf24] text-[#fef08a] font-bold shadow-[0_0_16px_rgba(251,191,36,0.35)] flex items-center gap-2.5 transition active:scale-95 cursor-pointer pointer-events-auto text-xs tracking-wider rounded-xs"
              >
                <span>⚔️</span>
                <span>PULSA PARA COMENZAR</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#2b1f40] text-[8px] text-[#94a3b8] flex flex-wrap justify-center gap-3">
              <span>WASD: Mover</span>
              <span>·</span>
              <span>E: Hablar / Cofres</span>
              <span>·</span>
              <span>M: Mapa</span>
              <span>·</span>
              <span>U: Escuadrón</span>
              <span>·</span>
              <span>I: Bolsa</span>
              <span>·</span>
              <span>J: Luminadex</span>
              <span>·</span>
              <span>B: Combate</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP STATUS BAR & COMPASS (Structured Hierarchy Container) */}
      {gameState === 'playing' && (
        <div className="absolute top-0 inset-x-0 p-2 sm:p-3 pt-safe flex flex-col items-center gap-1.5 z-30 pointer-events-none w-full">
          {/* Row 1: Player Stats (Left) & Action Buttons (Right) */}
          <div className="flex items-center justify-between w-full pointer-events-none max-w-5xl">
            {/* TOP-LEFT: Health, Gold, Soul Count */}
            <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto">
              <BrandWidget
                label="Almas"
                value={`${soulsCollected}/${totalSouls}`}
                icon="🔮"
                accent="ki"
                className="py-0.5 px-1 sm:px-2 text-[7.5px] sm:text-[8px]"
              />
              <BrandWidget
                label="Oro"
                value={gold}
                icon="💰"
                accent="gold"
                className="py-0.5 px-1 sm:px-2 text-[7.5px] sm:text-[8px]"
              />
              {/* Health Bar Widget */}
              <BrandPanel variant="surface" className="px-1.5 py-1 w-22 sm:w-32 shadow-lg">
                <div className="flex justify-between text-[6.5px] sm:text-[7px] font-bold text-[#F2E6C9] mb-0.5">
                  <span className="text-[#C2234B]">❤️ HP</span>
                  <span className="tabular-nums font-pixel">{hp}/{maxHp}</span>
                </div>
                <div className="w-full bg-[#090612] h-1.5 rounded-xs overflow-hidden border border-[#8A6A3B]/60 p-[1px]">
                  <div
                    className={`h-full transition-all duration-300 rounded-xs ${
                      hp / maxHp > 0.5 
                        ? 'bg-gradient-to-r from-emerald-600 to-[#5FE3D2]' 
                        : hp / maxHp > 0.2 
                        ? 'bg-gradient-to-r from-amber-600 to-[#E8B84A]' 
                        : 'bg-gradient-to-r from-rose-800 to-[#C2234B]'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }}
                  />
                </div>
              </BrandPanel>
            </div>

            {/* TOP-RIGHT: Action Buttons */}
            <div className="flex items-center gap-1 pointer-events-auto">
              {onOpenMapEditor && (
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playMenuBeep();
                    onOpenMapEditor();
                  }}
                  className="min-h-[32px] min-w-[32px] px-1.5 py-1 bg-[#1b172a]/95 active:bg-[#2e2646] border border-[#f6d477]/50 rounded-xs text-[8px] text-[#f6d477] font-semibold flex items-center justify-center gap-1 shadow-md cursor-pointer touch-manipulation hover:border-[#f6d477]"
                  title="Editor de Mapas [F2 o ~]"
                >
                  <span className="text-xs">🛠️</span>
                </button>
              )}

              {onOpenSoulBag && (
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playMenuBeep();
                    onOpenSoulBag('team');
                  }}
                  className="min-h-[32px] min-w-[32px] px-1.5 py-1 bg-[#191224]/95 active:bg-[#2A1F2D] border border-[#8A6A3B] rounded-xs text-[8px] text-[#F2E6C9] flex items-center justify-center gap-1 shadow-md cursor-pointer touch-manipulation"
                  aria-label="Abrir Escuadrón y Bolsa"
                >
                  <span className="text-xs">🎒</span>
                  <span className="hidden md:inline">BOLSA</span>
                </button>
              )}

              <BrandButton
                variant="primary"
                onClick={() => setShowMenuModal(true)}
                className="min-h-[32px] min-w-[32px] px-2 py-1 text-[8px] tracking-wider pointer-events-auto"
                title="Menú de Acciones y Opciones"
              >
                <span>⚙️</span>
                <span className="ml-0.5 hidden sm:inline">MENÚ</span>
              </BrandButton>
            </div>
          </div>

          {/* Row 2: Skyrim-Style Horizontal Compass */}
          <div className="pointer-events-auto w-[88vw] max-w-xs sm:max-w-sm flex justify-center shadow-md">
            <Compass
              playerPos={playerPosAndRot}
              onOpenWorldMap={onOpenWorldMap}
              markers={[
                ...fountains.map(f => ({ id: `f-${f.x}-${f.z}`, type: 'fountain' as const, x: f.x, z: f.z, name: 'Fuente Sagrada' })),
                ...getStoryNPCs().map(n => ({ id: n.id, type: 'npc' as const, x: n.x, z: n.z, name: n.name })),
                ...(questState === 'active' ? [{ id: 'quest', type: 'quest' as const, x: 13.5, z: -14.0, name: 'Misión Activa' }] : []),
                ...discoveredWaypoints.map(id => {
                    const point = FAST_TRAVEL_POINTS.find(p => p.id === id);
                    return point ? { id: point.id, type: 'waypoint' as const, x: point.x, z: point.z, name: point.name } : null;
                }).filter((m): m is NonNullable<typeof m> => !!m)
              ]}
            />
          </div>



        </div>
      )}

      {/* CENTRALIZED MENU MODAL (MENÚ DE ACCIONES) */}
      {showMenuModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              audioManager.playMenuBeep();
              setShowMenuModal(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 animate-in fade-in duration-200 select-none font-pixel pointer-events-auto"
        >
          <BrandPanel variant="surface" className="w-full max-w-md p-0 overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#191224] border-b-2 border-[#8A6A3B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg text-[#E8B84A]">⚙️</span>
                <div>
                  <h3 className="text-xs font-bold text-[#E8B84A] tracking-wider uppercase">
                    MENÚ DE ACCIONES
                  </h3>
                  <p className="text-[7.5px] text-[#94a3b8] mt-0.5">
                    Luminati · Exploración, Grimorio, Guardado y Sistema
                  </p>
                </div>
              </div>
              <BrandButton
                variant="quiet"
                onClick={() => {
                  audioManager.playMenuBeep();
                  setShowMenuModal(false);
                }}
                className="px-2.5 py-1 text-[9px] min-h-[30px]"
                aria-label="Cerrar menú"
              >
                ✕ [ESC]
              </BrandButton>
            </div>

            {/* Modal Body / Categorized Sections */}
            <div className="p-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto bg-[#14101C]">
              
              {/* SECTION 1: ACCIONES DE AVENTURA & MAPA */}
              <div>
                <BrandSectionTitle icon="🗺️" title="Aventura y Exploración" />
                <div className="grid grid-cols-2 gap-2">
                  {onOpenWorldMap && (
                    <BrandButton
                      variant="ki"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onOpenWorldMap();
                      }}
                      className="text-[8px] sm:text-[9px] gap-2 py-2.5 justify-start"
                    >
                      <span className="text-sm">🗺️</span>
                      <span>Mapa Atlas [M]</span>
                    </BrandButton>
                  )}
                  {onTriggerCombatDemo && (
                    <BrandButton
                      variant="soul"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onTriggerCombatDemo();
                      }}
                      className="text-[8px] sm:text-[9px] gap-2 py-2.5 justify-start"
                    >
                      <span className="text-sm">⚔️</span>
                      <span>Combate VS [B]</span>
                    </BrandButton>
                  )}
                  {onOpenMapEditor && (
                    <BrandButton
                      variant="ki"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onOpenMapEditor();
                      }}
                      className="col-span-2 text-[8px] sm:text-[9px] gap-2 py-2.5 justify-start bg-[#1e1933] border-[#f6d477]/60 text-[#f6d477]"
                    >
                      <span className="text-sm">🛠️</span>
                      <span className="font-bold">Editor de Mapas 3D [F2 / ~]</span>
                    </BrandButton>
                  )}
                </div>
              </div>

              {/* SECTION 2: GRIMORIO DE ALMAS (COLECCIÓN) */}
              <div>
                <BrandSectionTitle icon="🔮" title="Grimorio de Almas & Equipo" />
                <div className="grid grid-cols-2 gap-2">
                  {onOpenSoulBag && (
                    <BrandButton
                      variant="primary"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onOpenSoulBag('team');
                      }}
                      className="text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                    >
                      <span className="text-sm">👥</span>
                      <span>Escuadrón [U]</span>
                    </BrandButton>
                  )}
                  {onOpenSoulBag && (
                    <BrandButton
                      variant="secondary"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onOpenSoulBag('bag');
                      }}
                      className="text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                    >
                      <span className="text-sm">🎒</span>
                      <span>Bolsa [I]</span>
                    </BrandButton>
                  )}
                  {onOpenSoulBag && (
                    <BrandButton
                      variant="secondary"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onOpenSoulBag('box');
                      }}
                      className="text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                    >
                      <span className="text-sm">📦</span>
                      <span>Almacén</span>
                    </BrandButton>
                  )}
                  {onOpenSoulBag && (
                    <BrandButton
                      variant="secondary"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onOpenSoulBag('taller');
                      }}
                      className="text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                    >
                      <span className="text-sm">🔨</span>
                      <span>Taller Dolls</span>
                    </BrandButton>
                  )}
                  {onOpenLuminadex && (
                    <BrandButton
                      variant="primary"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onOpenLuminadex();
                      }}
                      className="col-span-2 text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                    >
                      <span className="text-sm">📖</span>
                      <span>Luminadex (Atlas de Especies) [J]</span>
                    </BrandButton>
                  )}
                </div>
              </div>

              {/* SECTION 3: GUARDADO Y PREFERENCIAS */}
              <div>
                <BrandSectionTitle icon="⚙️" title="Guardado y Sistema" />
                <div className="grid grid-cols-2 gap-2">
                  {/* Guardar Partida */}
                  <BrandButton
                    variant="primary"
                    onClick={() => {
                      audioManager.playCollectSoul();
                      onSaveGame?.();
                      setSaveNotice('¡Partida guardada correctamente en el grimorio!');
                      setTimeout(() => setSaveNotice(null), 3200);
                    }}
                    className="col-span-2 text-[8px] sm:text-[9px] gap-2 py-2.5 justify-start bg-[#241a36] border-[#E8B84A] text-[#E8B84A]"
                  >
                    <span className="text-sm">💾</span>
                    <span className="font-bold">Guardar Partida Ahora</span>
                  </BrandButton>

                  <BrandButton
                    variant="secondary"
                    onClick={() => {
                      audioManager.playMenuBeep();
                      handleAudioClick();
                    }}
                    className="text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                  >
                    <span>{audioEnabled ? '🔊' : '🔇'}</span>
                    <span className="truncate">Audio ({audioEnabled ? 'ON' : 'OFF'})</span>
                  </BrandButton>

                  {onTogglePixelEffect && (
                    <BrandButton
                      variant={pixelEffectEnabled ? 'ki' : 'secondary'}
                      onClick={() => {
                        audioManager.playMenuBeep();
                        onTogglePixelEffect();
                      }}
                      className="text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                    >
                      <span>{pixelEffectEnabled ? '👾' : '🖼️'}</span>
                      <span className="truncate">Filtro CRT ({pixelEffectEnabled ? 'ON' : 'OFF'})</span>
                    </BrandButton>
                  )}

                  <BrandButton
                    variant={showTouchControls ? 'ki' : 'secondary'}
                    onClick={() => {
                      audioManager.playMenuBeep();
                      setShowTouchControls((prev) => !prev);
                    }}
                    className="col-span-2 text-[8px] sm:text-[9px] gap-2 py-2 justify-start"
                  >
                    <span>🕹️</span>
                    <span className="truncate">Joystick y Controles en Pantalla ({showTouchControls ? 'ON' : 'OFF'})</span>
                  </BrandButton>

                  {onRespawn && (
                    <BrandButton
                      variant="secondary"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onRespawn();
                      }}
                      className="text-[8px] gap-2 py-2 justify-start"
                    >
                      <span>🔄</span>
                      <span className="truncate">Desatascar (Villa)</span>
                    </BrandButton>
                  )}

                  {onReturnToTitle && (
                    <BrandButton
                      variant="danger"
                      onClick={() => {
                        audioManager.playMenuBeep();
                        setShowMenuModal(false);
                        onReturnToTitle();
                      }}
                      className="text-[8px] gap-2 py-2 justify-start"
                    >
                      <span>🏠</span>
                      <span className="truncate">Pantalla de Título</span>
                    </BrandButton>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 bg-[#100b1b] border-t border-[#8A6A3B]/50 text-[7px] text-[#94a3b8] flex justify-between items-center">
              <span>SoulDolls Engine v2.5</span>
              <span>[ESC / Clic fuera]: Volver al juego</span>
            </div>

          </BrandPanel>
        </div>
      )}

      {/* RPG DIALOGUE BOX WITH COMBAT PIXEL FRAME */}
      {activeDialogue && (
        <div
          onClick={onTriggerInteract}
          className="absolute bottom-6 md:bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-auto max-w-xl w-[94vw] px-1 sm:px-4 pb-safe z-40 animate-fade-in select-none cursor-pointer touch-manipulation"
        >
          <div className="relative pixel-frame p-3.5 sm:p-4 md:p-5 text-left bg-[#14101C] shadow-[0_0_25px_rgba(0,0,0,0.95)]">
            <div className="pixel-corner-tl" />
            <div className="pixel-corner-tr" />
            <div className="pixel-corner-bl" />
            <div className="pixel-corner-br" />

            <div className="flex items-center justify-between border-b border-[#8A6A3B]/60 pb-1.5 sm:pb-2 mb-2.5 gap-2">
              <span className="text-[9px] sm:text-[11px] font-bold text-[#E8B84A] tracking-wider uppercase truncate">
                {activeDialogue.name}
              </span>
              <span className="text-[7.5px] sm:text-[8px] text-[#5FE3D2] shrink-0">
                TOCAR PARA CONTINUAR ▼
              </span>
            </div>

            <div className="flex items-start gap-3">
              {(() => {
                const ref = activeDialogue.spriteRef ?? activeDialogue.spriteIndex;
                if (ref === undefined) return null;
                const coords = getNPCCoords(ref);
                return (
                  <div className="shrink-0 w-12 h-14 border border-[#8A6A3B]/80 bg-[#1e1728] rounded-xs overflow-hidden shadow-inner flex items-center justify-center">
                    <div
                      style={{
                        width: '48px',
                        height: '56px',
                        backgroundImage: `url(${coords.sheetUrl})`,
                        backgroundSize: '192px 344px',
                        backgroundPosition: `-${coords.col * 48}px -${coords.row * 86 + 6}px`,
                        imageRendering: 'pixelated',
                      }}
                    />
                  </div>
                );
              })()}
              <p className="text-[#F2E6C9] text-[10px] sm:text-sm leading-relaxed min-h-[44px] tracking-tight flex-1">
                {displayedText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE-FIRST TOUCH CONTROLS (360° ANALOG VIRTUAL JOYSTICK + CAMERA ORBIT & ACTION CLUSTER) */}
      {gameState === 'playing' && showTouchControls && !activeDialogue && !showMenuModal && !isAnyModalOpen && (
        <div className="fixed bottom-0 inset-x-0 px-2.5 sm:px-5 pt-1.5 pb-safe pointer-events-none z-30 flex items-end justify-between select-none">
          
          {/* On-Screen 360° Analog Virtual Joystick */}
          <div className="p-1 -m-1 pointer-events-auto touch-none">
            <div
              ref={joystickBaseRef}
              role="slider"
              aria-label="Joystick virtual de movimiento"
              aria-valuetext={
                joystickState.active
                  ? joystickState.isSprintZone
                    ? 'Corriendo'
                    : 'Caminando'
                  : 'En reposo'
              }
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                joystickPointerIdRef.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                updateJoystickFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (joystickPointerIdRef.current !== e.pointerId) return;
                e.preventDefault();
                e.stopPropagation();
                updateJoystickFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                if (joystickPointerIdRef.current !== e.pointerId) return;
                e.preventDefault();
                e.stopPropagation();
                releaseJoystick();
              }}
              onPointerCancel={(e) => {
                if (joystickPointerIdRef.current !== e.pointerId) return;
                e.preventDefault();
                e.stopPropagation();
                releaseJoystick();
              }}
              onLostPointerCapture={() => {
                releaseJoystick();
              }}
              className={`relative w-28 h-28 sm:w-34 sm:h-34 flex items-center justify-center rounded-full bg-[#120d1d]/88 border-2 transition-colors touch-none cursor-grab active:cursor-grabbing ${
                joystickState.isSprintZone
                  ? 'border-[#5FE3D2] shadow-[0_0_20px_rgba(95,227,210,0.45)]'
                  : joystickState.active
                  ? 'border-[#E8B84A] shadow-[0_0_18px_rgba(232,184,74,0.35)]'
                  : 'border-[#8A6A3B]/75 shadow-[0_8px_28px_rgba(0,0,0,0.85)]'
              }`}
            >
              {/* Outer Sprint Threshold Track Ring */}
              <div
                className={`absolute inset-2.5 rounded-full border border-dashed pointer-events-none transition-colors ${
                  joystickState.isSprintZone
                    ? 'border-[#5FE3D2]/70'
                    : joystickState.active
                    ? 'border-[#E8B84A]/45'
                    : 'border-[#8A6A3B]/35'
                }`}
              />

              {/* Inner Deadzone Socket */}
              <div className="w-8 h-8 rounded-full bg-[#090612]/90 border border-[#8A6A3B]/40 pointer-events-none" />

              {/* Cardinal Runic Compass Indicators */}
              <span
                aria-hidden="true"
                className={`absolute top-1.5 left-1/2 -translate-x-1/2 text-[8px] leading-none pointer-events-none transition-colors ${
                  joystickState.normY < -0.35
                    ? joystickState.isSprintZone
                      ? 'text-[#5FE3D2]'
                      : 'text-[#E8B84A]'
                    : 'text-[#8A6A3B]/60'
                }`}
              >
                ▲
              </span>
              <span
                aria-hidden="true"
                className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] leading-none pointer-events-none transition-colors ${
                  joystickState.normY > 0.35
                    ? joystickState.isSprintZone
                      ? 'text-[#5FE3D2]'
                      : 'text-[#E8B84A]'
                    : 'text-[#8A6A3B]/60'
                }`}
              >
                ▼
              </span>
              <span
                aria-hidden="true"
                className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] leading-none pointer-events-none transition-colors ${
                  joystickState.normX < -0.35
                    ? joystickState.isSprintZone
                      ? 'text-[#5FE3D2]'
                      : 'text-[#E8B84A]'
                    : 'text-[#8A6A3B]/60'
                }`}
              >
                ◀
              </span>
              <span
                aria-hidden="true"
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] leading-none pointer-events-none transition-colors ${
                  joystickState.normX > 0.35
                    ? joystickState.isSprintZone
                      ? 'text-[#5FE3D2]'
                      : 'text-[#E8B84A]'
                    : 'text-[#8A6A3B]/60'
                }`}
              >
                ▶
              </span>

              {/* Analog Vector Tether */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                {joystickState.active && (Math.abs(joystickState.knobX) > 2 || Math.abs(joystickState.knobY) > 2) && (
                  <line
                    x1="50%"
                    y1="50%"
                    x2={`${50 + joystickState.pctX}%`}
                    y2={`${50 + joystickState.pctY}%`}
                    stroke={joystickState.isSprintZone ? '#5FE3D2' : '#E8B84A'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeOpacity="0.65"
                  />
                )}
              </svg>

              {/* Draggable Thumb Medallion Puck (GPU Compositor-Only transform) */}
              <div
                style={{
                  transform: `translate3d(${joystickState.knobX}px, ${joystickState.knobY}px, 0)`,
                }}
                className={`relative z-10 w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center pointer-events-none shadow-[0_4px_14px_rgba(0,0,0,0.85)] ${
                  joystickState.active ? 'transition-none' : 'transition-transform duration-150 ease-out'
                } ${
                  joystickState.isSprintZone
                    ? 'bg-[#153434] border-[#5FE3D2] text-[#5FE3D2] shadow-[0_0_14px_rgba(95,227,210,0.55)]'
                    : joystickState.active
                    ? 'bg-[#2A1F2D] border-[#FFF5D0] text-[#E8B84A]'
                    : 'bg-[#211730] border-[#E8B84A]/85 text-[#E8B84A]/90'
                }`}
              >
                <div className="w-9 h-9 rounded-full border border-[#8A6A3B]/50 bg-[#140e22]/80 flex items-center justify-center">
                  <span className="text-xs leading-none select-none">
                    {joystickState.isSprintZone ? '⚡' : '✦'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Thumb Cluster: Camera Orbit + Sprint / Attack / Interact */}
          <div className="flex flex-col gap-2 pointer-events-auto items-end">
            {/* Camera Orbit Thumb Row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onVirtualKey?.('KeyQ', true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onVirtualKey?.('KeyQ', false);
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  onVirtualKey?.('KeyQ', false);
                }}
                onLostPointerCapture={() => onVirtualKey?.('KeyQ', false)}
                className="w-11 h-11 rounded-full bg-[#14101C]/90 active:bg-[#2A1F2D] border-2 border-[#8A6A3B]/80 active:border-[#E8B84A] text-[#F2E6C9] active:scale-95 shadow-lg flex flex-col items-center justify-center cursor-pointer touch-none transition"
                aria-label="Girar cámara a la izquierda"
              >
                <span className="text-sm leading-none">↺</span>
                <span className="text-[5px] font-bold font-pixel mt-0.5 text-[#94a3b8]">CÁM</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onVirtualKey?.('KeyE', true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onVirtualKey?.('KeyE', false);
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  onVirtualKey?.('KeyE', false);
                }}
                onLostPointerCapture={() => onVirtualKey?.('KeyE', false)}
                className="w-11 h-11 rounded-full bg-[#14101C]/90 active:bg-[#2A1F2D] border-2 border-[#8A6A3B]/80 active:border-[#E8B84A] text-[#F2E6C9] active:scale-95 shadow-lg flex flex-col items-center justify-center cursor-pointer touch-none transition"
                aria-label="Girar cámara a la derecha"
              >
                <span className="text-sm leading-none">↻</span>
                <span className="text-[5px] font-bold font-pixel mt-0.5 text-[#94a3b8]">CÁM</span>
              </button>
            </div>

            <div className="flex items-end gap-2.5">
              {/* SPRINT BUTTON */}
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); onToggleSprint?.(); }}
                className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center cursor-pointer touch-none transition-all shadow-lg active:scale-90 ${
                  isSprinting
                    ? 'bg-[#153434] border-[#5FE3D2] text-[#5FE3D2] shadow-[0_0_14px_rgba(95,227,210,0.6)] scale-105'
                    : 'bg-[#14101C]/90 border-[#8A6A3B] text-[#cbd5e1]'
                }`}
                aria-label="Correr o Caminar"
              >
                <span className="text-xs">⚡</span>
                <span className="text-[5.5px] font-bold font-pixel tracking-tighter">CORRER</span>
              </button>

              {/* ATTACK BUTTON */}
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); onTriggerAttack?.(); }}
                className="w-12 h-12 rounded-full bg-[#14101C]/90 active:bg-[#C2234B]/40 border-2 border-[#C2234B] text-[#fca5a5] active:scale-90 shadow-lg flex flex-col items-center justify-center cursor-pointer touch-none transition-all"
                aria-label="Atacar"
              >
                <span className="text-xs">⚔️</span>
                <span className="text-[5.5px] font-bold font-pixel tracking-tighter">ATK</span>
              </button>

              {/* PRIMARY INTERACT BUTTON */}
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); onTriggerInteract?.(); }}
                className="w-15 h-15 rounded-full bg-[#2A1F2D] active:bg-[#E8B84A] border-2 border-[#E8B84A] text-[#E8B84A] active:text-[#14101C] active:scale-95 shadow-[0_0_16px_rgba(232,184,74,0.35)] flex flex-col items-center justify-center cursor-pointer touch-none transition-all"
                aria-label="Interactuar o Hablar"
              >
                <span className="text-sm font-bold font-pixel leading-none">✦</span>
                <span className="text-[6.5px] font-bold font-pixel tracking-tight mt-1">USAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUEST TRACKER (Compact Mobile-First Grimoire Card) */}
      {gameState === 'playing' && questState !== 'none' && (
        <div className="absolute top-24 sm:top-32 left-2 sm:left-3 md:left-4 pointer-events-none bg-[#0e091c]/95 border border-[#b4862a] rounded-xs p-2 sm:p-3 shadow-xl max-w-[178px] sm:max-w-xs text-[7px] sm:text-[9px] text-[#fdf6e2] z-10">
          <div className="flex items-center justify-between border-b border-[#2b1f40] pb-1 mb-1">
            <span className="text-[#fbbf24] font-bold tracking-wider uppercase flex items-center gap-1">
              <span>📜</span>
              <span>MISIÓN</span>
            </span>
            {questState === 'completed' ? (
              <span className="text-[#4ade80] text-[6.5px] sm:text-[7px] font-bold">✓ LISTA</span>
            ) : (
              <span className="text-[#38bdf8] text-[6.5px] sm:text-[7px] font-bold">ACTIVA</span>
            )}
          </div>
          <div className="text-[#cbd5e1] leading-snug text-[6.5px] sm:text-[8px]">
            {questState === 'active'
              ? 'Captura un alma de AGUA y habla con el Anciano Kaelen.'
              : '¡Aguas purificadas! (+3 Cristales Superiores).'}
          </div>
        </div>
      )}

      {/* SOUL COLLECTION NOTIFICATION TOAST (Clean Trophy Card) */}
      {notification && (
        <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 pointer-events-auto bg-[#110c1f]/95 border-2 border-[#fbbf24] rounded-xs p-3 sm:p-4 shadow-[0_0_30px_rgba(0,0,0,0.95)] flex items-center gap-3 animate-fade-in z-40 max-w-sm w-[90vw] mx-2">
          <div className="w-10 h-10 bg-[#07050d] border border-[#fbbf24] rounded-xs flex items-center justify-center text-xl shrink-0">
            🔮
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[7px] text-[#fbbf24] font-bold uppercase tracking-wider">¡Esencia de Alma Rescatada!</div>
            <div className="font-bold text-[#fef3c7] text-xs truncate">{notification.name}</div>
            <div className="text-[8px] text-[#94a3b8] italic truncate">"{notification.title}"</div>
          </div>
        </div>
      )}

      {/* SAVE GAME CONFIRMATION TOAST */}
      {saveNotice && (
        <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 pointer-events-auto bg-[#14101C]/95 border-2 border-[#5FE3D2] rounded-xs p-3 sm:p-4 shadow-[0_0_30px_rgba(95,227,210,0.4)] flex items-center gap-3 animate-fade-in z-50 max-w-sm w-[90vw] mx-2">
          <div className="w-10 h-10 bg-[#07050d] border border-[#5FE3D2] rounded-xs flex items-center justify-center text-xl shrink-0">
            💾
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[7px] text-[#5FE3D2] font-bold uppercase tracking-wider">Grimorio de Almas</div>
            <div className="font-bold text-[#F2E6C9] text-xs truncate">{saveNotice}</div>
          </div>
        </div>
      )}

    </div>
  );
};

