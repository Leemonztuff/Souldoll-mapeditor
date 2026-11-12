/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TerrainHeightSample } from '../terrain/TerrainData';
import type {
  BiomeEnvironment,
  BiomeEnvironmentSampler,
  BiomeId,
  ResolvedBiomeSample,
} from './BiomeDefinition';
import { BiomeDatabase } from './BiomeDatabase';
import type { BiomeMask } from './BiomeMask';
import {
  BiomePriorityResolver,
  type BiomePriorityResolverOptions,
} from './BiomePriorityResolver';
import type { BiomeSplineDatabase } from './BiomeSpline';

export interface BiomeGeneratorOptions {
  database: BiomeDatabase;
  masks?: readonly BiomeMask[];
  splines?: BiomeSplineDatabase;
  environmentAt?: BiomeEnvironmentSampler;
}

export class BiomeGenerator {
  public readonly database: BiomeDatabase;
  public readonly resolver: BiomePriorityResolver;
  private readonly environmentSampler?: BiomeEnvironmentSampler;

  constructor(options: BiomeGeneratorOptions) {
    this.database = options.database;
    this.environmentSampler = options.environmentAt;
    const resolverOptions: BiomePriorityResolverOptions = {
      database: options.database,
      masks: options.masks,
      splines: options.splines,
      environmentAt: options.environmentAt,
    };
    this.resolver = new BiomePriorityResolver(resolverOptions);
  }

  public environmentAt(
    x: number,
    z: number,
    terrain: TerrainHeightSample
  ): BiomeEnvironment {
    if (this.environmentSampler) {
      return this.environmentSampler(x, z, terrain);
    }
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

  public resolve(environment: BiomeEnvironment): ResolvedBiomeSample {
    return this.resolver.sampleFromEnvironment(environment);
  }

  public sampleAt(
    x: number,
    z: number,
    terrain: TerrainHeightSample
  ): ResolvedBiomeSample {
    return this.resolver.sampleAt(x, z, terrain);
  }

  public weightsAt(
    x: number,
    z: number,
    terrain: TerrainHeightSample
  ): ReadonlyMap<BiomeId, number> {
    return this.resolver.weightsAt(x, z, terrain);
  }

  public setMasks(masks: readonly BiomeMask[]): void {
    this.resolver.setMasks(masks);
  }

  public getMasks(): readonly BiomeMask[] {
    return this.resolver.getMasks();
  }
}
