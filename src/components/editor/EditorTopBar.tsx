/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface EditorTopBarProps {
  worldName: string;
  seed: string;
  cursorPos: { x: number; y: number; z: number } | null;
  isGenerating: boolean;
  onClose: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  worldName,
  seed,
  cursorPos,
  isGenerating,
  onClose,
}) => {
  return (
    <header
      className="flex flex-wrap items-center justify-between border-b border-[#3b344e] bg-[#0c0d14]/95 px-4 py-2.5 backdrop-blur-md shadow-lg select-none z-50 text-xs"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Title & World Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f6d477] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f6d477]"></span>
          </span>
          <span className="font-bold tracking-wider text-[#f6d477] uppercase text-sm font-pixel">
            World Engine
          </span>
          <span className="text-[10px] uppercase tracking-widest text-[#948ca5] px-1.5 py-0.5 rounded bg-[#1c1a29] border border-[#2d293d]">
            Editor v0.7
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 border-l border-[#2e2a3f] pl-3 text-[#aca4be]">
          <span>Mundo:</span>
          <strong className="text-[#e2daf0] font-mono">{worldName}</strong>
          <span className="text-[#5b546e]">|</span>
          <span>Semilla:</span>
          <span className="text-[#c7bfdb] font-mono">{seed}</span>
        </div>
      </div>

      {/* 3D Cursor Coordinates & Generation Indicator */}
      <div className="flex items-center gap-4">
        {/* Live Coordinates */}
        <div className="flex items-center gap-3 rounded bg-[#13121f] border border-[#2d293d] px-2.5 py-1 text-[11px] font-mono">
          <span className="text-[#8b829e] text-[10px] uppercase tracking-wider">Cursor 3D:</span>
          {cursorPos ? (
            <div className="flex items-center gap-2 text-[#e2daf0]">
              <span>
                <strong className="text-[#f6d477]">X:</strong> {cursorPos.x.toFixed(1)}
              </span>
              <span>
                <strong className="text-[#60a5fa]">Y:</strong> {cursorPos.y.toFixed(2)}
              </span>
              <span>
                <strong className="text-[#34d399]">Z:</strong> {cursorPos.z.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="text-[#6e6680] italic">Fuera del terreno</span>
          )}
        </div>

        {/* Generation Status */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
          {isGenerating ? (
            <span className="flex items-center gap-1.5 text-[#fbbf24] animate-pulse">
              <span className="h-2 w-2 rounded-full bg-[#fbbf24]"></span>
              Regenerando...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#34d399]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]"></span>
              Sincronizado
            </span>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded border border-[#ef4444]/40 bg-[#7f1d1d]/30 px-3 py-1 text-[11px] font-medium text-[#fca5a5] hover:bg-[#7f1d1d]/60 hover:text-white transition focus:outline-none"
          title="Cerrar Editor [F2 o ~]"
        >
          <span>✕</span>
          <span className="hidden sm:inline">Cerrar [F2]</span>
        </button>
      </div>
    </header>
  );
};
