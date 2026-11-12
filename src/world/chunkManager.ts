/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import seedrandom from 'seedrandom';
import {
  getProceduralTerrainHeight,
  getTerrainVertexColor,
  sampleBiomeAt,
  isInsideProtectedZone,
  getDistanceToRiver,
  getActiveBiomeGenerator,
  RIVER_HALF_WIDTH,
  OCEAN_WATER_LEVEL,
} from './proceduralTerrain';
import type { TerrainSampler } from './terrain/TerrainData';
import type { Bounds2 } from './core/WorldTypes';
import type { ScatterGenerator } from './scatter/ScatterGenerator';
import { ExclusionMask } from './scatter/ExclusionMask';
import { SCATTER_GROUP_IDS } from './scatter/scatter.data';

export interface PerformanceProfile {
  isMobile: boolean;
  isSoftwareGl: boolean;
  chunkSize: number;
  loadRadiusChunks: number;
  unloadRadiusChunks: number;
  segmentsPerChunk: number;
  enableBloom: boolean;
  fogNear: number;
  fogFar: number;
  treeCullDistance: number;
}

/**
 * Detects GPU software rasterizers (SwiftShader/llvmpipe) and mobile touch viewports
 * to configure adaptive chunk streaming, geometry density, and render distances.
 */
export function detectPerformanceProfile(): PerformanceProfile {
  let isSoftwareGl = false;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) {
      isSoftwareGl = true;
    } else {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }
  } catch {
    isSoftwareGl = false;
  }

  const isMobile =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches ||
      (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) < 900) ||
      window.innerWidth < 768);

  const lowPower = isSoftwareGl || isMobile;
  const chunkSize = 64;
  const loadRadiusChunks = lowPower ? 2 : 3;
  const unloadRadiusChunks = loadRadiusChunks + 1;

  return {
    isMobile,
    isSoftwareGl,
    chunkSize,
    loadRadiusChunks,
    unloadRadiusChunks,
    segmentsPerChunk: isSoftwareGl ? 14 : isMobile ? 18 : 24,
    enableBloom: !lowPower,
    fogNear: lowPower ? 48 : 65,
    fogFar: lowPower ? 155 : 225,
    treeCullDistance: lowPower ? 135 : 195,
  };
}

export interface ChunkCollider {
  x: number;
  z: number;
  radius: number;
}

interface ActiveChunk {
  key: string;
  cx: number;
  cz: number;
  terrainMesh: THREE.Mesh;
  formationMeshes: THREE.InstancedMesh[];
  colliders: ChunkCollider[];
}

// Reusable module-scope math helpers (Zero GC in update/build loops)
const _tempColor = new THREE.Color();
const _swampRockColor = new THREE.Color(0x4d5d43);
const _coastRockColor = new THREE.Color(0x9ca3af);
const _baseRockColorA = new THREE.Color(0x64748b);
const _baseRockColorB = new THREE.Color(0x94a3b8);
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _euler = new THREE.Euler();

export class ChunkManager {
  private scene: THREE.Scene;
  private worldSeed: string;
  public readonly profile: PerformanceProfile;
  private isNearRoadFn: (x: number, z: number, margin?: number) => boolean;
  private heightAt: (x: number, z: number) => number;
  private terrainSampler: TerrainSampler | null;
  private scatter: ScatterGenerator | null;

  private terrainMat: THREE.MeshStandardMaterial;
  private oceanMesh: THREE.Mesh;

  // Shared prototype geometries & materials for natural biome formations
  private rockGeo: THREE.BufferGeometry;
  private spireGeo: THREE.BufferGeometry;
  private shardGeo: THREE.BufferGeometry;

  private rockMat: THREE.MeshStandardMaterial;
  private snowCrystalMat: THREE.MeshStandardMaterial;
  private spectralShardMat: THREE.MeshStandardMaterial;

  private activeChunks: Map<string, ActiveChunk> = new Map();
  private pendingQueue: { cx: number; cz: number; distSq: number }[] = [];
  private lastCenterCx: number = Number.NaN;
  private lastCenterCz: number = Number.NaN;

  constructor(
    scene: THREE.Scene,
    groundTex: THREE.Texture,
    worldSeed: string,
    profile: PerformanceProfile,
    isNearRoadFn: (x: number, z: number, margin?: number) => boolean,
    terrainSampler?: TerrainSampler,
    scatter?: ScatterGenerator
  ) {
    this.scene = scene;
    this.worldSeed = worldSeed;
    this.profile = profile;
    this.isNearRoadFn = isNearRoadFn;
    this.terrainSampler = terrainSampler ?? null;
    this.scatter = scatter ?? null;
    this.heightAt = terrainSampler
      ? (x, z) => terrainSampler.heightAt(x, z)
      : getProceduralTerrainHeight;

    // Ground texture configured for seamless world-space UV tiling (1 tile = 8m)
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(1, 1);

    this.terrainMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.05,
    });

    // Continuous Surrounding Ocean Plane at coastal sea level
    const oceanGeo = new THREE.PlaneGeometry(1400, 1400, 1, 1);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.86,
      roughness: 0.16,
      metalness: 0.68,
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.set(0, OCEAN_WATER_LEVEL, 0);
    this.oceanMesh.name = 'continental_ocean';
    this.scene.add(this.oceanMesh);

    // Shared Natural Formation Geometries (bottom-pivoted so Y=0 sits flush on ground)
    this.rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
    this.rockGeo.translate(0, 0.65, 0);

    this.spireGeo = new THREE.ConeGeometry(0.75, 2.6, 5);
    this.spireGeo.translate(0, 1.2, 0);

    this.shardGeo = new THREE.OctahedronGeometry(0.85, 0);
    this.shardGeo.translate(0, 0.8, 0);

    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.08,
    });

    this.snowCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.65,
    });

    this.spectralShardMat = new THREE.MeshStandardMaterial({
      color: 0x581c87,
      emissive: 0x9333ea,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.55,
    });
  }

  private getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public worldToChunkCoord(val: number): number {
    return Math.floor((val + this.profile.chunkSize * 0.5) / this.profile.chunkSize);
  }

  /**
   * Synchronously preloads chunks around the initial spawn so frame 0 has complete terrain.
   */
  public preloadAround(worldX: number, worldZ: number): void {
    const centerCx = this.worldToChunkCoord(worldX);
    const centerCz = this.worldToChunkCoord(worldZ);
    this.lastCenterCx = centerCx;
    this.lastCenterCz = centerCz;

    const r = this.profile.loadRadiusChunks;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const key = this.getChunkKey(cx, cz);
        if (!this.activeChunks.has(key)) {
          this.buildChunk(cx, cz);
        }
      }
    }
  }

  /**
   * Streams chunks in and out based on player proximity, keeping ocean centered.
   */
  public update(playerX: number, playerZ: number): void {
    this.oceanMesh.position.x = playerX;
    this.oceanMesh.position.z = playerZ;

    const centerCx = this.worldToChunkCoord(playerX);
    const centerCz = this.worldToChunkCoord(playerZ);

    if (centerCx !== this.lastCenterCx || centerCz !== this.lastCenterCz) {
      this.lastCenterCx = centerCx;
      this.lastCenterCz = centerCz;

      // 1. Unload chunks beyond unloadRadiusChunks
      const unloadR = this.profile.unloadRadiusChunks;
      for (const [key, chunk] of this.activeChunks.entries()) {
        const chebyshev = Math.max(Math.abs(chunk.cx - centerCx), Math.abs(chunk.cz - centerCz));
        if (chebyshev > unloadR) {
          this.unloadChunk(key, chunk);
        }
      }

      // 2. Queue missing chunks inside loadRadiusChunks ordered nearest-first
      this.pendingQueue.length = 0;
      const loadR = this.profile.loadRadiusChunks;
      for (let dx = -loadR; dx <= loadR; dx++) {
        for (let dz = -loadR; dz <= loadR; dz++) {
          const cx = centerCx + dx;
          const cz = centerCz + dz;
          const key = this.getChunkKey(cx, cz);
          if (!this.activeChunks.has(key)) {
            this.pendingQueue.push({ cx, cz, distSq: dx * dx + dz * dz });
          }
        }
      }
      this.pendingQueue.sort((a, b) => a.distSq - b.distSq);
    }

    // Build up to 2 queued chunks per frame to prevent frame-time spikes on mobile
    let builtThisFrame = 0;
    const maxPerFrame = this.profile.isMobile ? 1 : 2;
    while (this.pendingQueue.length > 0 && builtThisFrame < maxPerFrame) {
      const next = this.pendingQueue.shift()!;
      const key = this.getChunkKey(next.cx, next.cz);
      if (!this.activeChunks.has(key)) {
        this.buildChunk(next.cx, next.cz);
        builtThisFrame++;
      }
    }
  }

  /**
   * Deterministically generates terrain geometry and natural biome formations for chunk (cx, cz).
   */
  private buildChunk(cx: number, cz: number): void {
    const size = this.profile.chunkSize;
    const segs = this.profile.segmentsPerChunk;
    const originX = cx * size;
    const originZ = cz * size;

    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const normals = new Float32Array(pos.count * 3);
    const colors = new Float32Array(pos.count * 3);

    const nEps = 0.85;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = originX + lx;
      const wz = originZ + lz;

      const wy = this.heightAt(wx, wz);
      pos.setY(i, wy);

      // Seamless world-space UV mapping (8m per pixel-art ground tile)
      uv.setXY(i, wx / 8.0, -wz / 8.0);

      // Analytical central-difference normal for 100% seamless cross-chunk shading
      const hL = this.heightAt(wx - nEps, wz);
      const hR = this.heightAt(wx + nEps, wz);
      const hD = this.heightAt(wx, wz - nEps);
      const hU = this.heightAt(wx, wz + nEps);

      const nx = hL - hR;
      const ny = 2.0 * nEps;
      const nz = hD - hU;
      const len = Math.hypot(nx, ny, nz) || 1.0;

      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;

      getTerrainVertexColor(wx, wz, wy, _tempColor, this.heightAt);
      colors[i * 3] = _tempColor.r;
      colors[i * 3 + 1] = _tempColor.g;
      colors[i * 3 + 2] = _tempColor.b;
    }

    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();

    const terrainMesh = new THREE.Mesh(geo, this.terrainMat);
    terrainMesh.position.set(originX, 0, originZ);
    terrainMesh.name = `terrain_chunk_${cx}_${cz}`;
    this.scene.add(terrainMesh);

    // Deterministic Natural Formations per Chunk
    const rng = seedrandom(`${this.worldSeed}_chunk_${cx}_${cz}`);
    const colliders: ChunkCollider[] = [];
    const rockTransforms: { m: THREE.Matrix4; tint: THREE.Color }[] = [];
    const spireTransforms: THREE.Matrix4[] = [];
    const shardTransforms: THREE.Matrix4[] = [];

    const scatter = this.scatter;
    const terrainSampler = this.terrainSampler;
    const formationGroup = scatter?.database.get(SCATTER_GROUP_IDS.formations);

    if (scatter && terrainSampler && formationGroup) {
      const exclusions = new ExclusionMask();
      exclusions.add({
        id: 'emerald-lake',
        shape: { type: 'circle', center: { x: 100, z: -80 }, radius: 32 },
      });
      const placements = scatter.generate({
        group: formationGroup,
        bounds: {
          minX: originX - size * 0.5,
          minZ: originZ - size * 0.5,
          maxX: originX + size * 0.5,
          maxZ: originZ + size * 0.5,
        },
        terrain: terrainSampler,
        biome: getActiveBiomeGenerator(),
        exclusions,
        seed: scatter.seedConfig,
        blocked: (wx, wz) =>
          isInsideProtectedZone(wx, wz, 3.5) ||
          this.isNearRoadFn(wx, wz, 5.2) ||
          getDistanceToRiver(wx, wz).distance < RIVER_HALF_WIDTH + 2.8,
      });

      for (let i = 0; i < placements.length; i++) {
        const placement = placements[i];
        const s = placement.scale;

        if (placement.variant === 1) {
          _dummyPos.set(placement.x, placement.y - 0.15, placement.z);
          _euler.set(
            (placement.random - 0.5) * 0.22,
            placement.rotationY,
            (placement.random - 0.5) * 0.22
          );
          _dummyQuat.setFromEuler(_euler);
          _dummyScale.set(s, s * (1.0 + placement.random * 0.45), s);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          spireTransforms.push(_dummyMatrix.clone());
          colliders.push({ x: placement.x, z: placement.z, radius: 0.9 * s });
        } else if (placement.variant === 2) {
          _dummyPos.set(placement.x, placement.y - 0.1, placement.z);
          _euler.set(
            (placement.random - 0.5) * 0.3,
            placement.rotationY,
            (placement.random - 0.5) * 0.3
          );
          _dummyQuat.setFromEuler(_euler);
          _dummyScale.set(s * 0.85, s * 1.5, s * 0.85);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          shardTransforms.push(_dummyMatrix.clone());
          colliders.push({ x: placement.x, z: placement.z, radius: 0.95 * s });
        } else {
          const biomeId = sampleBiomeAt(placement.x, placement.z, this.heightAt).biome;
          _dummyPos.set(placement.x, placement.y - 0.2, placement.z);
          _euler.set(
            (placement.random - 0.5) * 0.25,
            placement.rotationY,
            (placement.random - 0.5) * 0.25
          );
          _dummyQuat.setFromEuler(_euler);
          _dummyScale.set(s * 1.15, s * 0.82, s);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);

          const tint =
            biomeId === 'swamp'
              ? _swampRockColor
              : biomeId === 'coast'
                ? _coastRockColor
                : _tempColor.copy(_baseRockColorA).lerp(_baseRockColorB, placement.random).clone();

          rockTransforms.push({ m: _dummyMatrix.clone(), tint });
          colliders.push({ x: placement.x, z: placement.z, radius: 1.05 * s });
        }
      }
    } else {
      const candidateCount = this.profile.isMobile ? 10 : 14;
      for (let i = 0; i < candidateCount; i++) {
        const wx = originX + (rng() - 0.5) * (size - 4.0);
        const wz = originZ + (rng() - 0.5) * (size - 4.0);

        // Respect manual narrative locations, roads, lake, and river
        if (isInsideProtectedZone(wx, wz, 3.5)) continue;
        if (this.isNearRoadFn(wx, wz, 5.2)) continue;
        if (Math.hypot(wx - 100, wz - (-80)) < 32) continue;
        if (getDistanceToRiver(wx, wz).distance < RIVER_HALF_WIDTH + 2.8) continue;

        const sample = sampleBiomeAt(wx, wz, this.heightAt);
        if (sample.elevation < OCEAN_WATER_LEVEL + 0.35) continue;

        const wy = sample.elevation;
        const rotY = rng() * Math.PI * 2;

        if (sample.biome === 'snow' && rng() < 0.65) {
          const s = 0.85 + rng() * 0.85;
          _dummyPos.set(wx, wy - 0.15, wz);
          _euler.set((rng() - 0.5) * 0.22, rotY, (rng() - 0.5) * 0.22);
          _dummyQuat.setFromEuler(_euler);
          _dummyScale.set(s, s * (1.0 + rng() * 0.45), s);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          spireTransforms.push(_dummyMatrix.clone());
          colliders.push({ x: wx, z: wz, radius: 0.9 * s });
        } else if (sample.biome === 'spectral' && rng() < 0.65) {
          const s = 0.9 + rng() * 0.9;
          _dummyPos.set(wx, wy - 0.1, wz);
          _euler.set((rng() - 0.5) * 0.3, rotY, (rng() - 0.5) * 0.3);
          _dummyQuat.setFromEuler(_euler);
          _dummyScale.set(s * 0.85, s * 1.5, s * 0.85);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
          shardTransforms.push(_dummyMatrix.clone());
          colliders.push({ x: wx, z: wz, radius: 0.95 * s });
        } else {
          // Spawn density depends on biome (mountains & coasts have abundant boulders, meadows sparse)
          const spawnChance =
            sample.biome === 'mountain'
              ? 0.72
              : sample.biome === 'coast'
              ? 0.45
              : sample.biome === 'swamp'
              ? 0.4
              : 0.22;
          if (rng() > spawnChance) continue;

          const s = sample.biome === 'mountain' ? 1.1 + rng() * 1.2 : 0.7 + rng() * 0.75;
          _dummyPos.set(wx, wy - 0.2, wz);
          _euler.set((rng() - 0.5) * 0.25, rotY, (rng() - 0.5) * 0.25);
          _dummyQuat.setFromEuler(_euler);
          _dummyScale.set(s * 1.15, s * 0.82, s);
          _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);

          const tint =
            sample.biome === 'swamp'
              ? _swampRockColor
              : sample.biome === 'coast'
              ? _coastRockColor
              : _tempColor.copy(_baseRockColorA).lerp(_baseRockColorB, rng()).clone();

          rockTransforms.push({ m: _dummyMatrix.clone(), tint });
          colliders.push({ x: wx, z: wz, radius: 1.05 * s });
        }
      }
    }

    const formationMeshes: THREE.InstancedMesh[] = [];

    if (rockTransforms.length > 0) {
      const rockIMesh = new THREE.InstancedMesh(this.rockGeo, this.rockMat, rockTransforms.length);
      for (let i = 0; i < rockTransforms.length; i++) {
        rockIMesh.setMatrixAt(i, rockTransforms[i].m);
        rockIMesh.setColorAt(i, rockTransforms[i].tint);
      }
      rockIMesh.instanceMatrix.needsUpdate = true;
      if (rockIMesh.instanceColor) rockIMesh.instanceColor.needsUpdate = true;
      rockIMesh.computeBoundingSphere();
      this.scene.add(rockIMesh);
      formationMeshes.push(rockIMesh);
    }

    if (spireTransforms.length > 0) {
      const spireIMesh = new THREE.InstancedMesh(this.spireGeo, this.snowCrystalMat, spireTransforms.length);
      for (let i = 0; i < spireTransforms.length; i++) {
        spireIMesh.setMatrixAt(i, spireTransforms[i]);
      }
      spireIMesh.instanceMatrix.needsUpdate = true;
      spireIMesh.computeBoundingSphere();
      this.scene.add(spireIMesh);
      formationMeshes.push(spireIMesh);
    }

    if (shardTransforms.length > 0) {
      const shardIMesh = new THREE.InstancedMesh(this.shardGeo, this.spectralShardMat, shardTransforms.length);
      for (let i = 0; i < shardTransforms.length; i++) {
        shardIMesh.setMatrixAt(i, shardTransforms[i]);
      }
      shardIMesh.instanceMatrix.needsUpdate = true;
      shardIMesh.computeBoundingSphere();
      this.scene.add(shardIMesh);
      formationMeshes.push(shardIMesh);
    }

    const key = this.getChunkKey(cx, cz);
    this.activeChunks.set(key, {
      key,
      cx,
      cz,
      terrainMesh,
      formationMeshes,
      colliders,
    });
  }

  private unloadChunk(key: string, chunk: ActiveChunk): void {
    this.scene.remove(chunk.terrainMesh);
    chunk.terrainMesh.geometry.dispose();

    for (let i = 0; i < chunk.formationMeshes.length; i++) {
      const im = chunk.formationMeshes[i];
      this.scene.remove(im);
      im.dispose();
    }

    this.activeChunks.delete(key);
  }

  /**
   * O(1) spatial-hash collision check against natural formations in the player's local 3x3 chunk neighborhood.
   */
  public checkCollision(x: number, z: number, playerRadius: number): boolean {
    const cx = this.worldToChunkCoord(x);
    const cz = this.worldToChunkCoord(z);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const chunk = this.activeChunks.get(this.getChunkKey(cx + dx, cz + dz));
        if (!chunk) continue;
        for (let i = 0; i < chunk.colliders.length; i++) {
          const c = chunk.colliders[i];
          if (Math.hypot(x - c.x, z - c.z) < c.radius + playerRadius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public getLoadedChunkCount(): number {
    return this.activeChunks.size;
  }

  public getTerrainMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const chunk of this.activeChunks.values()) {
      meshes.push(chunk.terrainMesh);
    }
    return meshes;
  }

  public invalidateRegion(region?: Bounds2): void {
    const toRebuild: { cx: number; cz: number }[] = [];
    const size = this.profile.chunkSize;
    for (const [key, chunk] of this.activeChunks.entries()) {
      if (region) {
        const chunkMinX = chunk.cx * size;
        const chunkMaxX = chunkMinX + size;
        const chunkMinZ = chunk.cz * size;
        const chunkMaxZ = chunkMinZ + size;
        const overlaps =
          chunkMaxX >= region.minX &&
          chunkMinX <= region.maxX &&
          chunkMaxZ >= region.minZ &&
          chunkMinZ <= region.maxZ;
        if (!overlaps) continue;
      }
      toRebuild.push({ cx: chunk.cx, cz: chunk.cz });
      this.unloadChunk(key, chunk);
    }
    for (let i = 0; i < toRebuild.length; i++) {
      this.buildChunk(toRebuild[i].cx, toRebuild[i].cz);
    }
  }

  public dispose(): void {
    for (const [key, chunk] of this.activeChunks.entries()) {
      this.unloadChunk(key, chunk);
    }
    this.scene.remove(this.oceanMesh);
    this.oceanMesh.geometry.dispose();
    (this.oceanMesh.material as THREE.Material).dispose();
    this.rockGeo.dispose();
    this.spireGeo.dispose();
    this.shardGeo.dispose();
    this.rockMat.dispose();
    this.snowCrystalMat.dispose();
    this.spectralShardMat.dispose();
    this.terrainMat.dispose();
  }
}
