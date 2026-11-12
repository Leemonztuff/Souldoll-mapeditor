/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { WorldEditorScatterItem } from '../../world/editor/WorldEditor';

interface ScatterEditorPanelProps {
  groups: WorldEditorScatterItem[];
  onToggleGroup: (groupId: string, enabled: boolean) => void;
  onSetDensity: (groupId: string, density: number) => void;
  onRegenerateRegion: () => void;
}

const GROUP_META: Record<string, { label: string; icon: string; desc: string }> = {
  trees: { label: 'Árboles Mayores', icon: '🌲', desc: 'Robles, abetos y pinos' },
  bushes: { label: 'Arbustos y Flores', icon: '🌿', desc: 'Matorrales y hierba densa' },
  rocks: { label: 'Rocas y Peñascos', icon: '🪨', desc: 'Formaciones de piedra natural' },
  structures: { label: 'Ruinas y Estructuras', icon: '🏛️', desc: 'Pilares antiguos y altares' },
  reeds: { label: 'Juncos y Rocas de Agua', icon: '🌾', desc: 'Vegetación de ribera y lago' },
};

export const ScatterEditorPanel: React.FC<ScatterEditorPanelProps> = ({
  groups,
  onToggleGroup,
  onSetDensity,
  onRegenerateRegion,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 text-xs text-[#d8d1e8] max-h-[calc(100vh-160px)] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#2d293d] pb-2">
        <span className="font-semibold text-[#f6d477] uppercase tracking-wider text-[11px]">
          Grupos de Scatter y Vegetación
        </span>
        <button
          type="button"
          onClick={onRegenerateRegion}
          className="rounded bg-[#f6d477]/20 border border-[#f6d477]/40 px-2.5 py-1 text-[11px] font-medium text-[#f6d477] hover:bg-[#f6d477]/30 transition"
        >
          ↻ Regenerar
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {groups.map((group) => {
          const meta = GROUP_META[group.id] ?? {
            label: group.id,
            icon: '📦',
            desc: 'Elementos decorativos',
          };

          return (
            <div
              key={group.id}
              className="flex flex-col gap-2 rounded bg-[#13121f] border border-[#2d293d] p-3 hover:border-[#3e3856] transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.icon}</span>
                  <div>
                    <span className="font-bold text-[#e4dcf5]">{meta.label}</span>
                    <span className="text-[10px] text-[#8e85a3] block">{meta.desc}</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={group.enabled}
                    onChange={(e) => {
                      onToggleGroup(group.id, e.target.checked);
                      onRegenerateRegion();
                    }}
                    className="rounded bg-[#1c1a2c] border-[#38334d] text-[#f6d477] focus:ring-0"
                  />
                  <span className={`text-[11px] ${group.enabled ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                    {group.enabled ? 'Activo' : 'Pausado'}
                  </span>
                </label>
              </div>

              {/* Density Multiplier Slider */}
              <div className="flex flex-col gap-1 border-t border-[#232033] pt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8e85a3]">Densidad de Distribución:</span>
                  <span className="font-mono text-[#f6d477] font-semibold">
                    {group.density.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.05"
                  value={group.density}
                  onChange={(e) => onSetDensity(group.id, parseFloat(e.target.value))}
                  onMouseUp={onRegenerateRegion}
                  onTouchEnd={onRegenerateRegion}
                  className="w-full accent-[#f6d477]"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded bg-[#171626] border border-[#2a263c] p-2.5 text-[11px] text-[#a097b8]">
        💡 <strong className="text-[#f6d477]">Instancing & Scatter:</strong> Las formaciones se generan de manera determinista por chunks mediante semillas derivadas, respetando zonas de exclusión de caminos y agua.
      </div>
    </div>
  );
};
