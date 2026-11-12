/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { TerrainStamp } from '../../world/terrain/TerrainStamp';

interface TerrainEditorPanelProps {
  stamps: TerrainStamp[];
  selectedStampId: string | null;
  onSelectStamp: (id: string | null) => void;
  onSaveStamp: (stamp: TerrainStamp) => void;
  onRemoveStamp: (id: string) => void;
  cursorPos: { x: number; y: number; z: number } | null;
  playerPos: { x: number; y: number; z: number };
  onRegenerateRegion: (region?: { minX: number; minZ: number; maxX: number; maxZ: number }) => void;
}

export const TerrainEditorPanel: React.FC<TerrainEditorPanelProps> = ({
  stamps,
  selectedStampId,
  onSelectStamp,
  onSaveStamp,
  onRemoveStamp,
  cursorPos,
  playerPos,
  onRegenerateRegion,
}) => {
  const selectedStamp = stamps.find((s) => s.id === selectedStampId);

  // Form state for editing or creating
  const [id, setId] = useState(selectedStamp?.id ?? `stamp-${Date.now().toString(36).slice(-4)}`);
  const [category, setCategory] = useState<TerrainStamp['category']>(selectedStamp?.category ?? 'hill');
  const [posX, setPosX] = useState(selectedStamp?.position.x ?? cursorPos?.x ?? 0);
  const [posZ, setPosZ] = useState(selectedStamp?.position.z ?? cursorPos?.z ?? 0);
  const [scaleX, setScaleX] = useState(selectedStamp?.scale.x ?? 16);
  const [scaleZ, setScaleZ] = useState(selectedStamp?.scale.z ?? 16);
  const [amplitude, setAmplitude] = useState(selectedStamp?.scale.amplitude ?? 5.0);
  const [rotationDeg, setRotationDeg] = useState(Math.round(((selectedStamp?.rotation ?? 0) * 180) / Math.PI));
  const [intensity, setIntensity] = useState(selectedStamp?.intensity ?? 0.9);
  const [blendMode, setBlendMode] = useState<TerrainStamp['blendMode']>(selectedStamp?.blendMode ?? 'add');
  const [falloffType, setFalloffType] = useState<TerrainStamp['falloff']['type']>(selectedStamp?.falloff.type ?? 'smoothstep');
  const [falloffInner, setFalloffInner] = useState(selectedStamp?.falloff.inner ?? 0.15);
  const [priority, setPriority] = useState(selectedStamp?.priority ?? 10);
  const [enabled, setEnabled] = useState(selectedStamp?.enabled ?? true);

  // Update local form when selection changes
  React.useEffect(() => {
    if (selectedStamp) {
      setId(selectedStamp.id);
      setCategory(selectedStamp.category);
      setPosX(selectedStamp.position.x);
      setPosZ(selectedStamp.position.z);
      setScaleX(selectedStamp.scale.x);
      setScaleZ(selectedStamp.scale.z);
      setAmplitude(selectedStamp.scale.amplitude);
      setRotationDeg(Math.round((selectedStamp.rotation * 180) / Math.PI));
      setIntensity(selectedStamp.intensity);
      setBlendMode(selectedStamp.blendMode);
      setFalloffType(selectedStamp.falloff.type);
      setFalloffInner(selectedStamp.falloff.inner);
      setPriority(selectedStamp.priority);
      setEnabled(selectedStamp.enabled);
    }
  }, [selectedStampId]);

  const handleCreateNew = () => {
    const newId = `stamp-${category}-${Math.floor(Math.random() * 900 + 100)}`;
    const x = cursorPos ? Math.round(cursorPos.x) : Math.round(playerPos.x);
    const z = cursorPos ? Math.round(cursorPos.z) : Math.round(playerPos.z);
    setId(newId);
    setPosX(x);
    setPosZ(z);
    onSelectStamp(null);
  };

  const handleApply = () => {
    const stamp: TerrainStamp = {
      id,
      category,
      source: { kind: 'preset', preset: category, seed: Math.floor(Math.random() * 10000) },
      seed: Math.floor(Math.random() * 10000),
      position: { x: posX, z: posZ },
      rotation: (rotationDeg * Math.PI) / 180,
      scale: { x: scaleX, z: scaleZ, amplitude },
      intensity,
      blendMode,
      falloff: { type: falloffType, inner: falloffInner, outer: 1.0 },
      enabled,
      priority,
      tags: ['editor', category],
    };

    onSaveStamp(stamp);
    onSelectStamp(stamp.id);

    // Invalidate affected region around stamp
    const maxRadius = Math.max(scaleX, scaleZ) * 1.2;
    onRegenerateRegion({
      minX: posX - maxRadius,
      minZ: posZ - maxRadius,
      maxX: posX + maxRadius,
      maxZ: posZ + maxRadius,
    });
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-xs text-[#d8d1e8] max-h-[calc(100vh-160px)] overflow-y-auto">
      {/* Existing Stamps Header & Selector */}
      <div className="flex items-center justify-between border-b border-[#2d293d] pb-2">
        <span className="font-semibold text-[#f6d477] uppercase tracking-wider text-[11px]">
          Estampas Activas ({stamps.length})
        </span>
        <button
          type="button"
          onClick={handleCreateNew}
          className="rounded bg-[#f6d477]/20 border border-[#f6d477]/40 px-2 py-1 text-[11px] font-medium text-[#f6d477] hover:bg-[#f6d477]/30 transition"
        >
          ＋ Nueva Estampa
        </button>
      </div>

      {/* Quick stamp buttons */}
      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
        {stamps.map((s) => {
          const isSelected = s.id === selectedStampId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStamp(s.id)}
              className={`rounded px-2 py-1 text-[11px] font-mono flex items-center gap-1.5 border transition ${
                isSelected
                  ? 'bg-[#3b3353] border-[#f6d477] text-[#fff]'
                  : 'bg-[#181624] border-[#2c283d] text-[#b3a8c7] hover:border-[#4d4566]'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.enabled ? 'bg-[#34d399]' : 'bg-[#ef4444]'}`}></span>
              <span>{s.id}</span>
            </button>
          );
        })}
      </div>

      {/* Editor Form */}
      <div className="flex flex-col gap-2.5 rounded bg-[#13121f] border border-[#2d293d] p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#f6d477]">
            {selectedStamp ? `Editar: ${selectedStamp.id}` : 'Nueva Estampa'}
          </span>
          <label className="flex items-center gap-2 cursor-pointer text-[11px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded bg-[#1b1928] border-[#38334d] text-[#f6d477] focus:ring-0"
            />
            <span className={enabled ? 'text-[#34d399]' : 'text-[#ef4444]'}>
              {enabled ? 'Habilitada' : 'Deshabilitada'}
            </span>
          </label>
        </div>

        {/* ID & Category */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs text-[#e4dcf5] font-mono focus:border-[#f6d477] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">Preset Forma</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TerrainStamp['category'])}
              className="w-full rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs text-[#e4dcf5] focus:border-[#f6d477] focus:outline-none"
            >
              <option value="hill">Colina (Hill)</option>
              <option value="mountain">Montaña (Mountain)</option>
              <option value="valley">Valle (Valley)</option>
              <option value="crater">Cráter (Crater)</option>
              <option value="plateau">Meseta (Plateau)</option>
              <option value="ridge">Cresta (Ridge)</option>
              <option value="dune">Duna (Dune)</option>
            </select>
          </div>
        </div>

        {/* Position X / Z with quick snapping */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-[#8e85a3]">Posición (X, Z)</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (cursorPos) {
                    setPosX(Math.round(cursorPos.x));
                    setPosZ(Math.round(cursorPos.z));
                  }
                }}
                disabled={!cursorPos}
                className="text-[10px] rounded bg-[#272338] hover:bg-[#393450] px-1.5 py-0.5 text-[#f6d477] border border-[#3a354e] disabled:opacity-40"
                title="Tomar coordenadas del cursor 3D"
              >
                Cursor
              </button>
              <button
                type="button"
                onClick={() => {
                  setPosX(Math.round(playerPos.x));
                  setPosZ(Math.round(playerPos.z));
                }}
                className="text-[10px] rounded bg-[#272338] hover:bg-[#393450] px-1.5 py-0.5 text-[#38bdf8] border border-[#3a354e]"
                title="Centrar en la posición del jugador"
              >
                Jugador
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="1"
              value={posX}
              onChange={(e) => setPosX(parseFloat(e.target.value) || 0)}
              className="rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs font-mono text-[#e4dcf5]"
              placeholder="X"
            />
            <input
              type="number"
              step="1"
              value={posZ}
              onChange={(e) => setPosZ(parseFloat(e.target.value) || 0)}
              className="rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs font-mono text-[#e4dcf5]"
              placeholder="Z"
            />
          </div>
        </div>

        {/* Scale (Radius X, Z) & Amplitude */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Radio X: {scaleX}m
            </label>
            <input
              type="range"
              min="4"
              max="60"
              step="1"
              value={scaleX}
              onChange={(e) => setScaleX(parseInt(e.target.value, 10))}
              className="w-full accent-[#f6d477]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Radio Z: {scaleZ}m
            </label>
            <input
              type="range"
              min="4"
              max="60"
              step="1"
              value={scaleZ}
              onChange={(e) => setScaleZ(parseInt(e.target.value, 10))}
              className="w-full accent-[#f6d477]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Altura: {amplitude > 0 ? `+${amplitude}` : amplitude}m
            </label>
            <input
              type="range"
              min="-15"
              max="40"
              step="0.5"
              value={amplitude}
              onChange={(e) => setAmplitude(parseFloat(e.target.value))}
              className="w-full accent-[#38bdf8]"
            />
          </div>
        </div>

        {/* Rotation & Intensity */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Giro: {rotationDeg}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={rotationDeg}
              onChange={(e) => setRotationDeg(parseInt(e.target.value, 10))}
              className="w-full accent-[#f6d477]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Intensidad: {(intensity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full accent-[#34d399]"
            />
          </div>
        </div>

        {/* Blend Mode & Falloff */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">Modo Mezcla</label>
            <select
              value={blendMode}
              onChange={(e) => setBlendMode(e.target.value as TerrainStamp['blendMode'])}
              className="w-full rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs text-[#e4dcf5]"
            >
              <option value="add">Sumar (+ Adición)</option>
              <option value="max">Máximo (Meseta/Elevación)</option>
              <option value="min">Mínimo (Cráter/Hondonada)</option>
              <option value="replace">Reemplazar (Absoluto)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Transición Borde: {Math.round(falloffInner * 100)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={falloffInner}
              onChange={(e) => setFalloffInner(parseFloat(e.target.value))}
              className="w-full accent-[#f6d477]"
            />
          </div>
        </div>

        {/* Priority */}
        <div className="flex items-center justify-between border-t border-[#232033] pt-2">
          <span className="text-[10px] uppercase tracking-wider text-[#8e85a3]">Prioridad de Mezcla:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPriority((p) => Math.max(1, p - 5))}
              className="rounded bg-[#1c1a2c] px-2 py-0.5 text-xs border border-[#38334d]"
            >
              -5
            </button>
            <span className="font-mono text-[#f6d477] font-semibold">{priority}</span>
            <button
              type="button"
              onClick={() => setPriority((p) => p + 5)}
              className="rounded bg-[#1c1a2c] px-2 py-0.5 text-xs border border-[#38334d]"
            >
              +5
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-[#232033]">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 rounded bg-[#f6d477] py-1.5 text-xs font-bold text-[#151221] hover:bg-[#ffe18f] shadow transition"
          >
            ✓ Aplicar y Regenerar
          </button>
          {selectedStamp && (
            <button
              type="button"
              onClick={() => {
                onRemoveStamp(selectedStamp.id);
                onSelectStamp(null);
                const maxRadius = Math.max(scaleX, scaleZ) * 1.2;
                onRegenerateRegion({
                  minX: posX - maxRadius,
                  minZ: posZ - maxRadius,
                  maxX: posX + maxRadius,
                  maxZ: posZ + maxRadius,
                });
              }}
              className="rounded border border-[#ef4444]/40 bg-[#7f1d1d]/30 px-3 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-[#7f1d1d]/60 transition"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
