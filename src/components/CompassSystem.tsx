import { useMemo } from 'react';

export interface CompassMarker {
  id: string;
  type: 'npc' | 'quest' | 'waypoint' | 'fountain' | 'boss';
  x: number;
  z: number;
  name: string;
}

export interface CompassData extends CompassMarker {
  distance: number;
  relativeAngle: number;
  isVisible: boolean;
}

interface PlayerPos {
  x: number;
  z: number;
  rotation: number;
}

export const useCompass = (
  playerPos: PlayerPos,
  markers: CompassMarker[],
  compassRange: number = 160
) => {
  return useMemo(() => {
    return markers.map(marker => {
      const dx = marker.x - playerPos.x;
      const dz = marker.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      
      // Calculate angle in world space
      const angleToTarget = Math.atan2(dx, dz);
      
      // Normalize relative to player rotation
      // Player rotation convention: 0 is North, clockwise increase
      let relativeAngle = angleToTarget - playerPos.rotation;
      
      // Keep angle within -PI to PI
      if (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
      if (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;

      return {
        ...marker,
        distance: Math.round(dist),
        relativeAngle,
        isVisible: dist < compassRange
      };
    }).filter(m => m.isVisible);
  }, [playerPos.x, playerPos.z, playerPos.rotation, markers, compassRange]);
};
