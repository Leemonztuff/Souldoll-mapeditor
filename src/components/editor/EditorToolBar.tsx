/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { EditorTool } from '../../world/editor/WorldEditor';

interface EditorToolBarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  counts: {
    stamps: number;
    biomes: number;
    scatter: number;
    splines: number;
    workZones: number;
  };
}

interface ToolTab {
  id: EditorTool;
  label: string;
  icon: string;
  badge: number;
  description: string;
}

export const EditorToolBar: React.FC<EditorToolBarProps> = ({
  activeTool,
  onSelectTool,
  counts,
}) => {
  const tabs: ToolTab[] = [
    {
      id: 'terrain',
      label: 'Terreno',
      icon: '🏔️',
      badge: counts.stamps,
      description: 'Estampas, colinas y elevación',
    },
    {
      id: 'biome',
      label: 'Biomas',
      icon: '🌿',
      badge: counts.biomes,
      description: 'Prioridades, reglas y máscaras',
    },
    {
      id: 'scatter',
      label: 'Scatter',
      icon: '🌲',
      badge: counts.scatter,
      description: 'Árboles, rocas y vegetación',
    },
    {
      id: 'spline',
      label: 'Splines',
      icon: '〰️',
      badge: counts.splines,
      description: 'Caminos, ríos y curvas de lago',
    },
    {
      id: 'workzone',
      label: 'WorkZone',
      icon: '📐',
      badge: counts.workZones,
      description: 'Límites y regeneración regional',
    },
  ];

  return (
    <nav
      className="flex flex-row overflow-x-auto border-b border-[#2d293d] bg-[#10101a]/90 px-3 py-1.5 gap-1.5 backdrop-blur-sm select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {tabs.map((tab) => {
        const isActive = activeTool === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTool(tab.id)}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? 'bg-[#29243d] border border-[#f6d477]/50 text-[#f6d477] shadow-[0_0_12px_rgba(246,212,119,0.15)] font-semibold'
                : 'text-[#9f96b3] border border-transparent hover:bg-[#1c1a2c] hover:text-[#e4dcf5]'
            }`}
            title={tab.description}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                isActive
                  ? 'bg-[#f6d477]/20 text-[#f6d477]'
                  : 'bg-[#1b1928] text-[#7d7590]'
              }`}
            >
              {tab.badge}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
