/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  boundsContains,
  boundsIntersect,
  type Bounds2,
  type HeightAtFn,
} from '../core/WorldTypes';
import {
  DEFAULT_TERRAIN_BOUNDS,
  type TerrainHeightSample,
  type TerrainSampler,
} from './TerrainData';
import {
  clamp01,
  getTerrainStampBounds,
  type TerrainStamp,
  type TerrainStampAsset,
} from './TerrainStamp';
import { TerrainHeightmap } from './TerrainHeightmap';

export interface TerrainStampSamplerOptions {
  bounds?: Bounds2;
  tileSize?: number;
  cellSize?: number;
  maxTiles?: number;
  assets?: ReadonlyMap<string, TerrainStampAsset>;
}

interface PreparedStamp {
  stamp: TerrainStamp;
  cos: number;
  sin: number;
  originBase: number;
  bounds: Bounds2;
  intensity: number;
  sampleShape: (u: number, v: number, r: number) => number;
}

const DEFAULT_TILE_SIZE = 64;
const DEFAULT_CELL_SIZE = 2;
const DEFAULT_MAX_TILES = 256;

function smoothStep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hash2D(x: number, z: number, seed: number): number {
  let hash = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);

  const n00 = hash2D(x0, z0, seed);
  const n10 = hash2D(x0 + 1, z0, seed);
  const n01 = hash2D(x0, z0 + 1, seed);
  const n11 = hash2D(x0 + 1, z0 + 1, seed);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sz;
}

function sampleEmbedded(values: number[], resolution: number, u: number, v: number): number {
  if (resolution <= 1) return values[0] ?? 0;
  const gx = clamp01(u * 0.5 + 0.5) * (resolution - 1);
  const gz = clamp01(v * 0.5 + 0.5) * (resolution - 1);
  const x0 = Math.min(resolution - 1, Math.floor(gx));
  const z0 = Math.min(resolution - 1, Math.floor(gz));
  const x1 = Math.min(resolution - 1, x0 + 1);
  const z1 = Math.min(resolution - 1, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;

  const h00 = values[z0 * resolution + x0] ?? 0;
  const h10 = values[z0 * resolution + x1] ?? 0;
  const h01 = values[z1 * resolution + x0] ?? 0;
  const h11 = values[z1 * resolution + x1] ?? 0;
  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return hx0 + (hx1 - hx0) * tz;
}

function presetShape(
  preset: TerrainStamp['category'],
  u: number,
  v: number,
  r: number,
  seed: number
): number {
  const detail = valueNoise2D(u * 3 + 11.3, v * 3 - 7.1, seed) * 2 - 1;

  switch (preset) {
    case 'hill':
      return (1 - r * r) * (0.88 + detail * 0.12);
    case 'mountain': {
      const base = Math.pow(Math.max(0, 1 - r), 1.3);
      const ridge = 1 - Math.abs(valueNoise2D(u * 3.7, v * 3.7, seed) * 2 - 1);
      return base * (0.7 + ridge * 0.5);
    }
    case 'valley':
      return -(1 - r * r) * (0.9 + detail * 0.1);
    case 'ridge': {
      const crest = Math.pow(Math.max(0, 1 - Math.abs(v)), 1.6);
      const along = Math.pow(Math.max(0, 1 - Math.abs(u)), 0.35);
      return crest * along * (0.85 + detail * 0.15);
    }
    case 'plateau':
      return smoothStep(1, 0.55, r);
    case 'crater': {
      const bowl = -Math.pow(Math.max(0, 1 - r * r), 1.15);
      const rimPeak = Math.exp(-Math.pow((r - 0.72) / 0.18, 2));
      const rimEdge = Math.exp(-Math.pow((1 - 0.72) / 0.18, 2));
      const rim = ((rimPeak - rimEdge) / (1 - rimEdge)) * 0.8;
      return bowl + rim;
    }
    case 'cliff': {
      const side = 1 - smoothStep(-0.3, 0.35, u);
      const cap = 1 - smoothStep(0.8, 1, r);
      return side * cap;
    }
    case 'plain':
      return 0;
    case 'depression':
      return -Math.pow(Math.max(0, 1 - r * r), 1.25) * (0.9 + detail * 0.1);
    default:
      return 0;
  }
}

function falloffWeight(r: number, falloff: TerrainStamp['falloff']): number {
  const inner = clamp01(falloff.inner);
  const outer = clamp01(falloff.outer);

  if (falloff.type === 'none') {
    return r <= outer ? 1 : 0;
  }
  if (outer <= inner) {
    return r <= inner ? 1 : 0;
  }
  if (r <= inner) return 1;
  if (r >= outer) return 0;

  const t = (r - inner) / (outer - inner);
  switch (falloff.type) {
    case 'linear':
      return 1 - t;
    case 'smoothstep':
      return 1 - t * t * (3 - 2 * t);
    case 'cosine':
      return 0.5 + 0.5 * Math.cos(Math.PI * t);
    case 'gaussian': {
      const edge = Math.exp(-3);
      const value = Math.exp(-3 * t * t);
      return (value - edge) / (1 - edge);
    }
    default:
      return 1 - t;
  }
}

export class StampedTerrainSampler implements TerrainSampler {
  public readonly bounds: Bounds2;
  public readonly resolution: number;

  private readonly baseFn: HeightAtFn;
  private readonly assets?: ReadonlyMap<string, TerrainStampAsset>;
  private readonly tileSize: number;
  private readonly maxTiles: number;
  private readonly cells: number;
  private readonly step: number;
  private prepared: PreparedStamp[] = [];
  private tiles = new Map<string, TerrainHeightmap>();

  constructor(
    baseHeightAt: HeightAtFn,
    stamps: TerrainStamp[] = [],
    options: TerrainStampSamplerOptions = {}
  ) {
    this.baseFn = baseHeightAt;
    this.bounds = options.bounds ?? DEFAULT_TERRAIN_BOUNDS;
    this.resolution = Math.max(0.25, options.cellSize ?? DEFAULT_CELL_SIZE);
    this.tileSize = Math.max(this.resolution, options.tileSize ?? DEFAULT_TILE_SIZE);
    this.maxTiles = Math.max(4, options.maxTiles ?? DEFAULT_MAX_TILES);
    this.assets = options.assets;
    this.cells = Math.max(1, Math.round(this.tileSize / this.resolution));
    this.step = this.tileSize / this.cells;
    this.prepared = this.prepareStamps(stamps);
  }

  public heightAt(x: number, z: number): number {
    const base = this.baseFn(x, z);
    if (this.prepared.length === 0) return base;

    if (!boundsContains(this.bounds, x, z)) {
      return base + this.evaluateOffset(x, z);
    }

    const tileX = Math.floor(x / this.tileSize);
    const tileZ = Math.floor(z / this.tileSize);
    const minX = tileX * this.tileSize;
    const minZ = tileZ * this.tileSize;

    // optimization: if tile has no stamps, return base immediately
    if (!this.tileIntersectsStamp(minX, minZ)) {
      return base;
    }

    const key = `${tileX},${tileZ}`;
    let tile = this.tiles.get(key);

    if (!tile) {
      tile = this.buildTile(tileX, tileZ);
      this.tiles.set(key, tile);
      if (this.tiles.size > this.maxTiles) {
        const oldest = this.tiles.keys().next().value;
        if (oldest !== undefined) this.tiles.delete(oldest);
      }
    } else {
      // LRU update
      this.tiles.delete(key);
      this.tiles.set(key, tile);
    }

    return base + tile.heightAt(x, z);
  }

  public baseHeightAt(x: number, z: number): number {
    return this.baseFn(x, z);
  }

  public sampleAt(x: number, z: number): TerrainHeightSample {
    const eps = Math.max(0.5, this.resolution);
    const height = this.heightAt(x, z);
    const heightL = this.heightAt(x - eps, z);
    const heightR = this.heightAt(x + eps, z);
    const heightD = this.heightAt(x, z - eps);
    const heightU = this.heightAt(x, z + eps);

    const dhx = (heightR - heightL) / (eps * 2);
    const dhz = (heightU - heightD) / (eps * 2);
    const nx = -dhx;
    const ny = 1;
    const nz = -dhz;
    const len = Math.hypot(nx, ny, nz) || 1;

    return {
      height,
      normalX: nx / len,
      normalY: ny / len,
      normalZ: nz / len,
      slope: Math.hypot(dhx, dhz),
    };
  }

  public setStamps(stamps: TerrainStamp[]): void {
    this.prepared = this.prepareStamps(stamps);
    this.tiles.clear();
  }

  public invalidate(region?: Bounds2): void {
    if (!region) {
      this.tiles.clear();
      return;
    }

    for (const [key, tile] of this.tiles) {
      if (boundsIntersect(tile.getBounds(), region)) {
        this.tiles.delete(key);
      }
    }
  }

  public getStampCount(): number {
    return this.prepared.length;
  }

  public getCacheTileCount(): number {
    return this.tiles.size;
  }

  private prepareStamps(stamps: TerrainStamp[]): PreparedStamp[] {
    const prepared: PreparedStamp[] = [];

    for (let i = 0; i < stamps.length; i++) {
      const stamp = stamps[i];
      if (!stamp.enabled) continue;

      const scaleX = Math.abs(stamp.scale.x);
      const scaleZ = Math.abs(stamp.scale.z);
      if (scaleX < 1e-6 || scaleZ < 1e-6) continue;
      if (Math.abs(stamp.scale.amplitude) < 1e-9) continue;

      const source = stamp.source;
      let sampleShape: (u: number, v: number, r: number) => number;

      if (source.kind === 'preset') {
        sampleShape = (u, v, r) => presetShape(source.preset, u, v, r, stamp.seed);
      } else if (source.kind === 'embedded') {
        if (source.values.length < source.resolution * source.resolution) {
          throw new Error(`Terrain stamp "${stamp.id}" has an incomplete embedded height field.`);
        }
        const values = source.values;
        const resolution = Math.max(1, Math.floor(source.resolution));
        sampleShape = (u, v) => sampleEmbedded(values, resolution, u, v);
      } else {
        const asset = this.assets?.get(source.assetId);
        if (!asset) {
          throw new Error(`Terrain stamp "${stamp.id}" references missing asset "${source.assetId}".`);
        }
        const values = asset.values;
        const resolution = Math.max(1, Math.floor(asset.resolution));
        if (values.length < resolution * resolution) {
          throw new Error(`Terrain stamp asset "${source.assetId}" has an incomplete height field.`);
        }
        sampleShape = (u, v) => sampleEmbedded(values, resolution, u, v);
      }

      prepared.push({
        stamp,
        cos: Math.cos(stamp.rotation),
        sin: Math.sin(stamp.rotation),
        originBase: this.baseFn(stamp.position.x, stamp.position.z),
        bounds: getTerrainStampBounds(stamp),
        intensity: clamp01(stamp.intensity),
        sampleShape,
      });
    }

    prepared.sort((a, b) => {
      if (a.stamp.priority !== b.stamp.priority) return a.stamp.priority - b.stamp.priority;
      return a.stamp.id < b.stamp.id ? -1 : a.stamp.id > b.stamp.id ? 1 : 0;
    });

    return prepared;
  }

  private tileIntersectsStamp(minX: number, minZ: number): boolean {
    const tileBounds: Bounds2 = {
      minX,
      minZ,
      maxX: minX + this.tileSize,
      maxZ: minZ + this.tileSize,
    };

    for (let i = 0; i < this.prepared.length; i++) {
      if (boundsIntersect(this.prepared[i].bounds, tileBounds)) return true;
    }
    return false;
  }

  private buildTile(tileX: number, tileZ: number): TerrainHeightmap {
    const x0 = tileX * this.tileSize;
    const z0 = tileZ * this.tileSize;
    const rowLength = this.cells + 1;
    const offsets = new Float32Array(rowLength * rowLength);

    for (let iz = 0; iz <= this.cells; iz++) {
      const worldZ = z0 + iz * this.step;
      for (let ix = 0; ix <= this.cells; ix++) {
        const worldX = x0 + ix * this.step;
        offsets[iz * rowLength + ix] = this.evaluateOffset(worldX, worldZ);
      }
    }

    return new TerrainHeightmap({
      originX: x0,
      originZ: z0,
      width: rowLength,
      height: rowLength,
      cellSize: this.step,
      values: offsets,
    });
  }

  private evaluateOffset(x: number, z: number): number {
    const base = this.baseFn(x, z);
    let height = base;

    for (let i = 0; i < this.prepared.length; i++) {
      const prepared = this.prepared[i];
      if (!boundsContains(prepared.bounds, x, z)) continue;

      const stamp = prepared.stamp;
      const dx = x - stamp.position.x;
      const dz = z - stamp.position.z;
      const localX = dx * prepared.cos + dz * prepared.sin;
      const localZ = -dx * prepared.sin + dz * prepared.cos;
      const u = localX / Math.abs(stamp.scale.x);
      const v = localZ / Math.abs(stamp.scale.z);
      const r = Math.hypot(u, v);
      if (r >= 1) continue;

      const weight = falloffWeight(r, stamp.falloff) * prepared.intensity;
      if (weight <= 0) continue;

      const shape = prepared.sampleShape(u, v, r);
      if (shape === 0 && stamp.blendMode !== 'replace') continue;

      const displaced = shape * stamp.scale.amplitude;
      const target = prepared.originBase + displaced;

      switch (stamp.blendMode) {
        case 'add':
          height += displaced * weight;
          break;
        case 'max': {
          const blendedTarget = height + (target - height) * weight;
          height = Math.max(height, blendedTarget);
          break;
        }
        case 'min': {
          const blendedTarget = height + (target - height) * weight;
          height = Math.min(height, blendedTarget);
          break;
        }
        case 'replace':
          height += (target - height) * weight;
          break;
      }
    }

    return height - base;
  }
}
