/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TerrainHeightSample } from '../terrain/TerrainData';
import {
  clamp01,
  matchesBiomeCondition,
  type BiomeEnvironment,
  type BiomeEnvironmentSampler,
  type BiomeId,
  type BiomeResolver,
  type ResolvedBiomeSample,
} from './BiomeDefinition';
import type { BiomeDatabase } from './BiomeDatabase';
import {
  sampleBiomeMask,
  type BiomeMask,
  type BiomeMaskSampleContext,
} from './BiomeMask';
import type { BiomeSpline, BiomeSplineDatabase } from './BiomeSpline';

export interface BiomePriorityResolverOptions {
  database: BiomeDatabase;
  masks?: readonly BiomeMask[];
  splines?: BiomeSplineDatabase;
  environmentAt?: BiomeEnvironmentSampler;
}

interface RuntimeEntry {
  active: boolean;
  weight: number;
  priority: number;
}

const EPSILON = 1e-6;

function compareByIdThenPriority<T extends { id: string; priority: number }>(
  a: T,
  b: T
): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function sampleSplineInfluence(
  distance: number,
  width: number,
  falloff: number,
  strength: number
): number {
  const halfWidth = Math.abs(width) * 0.5;
  if (halfWidth <= EPSILON || distance >= halfWidth) return 0;
  if (falloff <= EPSILON) return strength;

  const core = halfWidth * (1 - clamp01(falloff));
  if (distance <= core) return strength;

  const t = clamp01((halfWidth - distance) / (halfWidth * clamp01(falloff)));
  return strength * smoothStep(0, 1, t);
}

function fallbackEnvironment(
  x: number,
  z: number,
  terrain: TerrainHeightSample
): BiomeEnvironment {
  return {
    x,
    z,
    elevation: terrain.height,
    slope: terrain.slope,
    moisture: 0.5,
    temperature: 0.5,
    riverDistance: Infinity,
    lakeDistance: Infinity,
    radialDistance: Math.hypot(x, z),
    onBridge: false,
  };
}

export class BiomePriorityResolver implements BiomeResolver {
  private readonly database: BiomeDatabase;
  private readonly masks: BiomeMask[];
  private readonly splines: BiomeSpline[];
  private readonly splineDatabase?: BiomeSplineDatabase;
  private readonly environmentAt?: BiomeEnvironmentSampler;
  private readonly runtime: RuntimeEntry[];
  private readonly maskContext: BiomeMaskSampleContext;

  constructor(options: BiomePriorityResolverOptions) {
    this.database = options.database;
    this.masks = options.masks ? Array.from(options.masks) : [];
    this.masks.sort(compareByIdThenPriority);
    this.splineDatabase = options.splines;
    this.splines = options.splines ? Array.from(options.splines.getSplines()) : [];
    this.splines.sort(compareByIdThenPriority);
    this.environmentAt = options.environmentAt;
    this.runtime = this.database.all().map(() => ({
      active: false,
      weight: 0,
      priority: 0,
    }));
    this.maskContext = {
      splineDistance: this.splineDatabase
        ? (splineId, x, z) => this.splineDatabase!.distanceToPath(splineId, x, z)
        : undefined,
    };
  }

  public sampleAt(
    x: number,
    z: number,
    terrain: TerrainHeightSample
  ): ResolvedBiomeSample {
    const environment = this.environmentAt
      ? this.environmentAt(x, z, terrain)
      : fallbackEnvironment(x, z, terrain);
    return this.sampleFromEnvironment(environment);
  }

  public weightsAt(
    x: number,
    z: number,
    terrain: TerrainHeightSample
  ): ReadonlyMap<BiomeId, number> {
    const environment = this.environmentAt
      ? this.environmentAt(x, z, terrain)
      : fallbackEnvironment(x, z, terrain);
    return this.weightsFromEnvironment(environment);
  }

  public setMasks(masks: readonly BiomeMask[]): void {
    this.masks.length = 0;
    this.masks.push(...masks);
    this.masks.sort(compareByIdThenPriority);
  }

  public getMasks(): readonly BiomeMask[] {
    return this.masks;
  }

  public sampleFromEnvironment(environment: BiomeEnvironment): ResolvedBiomeSample {
    this.evaluate(environment);

    let bestIndex = -1;
    let bestPriority = -Infinity;
    let bestId = '';

    for (let i = 0; i < this.runtime.length; i++) {
      const entry = this.runtime[i];
      if (!entry.active || entry.weight <= EPSILON) continue;
      const definition = this.database.definitionAt(i);
      if (!definition) continue;

      if (
        entry.priority > bestPriority ||
        (entry.priority === bestPriority && definition.id < bestId)
      ) {
        bestIndex = i;
        bestPriority = entry.priority;
        bestId = definition.id;
      }
    }

    if (bestIndex < 0) {
      bestIndex = this.findFallbackIndex();
    }

    if (bestIndex < 0) {
      return { biomeId: 'meadow', weight: 0, blend: 0 };
    }

    const bestDefinition = this.database.definitionAt(bestIndex);
    if (!bestDefinition) {
      return { biomeId: 'meadow', weight: 0, blend: 0 };
    }

    let secondaryIndex = -1;
    let secondaryPriority = -Infinity;
    let secondaryId = '';
    for (let i = 0; i < this.runtime.length; i++) {
      if (i === bestIndex) continue;
      const entry = this.runtime[i];
      if (!entry.active || entry.weight <= EPSILON) continue;
      const definition = this.database.definitionAt(i);
      if (!definition) continue;

      if (
        entry.priority > secondaryPriority ||
        (entry.priority === secondaryPriority && definition.id < secondaryId)
      ) {
        secondaryIndex = i;
        secondaryPriority = entry.priority;
        secondaryId = definition.id;
      }
    }

    const bestWeight = clamp01(this.runtime[bestIndex].weight);
    const secondaryDefinition =
      secondaryIndex >= 0 ? this.database.definitionAt(secondaryIndex) : undefined;
    const secondaryWeight =
      secondaryIndex >= 0 ? clamp01(this.runtime[secondaryIndex].weight) : 0;
    const blend =
      secondaryDefinition && bestWeight + secondaryWeight > EPSILON
        ? secondaryWeight / (bestWeight + secondaryWeight)
        : 0;

    return {
      biomeId: bestDefinition.id,
      weight: bestWeight,
      secondaryBiomeId: secondaryDefinition?.id,
      blend,
    };
  }

  public weightsFromEnvironment(
    environment: BiomeEnvironment
  ): ReadonlyMap<BiomeId, number> {
    this.evaluate(environment);

    const weights = new Map<BiomeId, number>();
    for (let i = 0; i < this.runtime.length; i++) {
      const entry = this.runtime[i];
      if (!entry.active || entry.weight <= EPSILON) continue;
      const definition = this.database.definitionAt(i);
      if (definition) weights.set(definition.id, clamp01(entry.weight));
    }
    return weights;
  }

  private findFallbackIndex(): number {
    for (let i = 0; i < this.runtime.length; i++) {
      const definition = this.database.definitionAt(i);
      if (definition && definition.enabled) return i;
    }
    return -1;
  }

  private evaluate(environment: BiomeEnvironment): void {
    for (let i = 0; i < this.runtime.length; i++) {
      const definition = this.database.definitionAt(i);
      const entry = this.runtime[i];
      entry.active = false;
      entry.weight = 0;
      entry.priority = definition ? definition.priority : 0;
    }

    const definitions = this.database.all();
    let baseIndex = -1;
    let basePriority = -Infinity;
    let baseId = '';
    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      if (!definition.enabled) continue;
      if (!matchesBiomeCondition(definition.rule, environment)) continue;

      if (
        definition.priority > basePriority ||
        (definition.priority === basePriority && definition.id < baseId)
      ) {
        baseIndex = i;
        basePriority = definition.priority;
        baseId = definition.id;
      }
    }
    if (baseIndex >= 0) {
      const baseDefinition = definitions[baseIndex];
      this.applyWeight(baseDefinition.id, 1, baseDefinition.priority, 'add');
    }

    for (let i = 0; i < this.masks.length; i++) {
      const mask = this.masks[i];
      const influence = sampleBiomeMask(mask, environment.x, environment.z, this.maskContext);
      if (influence <= EPSILON) continue;
      this.applyWeight(mask.biomeId, influence, mask.priority, mask.mode);
    }

    if (!this.splineDatabase) return;

    for (let i = 0; i < this.splines.length; i++) {
      const spline = this.splines[i];
      if (!spline.enabled) continue;

      const distance = this.splineDatabase.distanceToPath(
        spline.splineId,
        environment.x,
        environment.z
      );
      if (distance === null) continue;

      const influence = sampleSplineInfluence(
        distance,
        spline.width,
        spline.falloff,
        clamp01(spline.strength)
      );
      if (influence <= EPSILON) continue;
      this.applyWeight(spline.biomeId, influence, spline.priority, 'add');
    }
  }

  private applyWeight(
    biomeId: BiomeId,
    influence: number,
    priority: number,
    mode: BiomeMask['mode']
  ): void {
    const index = this.database.indexOf(biomeId);
    if (index < 0) return;

    const definition = this.database.definitionAt(index);
    if (!definition || !definition.enabled) return;

    const entry = this.runtime[index];
    const amount = clamp01(influence);

    if (mode === 'subtract') {
      entry.weight = clamp01(entry.weight - amount);
      if (entry.weight <= EPSILON) {
        entry.active = false;
        entry.weight = 0;
      } else {
        entry.active = true;
      }
      return;
    }

    if (mode === 'override') {
      if (amount <= EPSILON) return;
      entry.active = true;
      entry.weight = amount;
      entry.priority = priority;
      return;
    }

    if (amount <= EPSILON) return;
    entry.active = true;
    entry.weight = clamp01(entry.weight + amount);
    entry.priority = Math.max(entry.priority, priority);
  }
}
