/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { BiomeId } from '../../world/biomes/BiomeDefinition';
import type { BiomeMask } from '../../world/biomes/BiomeMask';
import type { WorldEditorBiomeItem } from '../../world/editor/WorldEditor';
import { sampleBiomeAt } from '../../world/proceduralTerrain';

interface BiomesEditorPanelProps {
  biomes: WorldEditorBiomeItem[];
  masks: BiomeMask[];
  onToggleBiome: (biomeId: string, enabled: boolean) => void;
  onSetPriority: (biomeId: string, priority: number) => void;
  onAddMask: (mask: BiomeMask) => void;
  onRemoveMask: (maskId: string) => void;
  cursorPos: { x: number; y: number; z: number } | null;
  playerPos: { x: number; y: number; z: number };
  onRegenerateRegion: (region?: { minX: number; minZ: number; maxX: number; maxZ: number }) => void;
}

const BIOME_NAMES: Record<string, { name: string; color: string; desc: string }> = {
  plains: { name: 'Praderas', color: '#4ade80', desc: 'Llanuras verdes y claros' },
  forest: { name: 'Bosque Profundo', color: '#15803d', desc: 'Arboledas densas' },
  mountain: { name: 'Montañas', color: '#94a3b8', desc: 'Rocas y crestas escarpadas' },
  snow: { name: 'Cumbres Nevadas', color: '#e0f2fe', desc: 'Hielo y nieve eterna' },
  desert: { name: 'Tierras Áridas', color: '#f59e0b', desc: 'Arenas y dunas doradas' },
  swamp: { name: 'Ciénaga', color: '#4d5d43', desc: 'Aguas estancadas y lodo' },
  dungeon: { name: 'Cripta Abisal', color: '#6b21a8', desc: 'Suelo espectral corrompido' },
  mystic: { name: 'Valle Místico', color: '#a855f7', desc: 'Cristales y runas de luz' },
  valley: { name: 'Valle del Río', color: '#38bdf8', desc: 'Riberas fértiles' },
  coast: { name: 'Costa y Playa', color: '#38bdf8', desc: 'Orillas oceánicas' },
};

export const BiomesEditorPanel: React.FC<BiomesEditorPanelProps> = ({
  biomes,
  masks,
  onToggleBiome,
  onSetPriority,
  onAddMask,
  onRemoveMask,
  cursorPos,
  playerPos,
  onRegenerateRegion,
}) => {
  // Sampled biome at cursor
  const sampled = cursorPos ? sampleBiomeAt(cursorPos.x, cursorPos.z) : null;

  // Mask creation state
  const [maskBiomeId, setMaskBiomeId] = useState<BiomeId>('forest');
  const [maskMode, setMaskMode] = useState<BiomeMask['mode']>('override');
  const [maskRadius, setMaskRadius] = useState<number>(30);
  const [maskStrength, setMaskStrength] = useState<number>(0.9);
  const [maskFalloff, setMaskFalloff] = useState<number>(0.2);
  const [maskPriority, setMaskPriority] = useState<number>(50);

  const handleCreateMask = () => {
    const x = cursorPos ? Math.round(cursorPos.x) : Math.round(playerPos.x);
    const z = cursorPos ? Math.round(cursorPos.z) : Math.round(playerPos.z);
    const newMask: BiomeMask = {
      id: `mask-${maskBiomeId}-${Date.now().toString(36).slice(-4)}`,
      biomeId: maskBiomeId,
      mode: maskMode,
      shape: {
        type: 'circle',
        center: { x, z },
        radius: maskRadius,
      },
      falloff: maskFalloff,
      strength: maskStrength,
      priority: maskPriority,
      enabled: true,
      tags: ['editor-mask'],
    };

    onAddMask(newMask);

    onRegenerateRegion({
      minX: x - maskRadius * 1.5,
      minZ: z - maskRadius * 1.5,
      maxX: x + maskRadius * 1.5,
      maxZ: z + maskRadius * 1.5,
    });
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-xs text-[#d8d1e8] max-h-[calc(100vh-160px)] overflow-y-auto">
      {/* Current Biome readout */}
      <div className="flex items-center justify-between rounded bg-[#13121f] border border-[#2d293d] p-2.5">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#8e85a3] block">Bioma en Cursor:</span>
          {sampled ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: BIOME_NAMES[sampled.biome]?.color ?? '#fff' }}
              ></span>
              <span className="font-bold text-[#f6d477]">
                {BIOME_NAMES[sampled.biome]?.name ?? sampled.biome}
              </span>
              <span className="text-[10px] text-[#8e85a3] font-mono">
                (Elev: {sampled.elevation.toFixed(1)}m, Pendiente: {(sampled.slope * 100).toFixed(0)}%)
              </span>
            </div>
          ) : (
            <span className="text-[#6e6680] italic">Coloca el cursor sobre el mapa</span>
          )}
        </div>
      </div>

      {/* Biomes Priority List */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between border-b border-[#2d293d] pb-1">
          <span className="font-semibold text-[#f6d477] uppercase tracking-wider text-[11px]">
            Tabla de Prioridad de Biomas
          </span>
          <span className="text-[10px] text-[#8e85a3]">Mayor prioridad domina</span>
        </div>

        <div className="flex flex-col gap-1">
          {biomes.map((item) => {
            const meta = BIOME_NAMES[item.id] ?? { name: item.id, color: '#aaa', desc: '' };
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded bg-[#151424] border border-[#272338] px-2.5 py-1.5 hover:border-[#3d3856] transition"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => {
                      onToggleBiome(item.id, e.target.checked);
                      onRegenerateRegion();
                    }}
                    className="rounded bg-[#1c1a2c] border-[#38334d] text-[#f6d477] focus:ring-0"
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.color }}
                  ></span>
                  <div>
                    <span className={`font-medium ${item.enabled ? 'text-[#e4dcf5]' : 'text-[#6e6680] line-through'}`}>
                      {meta.name}
                    </span>
                    <span className="text-[9px] text-[#8e85a3] block font-mono">id: {item.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSetPriority(item.id, Math.max(1, item.priority - 5));
                      onRegenerateRegion();
                    }}
                    className="rounded bg-[#1c1a2c] px-1.5 py-0.5 text-[10px] border border-[#38334d] hover:bg-[#28253d]"
                  >
                    -
                  </button>
                  <span className="font-mono text-[#f6d477] w-6 text-center font-semibold">
                    {item.priority}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSetPriority(item.id, item.priority + 5);
                      onRegenerateRegion();
                    }}
                    className="rounded bg-[#1c1a2c] px-1.5 py-0.5 text-[10px] border border-[#38334d] hover:bg-[#28253d]"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Biome Mask Generator */}
      <div className="flex flex-col gap-2 rounded bg-[#13121f] border border-[#2d293d] p-3">
        <span className="font-semibold text-[#f6d477]">Pintor de Máscara de Bioma</span>
        <p className="text-[10px] text-[#8e85a3]">
          Aplica un bioma forzado en un radio específico usando el cursor 3D.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">Bioma a Pintar</label>
            <select
              value={maskBiomeId}
              onChange={(e) => setMaskBiomeId(e.target.value as BiomeId)}
              className="w-full rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs text-[#e4dcf5]"
            >
              {Object.entries(BIOME_NAMES).map(([id, info]) => (
                <option key={id} value={id}>
                  {info.name} ({id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">Modo de Pintado</label>
            <select
              value={maskMode}
              onChange={(e) => setMaskMode(e.target.value as BiomeMask['mode'])}
              className="w-full rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs text-[#e4dcf5]"
            >
              <option value="override">Sobrescribir (Override)</option>
              <option value="add">Sumar Peso (Blend)</option>
              <option value="subtract">Restar (Subtract)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Radio: {maskRadius}m
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={maskRadius}
              onChange={(e) => setMaskRadius(parseInt(e.target.value, 10))}
              className="w-full accent-[#f6d477]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Fuerza: {Math.round(maskStrength * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={maskStrength}
              onChange={(e) => setMaskStrength(parseFloat(e.target.value))}
              className="w-full accent-[#34d399]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateMask}
          className="rounded bg-[#f6d477] py-1.5 text-xs font-bold text-[#151221] hover:bg-[#ffe18f] shadow transition mt-1"
        >
          ＋ Aplicar Máscara en Cursor 3D
        </button>
      </div>

      {/* Active Masks List */}
      {masks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-[#f6d477] text-[11px] uppercase tracking-wider">
            Máscaras Activas ({masks.length})
          </span>
          {masks.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded bg-[#151424] border border-[#272338] px-2.5 py-1 text-[11px]"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[#38bdf8] font-mono">{m.biomeId}</span>
                <span className="text-[#8e85a3]">({m.mode})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onRemoveMask(m.id);
                  onRegenerateRegion();
                }}
                className="text-[#fca5a5] hover:text-white transition px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
