/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface EditorBottomBarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  statusMessage: string;
  hasUnsavedChanges: boolean;
  onExportJson: () => void;
}

export const EditorBottomBar: React.FC<EditorBottomBarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  statusMessage,
  hasUnsavedChanges,
  onExportJson,
}) => {
  return (
    <footer
      className="flex flex-wrap items-center justify-between border-t border-[#3b344e] bg-[#0c0d14]/95 px-4 py-2 backdrop-blur-md shadow-lg select-none z-50 text-xs"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Undo / Redo */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex items-center gap-1.5 rounded bg-[#1e1b2d] border border-[#3b344e] px-2.5 py-1 text-[11px] font-medium text-[#e4dcf5] hover:bg-[#2d2844] disabled:opacity-40 disabled:pointer-events-none transition"
          title="Deshacer cambio [Ctrl+Z]"
        >
          <span>↶</span>
          <span>Deshacer</span>
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="flex items-center gap-1.5 rounded bg-[#1e1b2d] border border-[#3b344e] px-2.5 py-1 text-[11px] font-medium text-[#e4dcf5] hover:bg-[#2d2844] disabled:opacity-40 disabled:pointer-events-none transition"
          title="Rehacer cambio [Ctrl+Y]"
        >
          <span>↷</span>
          <span>Rehacer</span>
        </button>

        <span className="hidden sm:inline text-[#5b546e] ml-1">|</span>

        {/* Dirty State Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 ml-1">
          <span
            className={`h-2 w-2 rounded-full ${
              hasUnsavedChanges ? 'bg-[#fbbf24] animate-pulse' : 'bg-[#34d399]'
            }`}
          ></span>
          <span className="text-[10px] uppercase tracking-wider text-[#8e85a3]">
            {hasUnsavedChanges ? 'Cambios sin exportar' : 'Sincronizado'}
          </span>
        </div>
      </div>

      {/* Status Log / Message */}
      <div className="hidden md:flex items-center gap-2 text-[11px] text-[#b8aeca] font-mono truncate max-w-sm">
        <span className="text-[#f6d477]">✦</span>
        <span className="truncate">{statusMessage || 'Motor de Mundo listo'}</span>
      </div>

      {/* Export & Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExportJson}
          className="flex items-center gap-1.5 rounded bg-[#f6d477] border border-[#f6d477] px-3 py-1 text-[11px] font-bold text-[#151221] hover:bg-[#ffe18f] shadow transition"
          title="Exportar definición JSON del mundo"
        >
          <span>💾</span>
          <span>Exportar JSON</span>
        </button>
      </div>
    </footer>
  );
};
