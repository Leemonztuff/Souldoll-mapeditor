import React, { useState } from 'react';
import { audioManager } from '../audio/audioManager';
import { useCompass, CompassMarker, CompassData } from './CompassSystem';

interface CompassProps {
  playerPos: { x: number; z: number; rotation: number };
  markers: CompassMarker[];
  onOpenWorldMap?: () => void;
}

export const Compass: React.FC<CompassProps> = ({ playerPos, markers, onOpenWorldMap }) => {
  const markerData = useCompass(playerPos, markers);
  const [selectedMarker, setSelectedMarker] = useState<(CompassData) | null>(null);

  // Sync selected marker if it was updated in markerData
  const activeSelectedMarker = React.useMemo(() => {
    if (!selectedMarker) return null;
    return markerData.find(m => m.id === selectedMarker.id) || selectedMarker;
  }, [selectedMarker, markerData]);

  const handleMarkerClick = (e: React.MouseEvent, m: CompassData) => {
    e.stopPropagation();
    audioManager.playMenuBeep();
    setSelectedMarker(m);
  };

  const renderPoiSvg = (type: string, isSelected: boolean) => {
    const strokeColor = isSelected ? '#ffffff' : '#fbbf24';
    const fillColor = isSelected ? '#fbbf24' : '#14101c';

    switch (type) {
      case 'npc':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2">
            <circle cx="12" cy="7" r="4" fill={fillColor} />
            <path d="M5.5 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'quest':
        return (
          <svg className="w-4 h-4 animate-pulse" viewBox="0 0 24 24" fill="#ef4444" stroke="#fef08a" strokeWidth="1.5">
            <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2" />
          </svg>
        );
      case 'waypoint':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
            <circle cx="12" cy="12" r="8" fill="#2e1065" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
          </svg>
        );
      case 'fountain':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 10v4" strokeLinecap="round" />
          </svg>
        );
      case 'boss':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2">
            <path d="M12 2l3 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" fill={fillColor} />
          </svg>
        );
      default:
        return <circle cx="12" cy="12" r="4" fill={strokeColor} />;
    }
  };

  return (
    <div className="flex flex-col items-center select-none pointer-events-auto">
      <div 
        onClick={() => { if (onOpenWorldMap) onOpenWorldMap(); }}
        className="relative w-full max-w-sm h-11 bg-gradient-to-r from-[#0d0914] via-[#1a1226] to-[#0d0914] border-2 border-[#b4862a] rounded-xs backdrop-blur-md overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.8)] hover:border-[#fef08a] transition-colors"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-[#fbbf24] z-20" />
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#fbbf24]/50 z-10" />
        
        {['N', 'E', 'S', 'W'].map((dir, i) => {
          const dirAngle = (i * Math.PI) / 2;
          let relativeAngle = dirAngle - playerPos.rotation;
          if (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
          if (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;

          const screenX = (relativeAngle / (Math.PI / 2)) * 50;
          if (Math.abs(screenX) > 55) return null;

          return (
            <div key={dir} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10" style={{ left: `calc(50% + ${screenX}%)` }}>
              <span className={`font-pixel font-bold ${dir === 'N' ? 'text-sm text-[#fbbf24]' : 'text-[10px] text-gray-300'}`}>{dir === 'N' ? 'N ❖' : dir}</span>
            </div>
          );
        })}

        {markerData.map(m => {
          const screenX = (m.relativeAngle / (Math.PI / 2)) * 50;
          if (Math.abs(screenX) > 55) return null;

          const isSelected = selectedMarker?.id === m.id;
          return (
            <div
              key={m.id}
              onClick={(e) => handleMarkerClick(e, m)}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 p-2 z-15 cursor-pointer transition-transform hover:scale-125"
              style={{ left: `calc(50% + ${screenX}%)`, transform: `translate(-50%, -50%) scale(${isSelected ? 1.3 : 1})` }}
              title={`${m.name} (${m.distance}m)`}
            >
              {renderPoiSvg(m.type, isSelected)}
            </div>
          );
        })}
      </div>
      
      {activeSelectedMarker && (
        <div className="mt-1.5 bg-[#14101C]/95 border border-[#fbbf24] px-3 py-1 rounded-xs flex items-center justify-between gap-4 text-[8px] text-[#fef3c7] shadow-lg pointer-events-auto">
          <span className="font-bold text-[#fbbf24] truncate">{activeSelectedMarker.name}</span>
          <span className="text-[#38bdf8] tabular-nums font-bold">{activeSelectedMarker.distance}m</span>
        </div>
      )}
    </div>
  );
};
