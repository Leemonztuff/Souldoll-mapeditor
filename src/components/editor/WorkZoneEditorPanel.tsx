/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { WorkZone } from '../../world/core/WorkZone';
import { getWorkZoneBounds } from '../../world/core/WorkZone';

interface WorkZoneEditorPanelProps {
  workZones: WorkZone[];
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  onSaveZone: (zone: WorkZone) => void;
  onRemoveZone: (id: string) => void;
  playerPos: { x: number; y: number; z: number };
  cursorPos: { x: number; y: number; z: number } | null;
  onRegenerateRegion: (bounds?: { minX: number; minZ: number; maxX: number; maxZ: number }) => void;
}

export const WorkZoneEditorPanel: React.FC<WorkZoneEditorPanelProps> = ({
  workZones,
  selectedZoneId,
  onSelectZone,
  onSaveZone,
  onRemoveZone,
  playerPos,
  cursorPos,
  onRegenerateRegion,
}) => {
  const selectedZone = workZones.find((z) => z.id === selectedZoneId);

  const [id, setId] = useState(selectedZone?.id ?? 'zone-main');
  const [name, setName] = useState(selectedZone?.name ?? 'Zona de Trabajo');
  const [centerX, setCenterX] = useState(selectedZone?.center.x ?? 0);
  const [centerZ, setCenterZ] = useState(selectedZone?.center.z ?? 0);
  const [sizeX, setSizeX] = useState(selectedZone?.size.x ?? 128);
  const [sizeZ, setSizeZ] = useState(selectedZone?.size.z ?? 128);
  const [enabled, setEnabled] = useState(selectedZone?.enabled ?? true);

  React.useEffect(() => {
    if (selectedZone) {
      setId(selectedZone.id);
      setName(selectedZone.name);
      setCenterX(selectedZone.center.x);
      setCenterZ(selectedZone.center.z);
      setSizeX(selectedZone.size.x);
      setSizeZ(selectedZone.size.z);
      setEnabled(selectedZone.enabled);
    }
  }, [selectedZoneId]);

  const bounds = getWorkZoneBounds({
    id,
    name,
    center: { x: centerX, z: centerZ },
    size: { x: sizeX, z: sizeZ },
    enabled,
    tags: ['workzone'],
  });

  const handleApply = () => {
    const zone: WorkZone = {
      id,
      name,
      center: { x: centerX, z: centerZ },
      size: { x: sizeX, z: sizeZ },
      enabled,
      tags: ['editor-zone'],
    };
    onSaveZone(zone);
    onSelectZone(zone.id);
  };

  const handleRebuild = () => {
    handleApply();
    onRegenerateRegion(bounds);
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-xs text-[#d8d1e8] max-h-[calc(100vh-160px)] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#2d293d] pb-2">
        <span className="font-semibold text-[#f6d477] uppercase tracking-wider text-[11px]">
          Zonas de Trabajo (WorkZones)
        </span>
        <button
          type="button"
          onClick={() => {
            const newId = `zone-${Math.floor(Math.random() * 900 + 100)}`;
            setId(newId);
            setName(`Región ${newId}`);
            setCenterX(Math.round(playerPos.x));
            setCenterZ(Math.round(playerPos.z));
            onSelectZone(null);
          }}
          className="rounded bg-[#f6d477]/20 border border-[#f6d477]/40 px-2 py-1 text-[11px] font-medium text-[#f6d477] hover:bg-[#f6d477]/30 transition"
        >
          ＋ Nueva Zona
        </button>
      </div>

      {/* Existing WorkZones */}
      <div className="flex flex-wrap gap-1.5">
        {workZones.map((z) => {
          const isSelected = z.id === selectedZoneId;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => onSelectZone(z.id)}
              className={`rounded px-2 py-1 text-[11px] font-mono border transition ${
                isSelected
                  ? 'bg-[#3b3353] border-[#f6d477] text-white'
                  : 'bg-[#181624] border-[#2c283d] text-[#b3a8c7] hover:border-[#4d4566]'
              }`}
            >
              {z.name || z.id}
            </button>
          );
        })}
      </div>

      {/* Editor Form */}
      <div className="flex flex-col gap-2.5 rounded bg-[#13121f] border border-[#2d293d] p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#f6d477]">
            {selectedZone ? `Configurar: ${selectedZone.name}` : 'Nueva Zona de Trabajo'}
          </span>
          <label className="flex items-center gap-2 cursor-pointer text-[11px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded bg-[#1c1a2c] border-[#38334d] text-[#f6d477] focus:ring-0"
            />
            <span className={enabled ? 'text-[#34d399]' : 'text-[#ef4444]'}>
              {enabled ? 'Habilitada' : 'Deshabilitada'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs text-[#e4dcf5] focus:border-[#f6d477] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs font-mono text-[#e4dcf5] focus:border-[#f6d477] focus:outline-none"
            />
          </div>
        </div>

        {/* Center with snap buttons */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-[#8e85a3]">Centro (X, Z)</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCenterX(Math.round(playerPos.x));
                  setCenterZ(Math.round(playerPos.z));
                }}
                className="text-[10px] rounded bg-[#272338] px-1.5 py-0.5 text-[#38bdf8] border border-[#3a354e]"
              >
                Centrar en Jugador
              </button>
              <button
                type="button"
                onClick={() => {
                  setCenterX(Math.round(centerX / 64) * 64);
                  setCenterZ(Math.round(centerZ / 64) * 64);
                }}
                className="text-[10px] rounded bg-[#272338] px-1.5 py-0.5 text-[#f6d477] border border-[#3a354e]"
              >
                Alinear a Chunk (64m)
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="16"
              value={centerX}
              onChange={(e) => setCenterX(parseFloat(e.target.value) || 0)}
              className="rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs font-mono text-[#e4dcf5]"
              placeholder="Centro X"
            />
            <input
              type="number"
              step="16"
              value={centerZ}
              onChange={(e) => setCenterZ(parseFloat(e.target.value) || 0)}
              className="rounded bg-[#1c1a2c] border border-[#38334d] px-2 py-1 text-xs font-mono text-[#e4dcf5]"
              placeholder="Centro Z"
            />
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Ancho: {sizeX}m ({Math.ceil(sizeX / 64)} chunks)
            </label>
            <input
              type="range"
              min="64"
              max="512"
              step="64"
              value={sizeX}
              onChange={(e) => setSizeX(parseInt(e.target.value, 10))}
              className="w-full accent-[#f6d477]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8e85a3] mb-1">
              Alto: {sizeZ}m ({Math.ceil(sizeZ / 64)} chunks)
            </label>
            <input
              type="range"
              min="64"
              max="512"
              step="64"
              value={sizeZ}
              onChange={(e) => setSizeZ(parseInt(e.target.value, 10))}
              className="w-full accent-[#f6d477]"
            />
          </div>
        </div>

        {/* Computed Bounds Readout */}
        <div className="rounded bg-[#1a1829] border border-[#2d293d] p-2 text-[10px] font-mono flex flex-col gap-0.5">
          <span className="text-[#8e85a3] uppercase tracking-wider">Límites Calculados:</span>
          <div className="grid grid-cols-2 gap-1 text-[#e2daf0]">
            <span>MinX: <strong>{bounds.minX}</strong></span>
            <span>MaxX: <strong>{bounds.maxX}</strong></span>
            <span>MinZ: <strong>{bounds.minZ}</strong></span>
            <span>MaxZ: <strong>{bounds.maxZ}</strong></span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-[#232033]">
          <button
            type="button"
            onClick={handleRebuild}
            className="flex-1 rounded bg-[#f6d477] py-2 text-xs font-bold text-[#151221] hover:bg-[#ffe18f] shadow transition"
          >
            ⚡ Regenerar Región de Zona
          </button>
          {selectedZone && (
            <button
              type="button"
              onClick={() => {
                onRemoveZone(selectedZone.id);
                onSelectZone(null);
              }}
              className="rounded border border-[#ef4444]/40 bg-[#7f1d1d]/30 px-3 py-2 text-xs font-medium text-[#fca5a5] hover:bg-[#7f1d1d]/60 transition"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
