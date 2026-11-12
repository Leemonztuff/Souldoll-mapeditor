/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { WorldEditorSplineItem } from '../../world/editor/WorldEditor';
import type { Vec2 } from '../../world/core/WorldTypes';

interface SplinesEditorPanelProps {
  splines: WorldEditorSplineItem[];
  selectedSplineId: string | null;
  onSelectSpline: (id: string | null) => void;
  onToggleSpline: (splineId: string, enabled: boolean) => void;
  onUpdatePoints: (splineId: string, points: Vec2[]) => void;
  cursorPos: { x: number; y: number; z: number } | null;
  onRegenerateRegion: () => void;
}

const SPLINE_META: Record<string, { label: string; icon: string; desc: string }> = {
  road: { label: 'Camino Real (Cobblestone)', icon: '🛤️', desc: 'Ruta principal empedrada' },
  river: { label: 'Río Luminati', icon: '🌊', desc: 'Canal de agua continuo' },
  lake: { label: 'Perímetro del Lago', icon: '🛶', desc: 'Orillas y vegetación lacustre' },
};

export const SplinesEditorPanel: React.FC<SplinesEditorPanelProps> = ({
  splines,
  selectedSplineId,
  onSelectSpline,
  onToggleSpline,
  onUpdatePoints,
  cursorPos,
  onRegenerateRegion,
}) => {
  const activeSpline = splines.find((s) => s.id === selectedSplineId) ?? splines[0];

  const handleAddPointAtCursor = () => {
    if (!activeSpline || !cursorPos) return;
    const newPoint: Vec2 = { x: Math.round(cursorPos.x), z: Math.round(cursorPos.z) };
    const nextPoints = [...activeSpline.points, newPoint];
    onUpdatePoints(activeSpline.id, nextPoints);
    onRegenerateRegion();
  };

  const handleRemoveLastPoint = () => {
    if (!activeSpline || activeSpline.points.length <= 2) return;
    const nextPoints = activeSpline.points.slice(0, -1);
    onUpdatePoints(activeSpline.id, nextPoints);
    onRegenerateRegion();
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-xs text-[#d8d1e8] max-h-[calc(100vh-160px)] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#2d293d] pb-2">
        <span className="font-semibold text-[#f6d477] uppercase tracking-wider text-[11px]">
          Red de Splines del Mundo
        </span>
        <button
          type="button"
          onClick={onRegenerateRegion}
          className="rounded bg-[#f6d477]/20 border border-[#f6d477]/40 px-2 py-1 text-[11px] font-medium text-[#f6d477] hover:bg-[#f6d477]/30 transition"
        >
          ↻ Regenerar
        </button>
      </div>

      {/* Spline selector buttons */}
      <div className="flex flex-col gap-1.5">
        {splines.map((spline) => {
          const isSelected = spline.id === (activeSpline?.id ?? '');
          const meta = SPLINE_META[spline.type] ?? {
            label: spline.id,
            icon: '〰️',
            desc: 'Spline continuo',
          };

          return (
            <div
              key={spline.id}
              onClick={() => onSelectSpline(spline.id)}
              className={`flex items-center justify-between rounded p-2.5 border cursor-pointer transition ${
                isSelected
                  ? 'bg-[#29233b] border-[#f6d477] shadow-[0_0_10px_rgba(246,212,119,0.12)]'
                  : 'bg-[#151424] border-[#29253b] hover:border-[#423c5a]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{meta.icon}</span>
                <div>
                  <span className="font-semibold text-[#e4dcf5]">{meta.label}</span>
                  <span className="text-[10px] text-[#8e85a3] block font-mono">
                    {spline.points.length} puntos de control
                  </span>
                </div>
              </div>

              <label
                className="flex items-center gap-1.5 cursor-pointer text-[10px]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={spline.enabled}
                  onChange={(e) => {
                    onToggleSpline(spline.id, e.target.checked);
                    onRegenerateRegion();
                  }}
                  className="rounded bg-[#1c1a2c] border-[#38334d] text-[#f6d477] focus:ring-0"
                />
                <span className={spline.enabled ? 'text-[#34d399]' : 'text-[#ef4444]'}>
                  {spline.enabled ? 'Activo' : 'Off'}
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {/* Active Spline Details & Point Editor */}
      {activeSpline && (
        <div className="flex flex-col gap-2 rounded bg-[#13121f] border border-[#2d293d] p-3">
          <div className="flex items-center justify-between border-b border-[#232033] pb-2">
            <span className="font-semibold text-[#f6d477]">
              Puntos de Control: {activeSpline.id}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAddPointAtCursor}
                disabled={!cursorPos}
                className="rounded bg-[#f6d477] px-2 py-1 text-[11px] font-bold text-[#151221] hover:bg-[#ffe18f] disabled:opacity-40 transition"
              >
                ＋ Punto en Cursor
              </button>
              <button
                type="button"
                onClick={handleRemoveLastPoint}
                disabled={activeSpline.points.length <= 2}
                className="rounded border border-[#ef4444]/40 bg-[#7f1d1d]/30 px-2 py-1 text-[11px] font-medium text-[#fca5a5] hover:bg-[#7f1d1d]/60 disabled:opacity-40 transition"
              >
                - Último
              </button>
            </div>
          </div>

          {/* Points coordinate scrollable list */}
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
            {activeSpline.points.map((pt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded bg-[#1c1a2c] px-2 py-1 text-[11px] font-mono text-[#c4b9dc]"
              >
                <span className="text-[#8e85a3]">#{idx + 1}</span>
                <span>
                  X: <strong className="text-[#f6d477]">{pt.x}</strong>, Z:{' '}
                  <strong className="text-[#34d399]">{pt.z}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
