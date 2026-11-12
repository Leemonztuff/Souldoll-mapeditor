/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GameEngine } from '../../game/engine';
import {
  WorldEditor,
  createDefaultWorldEditorState,
  createTerrainStampCommand,
  removeTerrainStampCommand,
  createBiomeToggleCommand,
  createBiomePriorityCommand,
  createScatterToggleCommand,
  createScatterDensityCommand,
  createSplineToggleCommand,
  createSplinePointsCommand,
  createWorkZoneCommand,
  removeWorkZoneCommand,
  type EditorTool,
  type WorldEditorState,
} from '../../world/editor';
import { EditorGizmoManager } from '../../world/editor/EditorGizmoManager';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolBar } from './EditorToolBar';
import { EditorBottomBar } from './EditorBottomBar';
import { TerrainEditorPanel } from './TerrainEditorPanel';
import { BiomesEditorPanel } from './BiomesEditorPanel';
import { ScatterEditorPanel } from './ScatterEditorPanel';
import { SplinesEditorPanel } from './SplinesEditorPanel';
import { WorkZoneEditorPanel } from './WorkZoneEditorPanel';
import {
  getActiveTerrainSampler,
  getWorldDefinition,
  setWorldDefinition,
} from '../../world/worldGen';
import { getActiveBiomeGenerator } from '../../world/proceduralTerrain';
import { StampedTerrainSampler } from '../../world/terrain/TerrainStampBlender';
import { SOULDOLLS_TERRAIN_STAMPS } from '../../world/terrain/terrainStamps.data';
import type { BiomeMask } from '../../world/biomes/BiomeMask';
import type { TerrainStamp } from '../../world/terrain/TerrainStamp';
import type { WorkZone } from '../../world/core/WorkZone';
import type { Vec2 } from '../../world/core/WorldTypes';

interface MapEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: GameEngine | null;
}

export const MapEditorModal: React.FC<MapEditorModalProps> = ({
  isOpen,
  onClose,
  engine,
}) => {
  // WorldEditor instance
  const editorRef = useRef<WorldEditor | null>(null);
  const gizmoManagerRef = useRef<EditorGizmoManager | null>(null);

  // Synchronized editor state
  const [editorState, setEditorState] = useState<WorldEditorState>(() => {
    const worldDef = getWorldDefinition();
    return createDefaultWorldEditorState({
      enabled: true,
      activeTool: 'terrain',
      worldName: worldDef.name,
      seed: worldDef.seed.root,
      workZones: worldDef.terrain.workZones.length > 0
        ? worldDef.terrain.workZones
        : [{ id: 'wz-village', name: 'Villa y Alrededores', center: { x: 0, z: 0 }, size: { x: 256, z: 256 }, enabled: true, tags: ['village'] }],
      terrainStamps: worldDef.terrain.stamps.length > 0 ? worldDef.terrain.stamps : SOULDOLLS_TERRAIN_STAMPS,
      biomeDefinitions: [
        { id: 'plains', enabled: true, priority: 1, tags: [] },
        { id: 'forest', enabled: true, priority: 10, tags: [] },
        { id: 'mountain', enabled: true, priority: 20, tags: [] },
        { id: 'snow', enabled: true, priority: 30, tags: [] },
        { id: 'desert', enabled: true, priority: 15, tags: [] },
        { id: 'swamp', enabled: true, priority: 25, tags: [] },
        { id: 'dungeon', enabled: true, priority: 40, tags: [] },
        { id: 'mystic', enabled: true, priority: 35, tags: [] },
        { id: 'valley', enabled: true, priority: 18, tags: [] },
        { id: 'coast', enabled: true, priority: 28, tags: [] },
      ],
      scatterGroups: [
        { id: 'trees', enabled: true, density: 1.0, tags: ['vegetation'] },
        { id: 'bushes', enabled: true, density: 1.0, tags: ['vegetation'] },
        { id: 'rocks', enabled: true, density: 1.0, tags: ['geology'] },
        { id: 'structures', enabled: true, density: 1.0, tags: ['pois'] },
        { id: 'reeds', enabled: true, density: 1.0, tags: ['water'] },
      ],
      splineDefinitions: [
        { id: 'road-main', type: 'road', enabled: true, points: [{ x: 0, z: 16 }, { x: 24, z: 8 }, { x: 50, z: -10 }] },
        { id: 'river-luminati', type: 'river', enabled: true, points: [{ x: -120, z: -60 }, { x: 0, z: -40 }, { x: 100, z: -80 }] },
        { id: 'lake-edge', type: 'lake', enabled: true, points: [{ x: 80, z: -80 }, { x: 120, z: -80 }, { x: 100, z: -60 }] },
      ],
    });
  });

  // Masks
  const [masks, setMasks] = useState<BiomeMask[]>([]);

  // 3D Cursor position in world coordinates
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Editor listo. Selecciona una herramienta.');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Selected items in subpanels
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [selectedSplineId, setSelectedSplineId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Panel collapsed state for mobile
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportJsonString, setExportJsonString] = useState<string>('');

  // Player position
  const [playerPos, setPlayerPos] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Initialize WorldEditor instance
  useEffect(() => {
    if (!editorRef.current) {
      editorRef.current = new WorldEditor(editorState);
    }
  }, []);

  // Initialize GizmoManager with Three.js scene
  useEffect(() => {
    if (!engine) return;
    const scene = engine.getScene();
    if (!gizmoManagerRef.current) {
      gizmoManagerRef.current = new EditorGizmoManager(scene);
    }
    return () => {
      gizmoManagerRef.current?.dispose();
      gizmoManagerRef.current = null;
    };
  }, [engine]);

  // Handle open/close lifecycle
  useEffect(() => {
    if (!engine) return;
    engine.setEditorActive(isOpen);
    gizmoManagerRef.current?.setVisible(isOpen);

    if (isOpen) {
      const pos = engine.getPlayerPosition();
      setPlayerPos(pos);
    }
  }, [isOpen, engine]);

  // Synchronize gizmo with selected stamp or workzone
  useEffect(() => {
    if (!isOpen || !gizmoManagerRef.current) return;

    if (editorState.activeTool === 'terrain') {
      const stamp = editorState.terrainStamps.find((s) => s.id === selectedStampId);
      if (stamp) {
        gizmoManagerRef.current.setStampGizmo({
          x: stamp.position.x,
          z: stamp.position.z,
          scaleX: stamp.scale.x,
          scaleZ: stamp.scale.z,
          rotation: stamp.rotation,
          falloffInner: stamp.falloff.inner,
        });
      } else {
        gizmoManagerRef.current.setStampGizmo(null);
      }
      gizmoManagerRef.current.setWorkZoneGizmo(null);
    } else if (editorState.activeTool === 'workzone') {
      const zone = editorState.workZones.find((z) => z.id === selectedZoneId) ?? editorState.workZones[0];
      if (zone) {
        const halfX = Math.abs(zone.size.x) * 0.5;
        const halfZ = Math.abs(zone.size.z) * 0.5;
        gizmoManagerRef.current.setWorkZoneGizmo({
          minX: zone.center.x - halfX,
          minZ: zone.center.z - halfZ,
          maxX: zone.center.x + halfX,
          maxZ: zone.center.z + halfZ,
        });
      } else {
        gizmoManagerRef.current.setWorkZoneGizmo(null);
      }
      gizmoManagerRef.current.setStampGizmo(null);
    } else {
      gizmoManagerRef.current.setStampGizmo(null);
      gizmoManagerRef.current.setWorkZoneGizmo(null);
    }
  }, [isOpen, editorState.activeTool, selectedStampId, selectedZoneId, editorState.terrainStamps, editorState.workZones]);

  // Mouse move listener to update 3D cursor position
  useEffect(() => {
    if (!isOpen || !engine) return;

    const handlePointerMove = (e: PointerEvent) => {
      const hit = engine.getGroundIntersection(e.clientX, e.clientY);
      if (hit) {
        setCursorPos(hit);
        gizmoManagerRef.current?.updateCursor(hit.x, hit.y, hit.z);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isOpen, engine]);

  // Keyboard shortcut listener (F2 / Backquote for toggle, Escape for close, Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Chunk invalidation & rebuild helper
  const handleRegenerateRegion = useCallback(
    (bounds?: { minX: number; minZ: number; maxX: number; maxZ: number }) => {
      if (!engine) return;
      setIsGenerating(true);
      setStatusMessage('Regenerando chunks en tiempo real...');

      try {
        const chunkManager = engine.getChunkManager();
        if (chunkManager) {
          chunkManager.invalidateRegion(bounds);
        }
        setStatusMessage(
          bounds
            ? `Región [${bounds.minX.toFixed(0)}, ${bounds.minZ.toFixed(0)} - ${bounds.maxX.toFixed(0)}, ${bounds.maxZ.toFixed(0)}] regenerada`
            : 'Mundo local regenerado con éxito'
        );
      } catch (err) {
        setStatusMessage(`Error al regenerar: ${String(err)}`);
      } finally {
        setIsGenerating(false);
      }
    },
    [engine]
  );

  // Sync state changes with the real engine
  const syncWithEngine = useCallback((nextState: WorldEditorState) => {
    // 1. Update StampedTerrainSampler
    const sampler = getActiveTerrainSampler();
    if (sampler instanceof StampedTerrainSampler) {
      sampler.setStamps(nextState.terrainStamps);
    }

    // 2. Update WorldDefinition
    const currentDef = getWorldDefinition();
    const updatedDef = {
      ...currentDef,
      terrain: {
        ...currentDef.terrain,
        stamps: nextState.terrainStamps,
        workZones: nextState.workZones,
      },
    };
    setWorldDefinition(updatedDef);
    setHasUnsavedChanges(true);
  }, []);

  // Command execution wrapper
  const executeCommand = useCallback(
    (commandCreator: (state: WorldEditorState) => any) => {
      const editor = editorRef.current;
      if (!editor) return;

      const command = commandCreator(editorState);
      const executed = editor.execute(command);
      if (executed) {
        const nextState = editor.getState();
        setEditorState(nextState);
        syncWithEngine(nextState);
        setCanUndo(true);
        setCanRedo(false);
        setStatusMessage(command.description);
      }
    },
    [editorState, syncWithEngine]
  );

  const handleUndo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.undo()) {
      const nextState = editor.getState();
      setEditorState(nextState);
      syncWithEngine(nextState);
      setCanUndo(true);
      setCanRedo(true);
      setStatusMessage('Deshecho');
      handleRegenerateRegion();
    }
  }, [syncWithEngine, handleRegenerateRegion]);

  const handleRedo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.redo()) {
      const nextState = editor.getState();
      setEditorState(nextState);
      syncWithEngine(nextState);
      setCanUndo(true);
      setStatusMessage('Rehecho');
      handleRegenerateRegion();
    }
  }, [syncWithEngine, handleRegenerateRegion]);

  // Tool selection
  const handleSelectTool = (tool: EditorTool) => {
    setEditorState((prev) => ({ ...prev, activeTool: tool }));
    setStatusMessage(`Herramienta activa: ${tool.toUpperCase()}`);
  };

  // Terrain actions
  const handleSaveStamp = (stamp: TerrainStamp) => {
    executeCommand((st) => createTerrainStampCommand(st, stamp));
    setSelectedStampId(stamp.id);
  };

  const handleRemoveStamp = (stampId: string) => {
    executeCommand((st) => removeTerrainStampCommand(st, stampId));
    setSelectedStampId(null);
  };

  // Biome actions
  const handleToggleBiome = (biomeId: string, enabled: boolean) => {
    executeCommand((st) => createBiomeToggleCommand(st, biomeId, enabled));
  };

  const handleSetBiomePriority = (biomeId: string, priority: number) => {
    executeCommand((st) => createBiomePriorityCommand(st, biomeId, priority));
  };

  const handleAddMask = (mask: BiomeMask) => {
    const nextMasks = [...masks, mask];
    setMasks(nextMasks);
    getActiveBiomeGenerator().setMasks(nextMasks);
    setStatusMessage(`Máscara ${mask.id} agregada`);
  };

  const handleRemoveMask = (maskId: string) => {
    const nextMasks = masks.filter((m) => m.id !== maskId);
    setMasks(nextMasks);
    getActiveBiomeGenerator().setMasks(nextMasks);
    setStatusMessage(`Máscara ${maskId} eliminada`);
  };

  // Scatter actions
  const handleToggleScatterGroup = (groupId: string, enabled: boolean) => {
    executeCommand((st) => createScatterToggleCommand(st, groupId, enabled));
  };

  const handleSetScatterDensity = (groupId: string, density: number) => {
    executeCommand((st) => createScatterDensityCommand(st, groupId, density));
  };

  // Spline actions
  const handleToggleSpline = (splineId: string, enabled: boolean) => {
    executeCommand((st) => createSplineToggleCommand(st, splineId, enabled));
  };

  const handleUpdateSplinePoints = (splineId: string, points: Vec2[]) => {
    executeCommand((st) => createSplinePointsCommand(st, splineId, points));
  };

  // WorkZone actions
  const handleSaveWorkZone = (zone: WorkZone) => {
    executeCommand((st) => createWorkZoneCommand(st, zone));
    setSelectedZoneId(zone.id);
  };

  const handleRemoveWorkZone = (zoneId: string) => {
    executeCommand((st) => removeWorkZoneCommand(st, zoneId));
    setSelectedZoneId(null);
  };

  // Export JSON definition
  const handleExportJson = () => {
    const def = getWorldDefinition();
    const jsonStr = JSON.stringify(def, null, 2);
    setExportJsonString(jsonStr);
    setShowExportModal(true);
    setStatusMessage('Definición de mundo exportada');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] pointer-events-none flex flex-col justify-between font-sans select-none overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Top Bar */}
      <div className="pointer-events-auto">
        <EditorTopBar
          worldName={editorState.worldName}
          seed={editorState.seed}
          cursorPos={cursorPos}
          isGenerating={isGenerating}
          onClose={onClose}
        />
      </div>

      {/* Main Middle Container: Floating Context Panel */}
      <div className="flex-1 flex justify-end p-3 pointer-events-none overflow-hidden relative">
        {/* Toggle Collapse Button for Mobile / Small Viewports */}
        <button
          type="button"
          onClick={() => setIsPanelCollapsed((c) => !c)}
          className="pointer-events-auto absolute top-4 right-4 z-20 sm:hidden rounded bg-[#1e1a2f] border border-[#3b344e] p-2 text-[#f6d477] shadow-lg"
          title="Colapsar panel"
        >
          {isPanelCollapsed ? '◀ Mostrar' : '▶ Ocultar'}
        </button>

        {/* Side Context Panel */}
        <div
          className={`pointer-events-auto w-full sm:w-[380px] md:w-[420px] max-w-full rounded-lg border border-[#3b344e] bg-[#0c0d15]/95 shadow-2xl backdrop-blur-md flex flex-col transition-all duration-200 ${
            isPanelCollapsed ? 'translate-x-[110%] opacity-0 sm:translate-x-0 sm:opacity-100' : 'translate-x-0 opacity-100'
          }`}
        >
          {/* Tool Selector Tabs */}
          <EditorToolBar
            activeTool={editorState.activeTool}
            onSelectTool={handleSelectTool}
            counts={{
              stamps: editorState.terrainStamps.length,
              biomes: editorState.biomeDefinitions.length,
              scatter: editorState.scatterGroups.length,
              splines: editorState.splineDefinitions.length,
              workZones: editorState.workZones.length,
            }}
          />

          {/* Contextual Panel based on Active Tool */}
          <div className="flex-1 overflow-y-auto">
            {editorState.activeTool === 'terrain' && (
              <TerrainEditorPanel
                stamps={editorState.terrainStamps}
                selectedStampId={selectedStampId}
                onSelectStamp={setSelectedStampId}
                onSaveStamp={handleSaveStamp}
                onRemoveStamp={handleRemoveStamp}
                cursorPos={cursorPos}
                playerPos={playerPos}
                onRegenerateRegion={handleRegenerateRegion}
              />
            )}

            {editorState.activeTool === 'biome' && (
              <BiomesEditorPanel
                biomes={editorState.biomeDefinitions}
                masks={masks}
                onToggleBiome={handleToggleBiome}
                onSetPriority={handleSetBiomePriority}
                onAddMask={handleAddMask}
                onRemoveMask={handleRemoveMask}
                cursorPos={cursorPos}
                playerPos={playerPos}
                onRegenerateRegion={handleRegenerateRegion}
              />
            )}

            {editorState.activeTool === 'scatter' && (
              <ScatterEditorPanel
                groups={editorState.scatterGroups}
                onToggleGroup={handleToggleScatterGroup}
                onSetDensity={handleSetScatterDensity}
                onRegenerateRegion={handleRegenerateRegion}
              />
            )}

            {editorState.activeTool === 'spline' && (
              <SplinesEditorPanel
                splines={editorState.splineDefinitions}
                selectedSplineId={selectedSplineId}
                onSelectSpline={setSelectedSplineId}
                onToggleSpline={handleToggleSpline}
                onUpdatePoints={handleUpdateSplinePoints}
                cursorPos={cursorPos}
                onRegenerateRegion={handleRegenerateRegion}
              />
            )}

            {editorState.activeTool === 'workzone' && (
              <WorkZoneEditorPanel
                workZones={editorState.workZones}
                selectedZoneId={selectedZoneId}
                onSelectZone={setSelectedZoneId}
                onSaveZone={handleSaveWorkZone}
                onRemoveZone={handleRemoveWorkZone}
                playerPos={playerPos}
                cursorPos={cursorPos}
                onRegenerateRegion={handleRegenerateRegion}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="pointer-events-auto">
        <EditorBottomBar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          statusMessage={statusMessage}
          hasUnsavedChanges={hasUnsavedChanges}
          onExportJson={handleExportJson}
        />
      </div>

      {/* Export JSON Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-[300] pointer-events-auto flex items-center justify-center bg-black/80 p-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-2xl rounded-lg border border-[#f6d477]/40 bg-[#0f101a] p-4 shadow-2xl flex flex-col gap-3 text-xs text-[#e4dcf5]">
            <div className="flex items-center justify-between border-b border-[#2d293d] pb-2">
              <span className="text-sm font-bold text-[#f6d477] uppercase tracking-wider">
                Definición JSON del Mundo
              </span>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-[#9e96b3] hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <textarea
              readOnly
              value={exportJsonString}
              rows={16}
              className="w-full rounded bg-[#09090f] border border-[#2d293d] p-2.5 font-mono text-[11px] text-[#34d399] focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(exportJsonString);
                  setStatusMessage('JSON copiado al portapapeles');
                }}
                className="rounded bg-[#1e1b2d] border border-[#3b344e] px-3 py-1.5 font-medium text-[#e4dcf5] hover:bg-[#2d2844] transition"
              >
                Copiar al Portapapeles
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([exportJsonString], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `world-${editorState.worldName}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded bg-[#f6d477] px-3 py-1.5 font-bold text-[#151221] hover:bg-[#ffe18f] transition"
              >
                Descargar Archivo JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
