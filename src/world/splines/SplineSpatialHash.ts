/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Bounds2, Vec2 } from '../core/WorldTypes';
import { distanceToPolyline, type WorldSpline, type WorldSplineSample, sampleWorldSpline } from './WorldSpline';

export interface SplineSpatialHashOptions {
  cellSize: number;
  bounds: Bounds2;
}

export class SplineSpatialHash {
  private readonly cellSize: number;
  private readonly bounds: Bounds2;
  private readonly grid: Map<string, WorldSpline[]>;

  constructor(options: SplineSpatialHashOptions) {
    this.cellSize = options.cellSize;
    this.bounds = options.bounds;
    this.grid = new Map();
  }

  public addSpline(spline: WorldSpline): void {
    const points = spline.points;
    if (points.length < 2) return;

    const halfWidth = spline.width * 0.5 + 2; // Extra margin for falloff
    const visited = new Set<string>();

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];

      const minX = Math.min(a.x, b.x) - halfWidth;
      const maxX = Math.max(a.x, b.x) + halfWidth;
      const minZ = Math.min(a.z, b.z) - halfWidth;
      const maxZ = Math.max(a.z, b.z) + halfWidth;

      const startX = Math.floor(minX / this.cellSize);
      const endX = Math.floor(maxX / this.cellSize);
      const startZ = Math.floor(minZ / this.cellSize);
      const endZ = Math.floor(maxZ / this.cellSize);

      for (let cz = startZ; cz <= endZ; cz++) {
        for (let cx = startX; cx <= endX; cx++) {
          const key = `${cx},${cz}`;
          if (visited.has(key)) continue;
          visited.add(key);

          const bucket = this.grid.get(key);
          if (bucket) {
            if (!bucket.includes(spline)) bucket.push(spline);
          } else {
            this.grid.set(key, [spline]);
          }
        }
      }
    }
  }

  public getClosestSample(x: number, z: number): { sample: WorldSplineSample | null; spline: WorldSpline | null } {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const splines = this.grid.get(`${cx},${cz}`);

    if (!splines) return { sample: null, spline: null };

    let closestSample: WorldSplineSample | null = null;
    let closestSpline: WorldSpline | null = null;

    for (let i = 0; i < splines.length; i++) {
      const spline = splines[i];
      const sample = sampleWorldSpline(spline, x, z);
      if (sample.influence <= 0 && sample.distance > spline.width) continue;

      if (!closestSample || sample.distance < closestSample.distance) {
        closestSample = sample;
        closestSpline = spline;
      }
    }

    return { sample: closestSample, spline: closestSpline };
  }
}
