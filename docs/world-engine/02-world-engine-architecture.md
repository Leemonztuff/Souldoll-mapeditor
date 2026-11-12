# 02 — Arquitectura del World Engine (propuesta)

**Proyecto:** `procedural-map-souldolls-rpgv1` (SoulDolls / Luminati)
**Etapa:** Diseño arquitectónico. **No implementa sistemas.**
**Base:** `docs/world-engine/01-current-engine-audit.md`
**Estado:** aprobada. Contratos de `core/` y `terrain/` materializados y validados en la etapa 03. Biomas validados en la etapa 04. Scatter y Splines validados en las etapas 05 y 06.

---

## 1. Objetivo

Evolucionar el motor procedural actual a un **World Engine modular** inspirado funcionalmente en Calysto World 5.8, sin reescribir lo que ya funciona:

- Mantener `worldGen.buildWorld` como fachada de integración durante la migración.
- Mantener la API `getTerrainHeight(x, z)` como contrato público del juego.
- Reutilizar `ChunkManager`, `textures.ts`, `instancing.ts`, `buildingGen.ts`, `caveGen.ts` y `manualLocations.ts`.
- Separar datos persistentes, datos calculados, estado del editor y objetos Three.js.
- Generación determinista, incremental y regenerable por región.
- Presupuesto de rendimiento móvil.

## 2. No objetivos de esta etapa

- No se implementan stamps, biomas, scatter, splines, editor, mapas ni persistencia.
- No se modifica ningún sistema de combate, movimiento, cámara, personaje, inventario, NPC, quests, HUD ni minimapa.
- No se cambia la dirección artística.
- No se añaden motores 3D ni dependencias nuevas.
- No se tocan archivos de Argentum Tales.

---

## 3. Decisiones de arquitectura (ADR resumidas)

| ID | Decisión | Estado |
|---|---|---|
| A01 | El motor vive en `src/world/` (subcarpetas `core/`, `terrain/`, `biomes/`, `scatter/`, `splines/`, `editor/`) | **Aprobada** |
| A02 | `worldGen.buildWorld` se conserva como fachada; delega progresivamente en `WorldManager` | **Aprobada** |
| A03 | `getTerrainHeight` conserva firma y se convierte en adaptador del `TerrainHeightService` activo | **Aprobada** |
| A04 | La base analítica actual (`getProceduralTerrainHeight`) se conserva como `AnalyticHeightSource` | **Aprobada** |
| A05 | El mundo sigue siendo un mundo continuo con `WorldDefinition` por zona/mapa | **Aprobada** |
| A06 | Los datos persistentes son JSON plano (sin `THREE.*`, sin funciones, sin clases) | **Aprobada** |
| A07 | La generación se organiza en fases con caché e invalidación por capas y región | **Aprobada** |
| A08 | Determinismo mediante semillas derivadas por sistema/chunk/grupo/elemento | **Aprobada** |
| A09 | El editor es una herramienta de desarrollo embebida, desactivada por defecto | **Aprobada** |
| A10 | Web Workers solo si el perfilado demuestra beneficio; sin dependencias nuevas | **Aprobada** |

---

## 4. Principios

1. **Compatibilidad primero:** el juego debe seguir jugándose igual en cada etapa.
2. **Datos ≠ cálculo ≠ render:** definiciones serializables → resultados calculados → objetos Three.js.
3. **Una sola fuente de verdad de altura:** todo consulta el mismo sampler.
4. **Invalidación por región:** cambiar una estampa no regenera el mundo entero.
5. **Determinismo:** misma definición + semilla = mismo resultado, independientemente del orden de carga.
6. **Reutilización:** geometrías, materiales, texturas e instancing existentes.
7. **Móvil primero:** presupuesto de draw calls, triángulos, memoria y tiempo de generación.
8. **Sin funcionalidades decorativas:** nada se documenta como terminado si no está probado.

---

## 5. Árbol de módulos objetivo (adaptado)

```text
src/world/
├─ worldGen.ts                      # Fachada actual (se conserva)
├─ proceduralTerrain.ts             # Base analítica actual (se conserva)
├─ chunkManager.ts                  # Streaming actual (se extiende)
├─ textures.ts / instancing.ts      # Arte y billboard actuales (se reutilizan)
├─ buildingGen.ts / caveGen.ts / manualLocations.ts
│
├─ core/
│  ├─ WorldTypes.ts                 # Vec2/Vec3/Bounds2/HeightAtFn (etapa 03)
│  ├─ WorldManager.ts               # Orquesta runtime y fachada
│  ├─ WorldDefinition.ts            # Contrato de datos persistibles
│  ├─ WorldDatabase.ts              # Envoltorio versionado + migraciones
│  ├─ WorldSeed.ts                  # Hash estable + semillas derivadas (etapa 03)
│  ├─ WorkZone.ts                   # Región de trabajo (datos + helpers) (etapa 03)
│  ├─ WorldEvents.ts                # Invalidación y suscripción por capas (etapa 03)
│  └─ WorldGenerationPipeline.ts    # Fases, caché y dirty regions
│
├─ terrain/
│  ├─ TerrainData.ts                # Heightmap calculado (Float32Array) (etapa 03)
│  ├─ TerrainHeightmap.ts           # Muestreo bilineal / bounds (etapa 03)
│  ├─ TerrainGenerator.ts           # Base + estampas
│  ├─ TerrainStamp.ts               # Contrato de estampa (etapa 03)
│  ├─ TerrainStampBlender.ts        # Composición determinista + caché (etapa 03)
│  ├─ terrainStamps.data.ts         # Estampas demo de SoulDolls (etapa 03)
│  ├─ TerrainSurface.ts             # Colores, materiales, superficies
│  └─ TerrainMaterial.ts            # Adaptador al material actual
│
├─ biomes/
│  ├─ BiomeDefinition.ts
│  ├─ BiomeDatabase.ts
│  ├─ BiomeMask.ts
│  ├─ BiomePriorityResolver.ts
│  ├─ BiomePainter.ts
│  ├─ BiomeSpline.ts
│  └─ BiomeGenerator.ts
│
├─ scatter/
│  ├─ ScatterDefinition.ts
│  ├─ ScatterDatabase.ts
│  ├─ ScatterGenerator.ts
│  ├─ ScatterRules.ts
│  ├─ ClusterGenerator.ts
│  ├─ ExclusionMask.ts
│  └─ InstanceBatch.ts
│
├─ splines/
│  ├─ WorldSpline.ts
│  ├─ RoadGenerator.ts
│  ├─ RiverGenerator.ts
│  └─ LakeGenerator.ts
│
└─ editor/
   ├─ WorldEditor.ts
   ├─ TerrainTools.ts
   ├─ BiomeTools.ts
   ├─ ScatterTools.ts
   └─ SplineTools.ts
```

**Regla:** ningún módulo de `terrain/`, `biomes/`, `scatter/`, `splines/` importa `GameEngine`, `PlayerController` ni componentes React. Solo `core/WorldManager` conoce la fachada de juego.

---

## 6. Modelo de capas y flujo

```text
[Datos persistentes]        [Cálculo]                       [Render]
WorldDefinition      →  WorldGenerationPipeline  →  GeneratedWorld  →  WorldView (Three.js)
  ├ terrain.stamps        1. base analítica              ├ heightmap          ├ chunk meshes
  ├ biome defs/masks      2. stamps                      ├ biome map          ├ instanced scatter
  ├ splines               3. splines (carve/level)       ├ scatter placement  ├ water meshes
  ├ scatter rules         4. superficie                   ├ exclusions        ├ props/POIs
  ├ work zones            5. biomas                       └ collision data    └ runtime details
  └ seed                  6. scatter principal
                          7. runtime details
                          8. colisiones/nav
                          9. commit por región
```

Flujo de una edición:

```text
Editor/command → WorldDefinition cambia → invalidation(layers, region)
  → pipeline recalcula solo las fases afectadas y solo la región sucia
  → WorldView actualiza geometrías/instancias de esa región
```

---

## 7. Contratos TypeScript compartidos

> Estos contratos se materializaron como archivos `.ts` en la etapa 03. No contienen `THREE.*`, funciones ni clases en los tipos persistibles.

### 7.1 Tipos base y serialización

```ts
export type WorldId = string;
export type StampId = string;
export type BiomeId = string;
export type ScatterGroupId = string;
export type SplineId = string;
export type WorkZoneId = string;
export type AssetId = string;
export type MaterialId = string;

/** Vector serializable de 2 componentes (XZ). */
export interface Vec2 { x: number; z: number; }

/** Vector serializable de 3 componentes. */
export interface Vec3 { x: number; y: number; z: number; }

/** Rectángulo alineado a ejes en coordenadas de mundo. */
export interface Bounds2 {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface WorldRect extends Bounds2 {
  id: WorkZoneId;
  name: string;
  enabled: boolean;
  tags: string[];
}
```

Reglas:
- Todo dato persistible debe ser JSON-safe.
- Prohibido guardar `THREE.Vector3`, `THREE.Material`, texturas, mallas o funciones.
- Los IDs son estables y únicos dentro de su colección.
- Los resultados calculados (`GeneratedWorld`, heightmaps, matrices) nunca se persisten.

### 7.2 Semillas y determinismo

```ts
export interface WorldSeedConfig {
  /** Semilla raíz, texto estable. */
  root: string;
  /** Versión del algoritmo de derivación; invalida cachés al cambiarla. */
  algorithmVersion: number;
}

export interface SeedScope {
  system: 'terrain' | 'biome' | 'scatter' | 'spline' | 'detail' | 'editor';
  chunkX?: number;
  chunkZ?: number;
  groupId?: string;
  elementId?: string;
  index?: number;
}

export interface WorldSeedService {
  /** Deriva una semilla de 32 bits estable para un ámbito. */
  derive(seed: WorldSeedConfig, scope: SeedScope): number;
  /** PRNG determinista a partir de una semilla derivada. */
  createRng(seed: number): () => number;
}
```

Contrato:
- La derivación no puede depender de `Math.random`, del orden de llamadas ni del reloj.
- Cada sistema/chunk/grupo/elemento usa su propia semilla; añadir un grupo no altera los demás.
- Cambiar `algorithmVersion` debe invalidar cachés y regenerar de forma controlada.
- Las texturas y el arte pueden seguir usando sus generadores actuales (deterministas o de una sola vez), pero el **mundo lógico** no usa `Math.random`.

### 7.3 WorkZone

```ts
export interface WorkZone {
  id: WorkZoneId;
  name: string;
  center: Vec2;
  size: Vec2;
  enabled: boolean;
  tags: string[];
}

export interface WorkZoneRuntime {
  bounds: Bounds2;
  contains(x: number, z: number, margin?: number): boolean;
  intersects(bounds: Bounds2): boolean;
  clamp(bounds: Bounds2): Bounds2 | null;
}
```

Semántica:
- Generar dentro de la zona: solo estampas/scatter/biomas cuyo footprint intersecte la zona.
- Eliminar dentro de la zona: borra elementos **cuyo origen** esté dentro; los elementos que solo cruzan el borde se conservan salvo que la operación indique `intersect`.
- Añadir sin borrar: `mode: 'add'`.
- Regenerar zona: marca las capas afectadas con `Bounds2` de la zona.

### 7.4 TerrainData / altura

```ts
export interface TerrainDataOptions {
  originX: number;
  originZ: number;
  width: number;          // celdas en X
  height: number;         // celdas en Z
  cellSize: number;       // metros por celda
  heights: Float32Array;  // longitud width * height
  flags?: Uint8Array;     // bits de superficie (agua, camino, exclusión...)
  version: number;
}

export interface TerrainHeightSample {
  height: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  slope: number;
}

export interface TerrainSampler {
  /** Altura autoritativa en coordenadas de mundo (interpolación bilineal). */
  heightAt(x: number, z: number): number;
  sampleAt(x: number, z: number): TerrainHeightSample;
  /** Altura analítica base, sin estampas. */
  baseHeightAt(x: number, z: number): number;
  bounds: Bounds2;
  resolution: number;
}
```

Contrato de compatibilidad:
- `worldGen.getTerrainHeight(x, z)` delega en el `TerrainSampler` activo y conserva su firma.
- Sin estampas ni splines de terreno, el resultado debe coincidir con `getProceduralTerrainHeight` dentro de `1e-6`.
- La etapa 03 implementó la caché de offsets con `cellSize = 2 m`; evaluar 1 m si el relieve pierde detalle. La altura base sigue siendo analítica y no depende de esta resolución.
- `TerrainSampler` es de solo lectura para todos los sistemas; solo `TerrainGenerator` escribe alturas.

### 7.5 TerrainStamp

```ts
export type StampCategory =
  | 'mountain' | 'hill' | 'valley' | 'ridge' | 'plateau'
  | 'crater' | 'cliff' | 'plain' | 'depression';

export type StampBlendMode = 'add' | 'max' | 'min' | 'replace';
export type StampFalloff = 'none' | 'linear' | 'smoothstep' | 'cosine' | 'gaussian';

export type StampSource =
  | { kind: 'preset'; preset: StampCategory; seed: number }
  | { kind: 'embedded'; resolution: number; values: number[] }
  | { kind: 'asset'; assetId: AssetId };

export interface TerrainStamp {
  id: StampId;
  category: StampCategory;
  source: StampSource;
  seed: number;
  position: Vec2;
  /** Rotación en radianes sobre el eje Y. */
  rotation: number;
  /** Escala del footprint en XZ y amplitud vertical. */
  scale: { x: number; z: number; amplitude: number };
  /** 0..1, multiplica la influencia. */
  intensity: number;
  blendMode: StampBlendMode;
  falloff: {
    type: StampFalloff;
    /** Radio interno sin atenuación, en unidades normalizadas 0..1. */
    inner: number;
    /** Radio externo donde la influencia llega a 0, 0..1. */
    outer: number;
  };
  enabled: boolean;
  /** Orden de composición; menor = antes. */
  priority: number;
  tags: string[];
}
```

Contrato de composición:
- Evaluar estampas ordenadas por `(priority, id)`; el orden es estable.
- Cada estampa calcula una `influencia` y un `desplazamiento` local; no muta datos de otras estampas.
- `add`: `h += d * w`.
- `max`: `h += max(0, d) * w` (montañas/crestas).
- `min`: `h += min(0, d) * w` (valles/depresiones).
- `replace`: `h = lerp(h, targetH, w)`, donde `targetH` se evalúa desde la forma de la estampa y la base bajo su origen.
- Reset de región: recalcular solo las celdas de la zona desde la base + estampas restantes.
- Los presets deben generarse proceduralmente (sin assets externos obligatorios).

### 7.6 Biomas

```ts
export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  priority: number;
  enabled: boolean;
  seed: number;
  baseGroundMaterial: MaterialId;
  secondaryGroundMaterials: MaterialId[];
  vegetationGroups: ScatterGroupId[];
  detailGroups: ScatterGroupId[];
  density: number;
  minHeight: number;
  maxHeight: number;
  minSlope: number;
  maxSlope: number;
  /** Color base del terreno (compatibilidad con vertex colors). */
  groundColor: number;
  tags: string[];
}

export type BiomeMaskShape =
  | { type: 'circle'; center: Vec2; radius: number }
  | { type: 'rect'; bounds: Bounds2 }
  | { type: 'polygon'; points: Vec2[] }
  | { type: 'spline'; splineId: SplineId; width: number };

export interface BiomeMask {
  id: string;
  biomeId: BiomeId;
  mode: 'add' | 'subtract' | 'override';
  shape: BiomeMaskShape;
  falloff: number;   // 0..1
  strength: number;  // 0..1
  priority: number;
  enabled: boolean;
  tags: string[];
}

export interface BiomeSpline {
  id: string;
  splineId: SplineId;
  biomeId: BiomeId;
  width: number;
  falloff: number;
  strength: number;
  priority: number;
  enabled: boolean;
  tags: string[];
}

export interface BiomeSample {
  biomeId: BiomeId;
  weight: number;
  secondaryBiomeId?: BiomeId;
  blend: number; // 0..1
}

export interface BiomeResolver {
  sampleAt(x: number, z: number, terrain: TerrainHeightSample): BiomeSample;
  weightsAt(x: number, z: number, terrain: TerrainHeightSample): ReadonlyMap<BiomeId, number>;
}
```

Contrato:
- Resolución por pesos, no por `if/else` de coordenadas.
- Prioridad: mayor gana; en empate, `id` ascendente para estabilidad.
- Permite biomas anidados y superpuestos.
- `sampleBiomeAt` actual se convierte en adaptador temporal que devuelve el bioma dominante.
- Los materiales se referencian por `MaterialId`; el render los resuelve al material existente.
- Compatibilidad: los 10 biomas actuales se migran a `BiomeDefinition` sin perder color, densidad ni encuentros.

### 7.7 Scatter

```ts
export type ScatterAssetType =
  | 'tree' | 'bush' | 'rock' | 'grass' | 'flower' | 'pebble'
  | 'mushroom' | 'herb' | 'crystal' | 'prop';

export type ScatterDistribution =
  | 'random' | 'grid' | 'cluster' | 'spline' | 'surface';

export interface ScatterDefinition {
  id: ScatterGroupId;
  name: string;
  assetType: ScatterAssetType;
  distribution: ScatterDistribution;
  density: number;
  minScale: number;
  maxScale: number;
  minHeight: number;
  maxHeight: number;
  minSlope: number;
  maxSlope: number;
  minDistance: number;
  randomRotation: boolean;
  alignToNormal: boolean;
  forceWorldUp: boolean;
  clusterStrength: number;
  clusterScale: number;
  noiseStrength: number;
  seed: number;
  biomeCompatibility: BiomeId[];
  exclusionTags: string[];
  /** true = vegetación principal; false = runtime detail. */
  primary: boolean;
  enabled: boolean;
}

export interface ScatterPlacement {
  assetType: ScatterAssetType;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  normal: Vec3;
  groupId: ScatterGroupId;
  shadow: boolean;
}

export interface ScatterRequest {
  group: ScatterDefinition;
  bounds: Bounds2;
  terrain: TerrainSampler;
  biome: BiomeResolver;
  exclusions: ExclusionMask;
  seed: WorldSeedConfig;
}
```

Contrato:
- Una sola base de datos y un solo pipeline para árboles, rocas, hierba, arbustos, flores y detalles.
- `primary: true` → vegetación estructural; `primary: false` → runtime details.
- Los detalles se pueden regenerar sin tocar la vegetación principal.
- Reutiliza `InstancedMesh`, `createBillboardMaterial` y las familias de texturas existentes.
- Presupuesto y LOD se aplican en `InstanceBatch`, no en cada generador.

### 7.8 Splines

```ts
export type SplineType = 'road' | 'river' | 'lake' | 'biome' | 'fence';

export interface WorldSpline {
  id: SplineId;
  type: SplineType;
  controlPoints: Vec3[];
  closed: boolean;
  width: number;
  falloff: number;
  seed: number;
  material: MaterialId;
  enabled: boolean;
  tags: string[];
}

export interface SplineSampler {
  pointAt(t: number): Vec3;
  tangentAt(t: number): Vec3;
  distanceTo(x: number, z: number): number;
  bounds: Bounds2;
}

export interface SplineSurfaceRules {
  projectToTerrain: boolean;
  flattenTerrain: boolean;
  carveDepth: number;
  shoulders: number;
  waterLevel?: number;
  exclusionTags: string[];
}
```

Contrato:
- Un solo contrato de spline para caminos, ríos, lagos y biomas abiertos.
- Persistencia: puntos de control planos; la curva muestreada es cálculo.
- Modificación del terreno no destructiva: el terreno se compone desde base + estampas + splines; quitar un spline y regenerar restaura la base.
- Los caminos/ríos/lagos exponen exclusiones (`NoVegetation`, `NoScatter`, `NoCollision`) sin tocar los sistemas de juego.

### 7.9 WorldDefinition y WorldDatabase

```ts
export interface WorldDefinition {
  schemaVersion: number;
  id: WorldId;
  name: string;
  seed: WorldSeedConfig;
  bounds: Bounds2;
  chunkSize: number;
  terrain: {
    baseAlgorithmVersion: number;
    stamps: TerrainStamp[];
    workZones: WorkZone[];
  };
  biomes: {
    definitions: BiomeDefinition[];
    masks: BiomeMask[];
    splines: BiomeSpline[];
  };
  splines: WorldSpline[];
  scatter: ScatterDefinition[];
  exclusions: {
    id: string;
    bounds?: Bounds2;
    splineId?: SplineId;
    tags: string[];
    enabled: boolean;
  }[];
  render: {
    theme: string;
    groundMaterial: MaterialId;
    fogColor: string;
    fogNear: number;
    fogFar: number;
  };
}

export interface WorldDatabaseFile {
  kind: 'souldolls-world-database';
  schemaVersion: number;
  worlds: WorldDefinition[];
  stampPresets: {
    id: string;
    category: StampCategory;
    resolution: number;
    values: number[];
  }[];
}

export interface WorldDatabase {
  load(raw: unknown): WorldDatabaseFile;
  validate(db: WorldDatabaseFile): ValidationResult;
  migrate(raw: unknown): WorldDatabaseFile;
  exportWorld(id: WorldId): string;
  importWorld(json: string): WorldDefinition;
}
```

Reglas:
- `schemaVersion` obligatorio en cada mundo y en el archivo.
- Validación de esquemas antes de usar datos.
- Migraciones secuenciales y deterministas.
- No se guardan resultados calculados ni objetos Three.js.
- La base analítica actual queda descrita por `baseAlgorithmVersion`; las estampas son datos.

### 7.10 Pipeline, caché e invalidación

```ts
export type WorldLayer =
  | 'terrainBase' | 'terrainStamps' | 'terrainSplines'
  | 'terrainSurface' | 'biomes' | 'scatterPrimary'
  | 'scatterDetails' | 'water' | 'collisions' | 'props' | 'minimap';

export interface WorldInvalidation {
  source: string;
  layers: WorldLayer[];
  region?: Bounds2;
  ids?: string[];
}

export interface WorldEventBus {
  emit(change: WorldInvalidation): void;
  subscribe(layer: WorldLayer, listener: (change: WorldInvalidation) => void): () => void;
}

export interface GenerationContext {
  definition: WorldDefinition;
  seed: WorldSeedService;
  events: WorldEventBus;
  sampler: TerrainSampler;
  workZone?: WorkZone;
  dirty?: Bounds2;
}

export interface GenerationPhase {
  id: WorldLayer;
  dependsOn: WorldLayer[];
  /** Devuelve true si el resultado de esta fase cambió. */
  run(ctx: GenerationContext): boolean;
  /** Caché opcional por región; debe ser determinista. */
  cacheKey?(ctx: GenerationContext, region: Bounds2): string;
}

export interface WorldGenerationPipeline {
  readonly phases: readonly GenerationPhase[];
  generate(ctx: GenerationContext): void;
  invalidate(change: WorldInvalidation): void;
}
```

Grafo de dependencias:

```text
terrainBase
  └→ terrainStamps
      └→ terrainSplines
          └→ terrainSurface
              ├→ biomes
              │   ├→ scatterPrimary
              │   │   └→ scatterDetails
              │   └→ minimap
              ├→ water
              ├→ collisions
              └→ props
```

Reglas:
- Invalidar una capa invalida todas sus dependientes.
- Si `region` existe, solo se recalculan celdas/chunks que intersectan.
- Un cambio de bioma **no** debe regenerar árboles fuera de la región ni cambiar sus semillas.
- El pipeline no conoce Three.js: `WorldView` consume `GeneratedWorld` y aplica los cambios.

### 7.11 Editor

```ts
export interface EditorCommand {
  id: string;
  label: string;
  /** Aplica el cambio sobre la definición de datos. */
  apply(definition: WorldDefinition): WorldDefinition;
  /** Revierte el cambio exacto. */
  revert(definition: WorldDefinition): WorldDefinition;
}
```

Contrato:
- Undo/redo opera sobre comandos y datos, nunca sobre capturas de escena.
- El editor modifica `WorldDefinition`, no mallas Three.js.
- Editor desactivado por defecto; cuando está apagado no altera HUD, controles ni rendimiento del jugador.
- Las herramientas de edición de terreno/bioma/scatter/spline comparten el mismo bus de invalidación.

---

## 8. Datos persistentes vs. calculados

| Dato | Persistente | Calculado | Three.js |
|---|---|---|---|
| `WorldDefinition` (seed, stamps, biomas, splines, scatter) | Sí | No | No |
| `WorkZone` | Sí | No | No |
| `TerrainStamp` | Sí | No | No |
| `TerrainData.heights` (`Float32Array`) | No (se regenera) | Sí | No |
| Normales, colores, pendientes | No | Sí | No |
| `BiomeSample` / pesos | No | Sí | No |
| `ScatterPlacement` | No | Sí | No |
| Matrices de instancias | No | Sí | Sí (GPU) |
| Materiales/texturas | No | — | Sí |
| `TrainingData`, `EditorState` temporal | No | — | No |

---

## 9. Determinismo

1. Semilla raíz en `WorldDefinition.seed.root`.
2. Cada consulta usa `derive(root, { system, chunkX, chunkZ, groupId, elementId, index })`.
3. `WorldSeedService` usa hash estable (p. ej. FNV-1a de 32 bits + mezcla) y `mulberry32` para el PRNG. **No** `Math.sin(seed)` ni `Math.random`.
4. El orden de composición de estampas es `(priority, id)`.
5. El orden de scatter dentro de un grupo se deriva del índice y del chunk, no del orden de iteración global.
6. Las cachés incluyen `algorithmVersion`; cambiarla regenera.

Aceptación:
- Dos cargas seguidas producen el mismo heightmap y las mismas posiciones de scatter.
- Añadir un grupo de scatter no cambia las posiciones de los grupos existentes.
- Cambiar una estampa solo altera la región afectada y sus dependencias.

---

## 10. Rendimiento

### 10.1 Estructuras

- `Float32Array` para alturas.
- `Uint8Array` para flags de superficie y máscaras cuando baste 0..255.
- `Uint8Array`/bitset para exclusiones por celda.
- `InstancedMesh` para grupos repetidos.
- Materiales y geometrías compartidos.
- `Map<string, ChunkRecord>` para chunks activos; cola de generación con presupuesto por frame.
- Web Workers solo para bake de estampas/máscaras/scatter si el perfilado lo justifica; transferencia de `ArrayBuffer` (sin copias).

### 10.2 Presupuestos objetivo (a medir en etapa 08)

| Métrica | Desktop | Móvil |
|---|---|---|
| Draw calls | ≤ 250 | ≤ 120 |
| Triángulos visibles | ≤ 150k | ≤ 60k |
| Chunks terreno activos | 49 (radio 3) | 25 (radio 2) |
| Altura de heightmap | 1 m/celda (evaluar 0.5 m) | igual |
| Memoria heightmap | ≤ 2 MB | ≤ 2 MB |
| Chunks nuevos por frame | 2 | 1 |
| Tiempo de generación por chunk | ≤ 4 ms | ≤ 8 ms |
| Detalles runtime | ≤ 8 000 instancias | ≤ 3 000 |
| Vegetación principal | ≤ 1 500 instancias | ≤ 500 |

Los números son objetivos de diseño, no mediciones. Se validan en la etapa 08.

### 10.3 Reducción del coste actual

- Cachear alturas: hoy cada vértice evalúa ~10–12 alturas y recorre el río. El sampler cacheado elimina la mayor parte.
- Calcular normales desde el heightmap cacheado.
- Indexar segmentos del río por rejilla espacial (evitar `O(120)` por consulta).
- Unificar scatter para reducir draw calls.
- Descargar árboles/detalles por chunk.

---

## 11. Compatibilidad e integración

### 11.1 Contrato público conservado

```ts
// worldGen.ts
export function getTerrainHeight(x: number, z: number): number;
```

Internamente:

```ts
let activeSampler: TerrainSampler | null = null;

export function getTerrainHeight(x: number, z: number): number {
  return activeSampler ? activeSampler.heightAt(x, z) : getProceduralTerrainHeight(x, z);
}
```

- `WorldManager` instala el sampler al construir el mundo.
- Sin `WorldDefinition`, se usa la base analítica actual (comportamiento idéntico).
- `PlayerController`, colisiones, NPCs, props y minimapa no cambian de firma.

### 11.2 Sistemas que no se tocan

Combate, movimiento, cámara, personajes, inventario, NPCs, quests, HUD. El único cambio permitido es la fuente de altura y la construcción del mundo.

### 11.3 Puntos de integración mínimos

| Archivo | Cambio permitido |
|---|---|
| `src/world/worldGen.ts` | Fachada; inyectar sampler y pipeline |
| `src/world/proceduralTerrain.ts` | Conservar como base; exponer parámetros |
| `src/world/chunkManager.ts` | Recibir `TerrainSampler` inyectado; invalidación por región |
| `src/game/engine.ts` | Solo construcción del mundo y consultas de altura/colisión |
| `src/world/playerController.ts` | Sin cambios (usa `getTerrainHeight`) |
| `src/data/regions.ts` | Adaptador temporal de biomas |

---

## 12. Plan de migración por etapas

### Etapa 03 — Terrain Stamps
- Crear `core/WorldSeed.ts`, `core/WorldEvents.ts`, `core/WorkZone.ts`, `terrain/TerrainData.ts`, `terrain/TerrainHeightmap.ts`, `terrain/TerrainStamp.ts`, `terrain/TerrainStampBlender.ts`.
- Instalar `TerrainSampler` en la fachada; `getTerrainHeight` delega.
- Migrar `ChunkManager` a sampler inyectado.
- Composición de ≥3 estampas visibles.
- Tests: determinismo, add/max/min/replace, rotación, escala, falloff, reset, conservación de la base, paridad sin estampas (`1e-6`).
- **Gate:** el juego se ve y se juega igual sin estampas; con estampas, el terreno es visible y las colisiones siguen la nueva altura.

### Etapa 04 — Biomas
- `biomes/*` con los 10 biomas actuales migrados.
- Adaptador `sampleBiomeAt` → `BiomeResolver`.
- Máscaras, prioridades, splines abiertos, materiales por máscara.
- Tests: prioridad, anidamiento, superposición, máscaras, exclusiones, determinismo, compatibilidad de encuentros.
- **Gate:** los biomas actuales se ven igual o mejor; ningún encuentro cambia de bioma fuera de la zona editada.

### Etapa 05 — Scatter
- `scatter/*`; migrar árboles, rocas, hierba, arbustos y detalles.
- Clustering, ruido, exclusiones, LOD y descarga.
- Runtime details independientes.
- Tests: densidad, filtros, exclusión, clustering, reproducibilidad, draw calls.
- **Gate:** la vegetación se ve natural y el rendimiento no empeora.

### Etapa 06 — Splines
- `splines/*`; migrar las 6 carreteras, el río y el lago.
- Anchura variable, proyección, carve no destructivo, máscaras.
- Tests: intersecciones, curvas, anchura, pendientes, regeneración, restauración.
- **Gate:** caminos/río/lago se integran con el terreno y se pueden quitar sin dejar artefactos.

### Etapa 07 — Editor
- `editor/*`; WorkZone visual, herramientas, inspector, undo/redo.
- UI de desarrollo compacta y desactivable.
- **Gate:** con el editor apagado, el juego es idéntico al de la etapa 06.

### Etapa 08 — Producción
- `WorldDatabase` versionada, export/import, migraciones.
- Chunks por mapa, LOD, presupuesto móvil.
- QA: `lint`, `build`, tests, mediciones.
- Documentación final y contexto para agentes.

---

## 13. Estrategia de pruebas

Unidad (Vitest, a añadir en preparación):
- Semillas: mismo input → mismo output; ámbitos distintos → distintas.
- Stamps: composición, orden, falloff, rotación, escala, reset, no mutación cruzada.
- Heightmap: bilineal, bounds, normales, celdas fuera de rango.
- Biomas: prioridad, pesos, máscaras, splines, exclusiones.
- Scatter: filtros, distancia mínima, clustering, determinismo.
- Splines: muestreo, distancia, bounds.
- Serialización: round-trip JSON, validación, migraciones.

Integración:
- Paridad sin estampas contra el motor actual.
- Regeneración por región y dependencias.
- Altura del jugador, colisiones, agua y props alineados.
- Cambiar un bioma no altera árboles no relacionados.

Rendimiento:
- Smoke de draw calls/triángulos/memoria/tiempos con umbrales de la sección 10.

Runtime:
- `src/core/tests.ts` se mantiene; no sustituye a Vitest.

---

## 14. Riesgos abiertos y decisiones pendientes

1. **Ubicación del motor:** `src/world/` (recomendado) vs. `src/engine/world/`.
2. **Mapas:** mundo continuo con `WorldDefinition` por zona (recomendado) vs. mapas separados tipo brief.
3. **Resolución de la caché de offsets:** 2 m implementado; evaluar 1 m con medición visual.
4. **Repositorio Git:** no hay commits; se recomienda commit base antes de la etapa 03.
5. **Dependencias rotas:** reparar `node_modules` (sin degradar versiones) para lint/build/tests.
6. **Skill de arte:** `.opencode/skills/argentum-world-art/` no existe en este proyecto y no se toca Argentum Tales. Se propone crear una skill equivalente local en una etapa posterior, con aprobación.
7. **Alcance del editor:** herramienta de desarrollo embebida (recomendado).

---

## 15. Criterios de aceptación de la etapa 02

- [x] Arquitectura objetivo adaptada a los módulos reales.
- [x] Separación datos / cálculo / render / editor.
- [x] Contratos TypeScript de todos los sistemas.
- [x] Grafo de dependencias e invalidación.
- [x] Reglas de determinismo.
- [x] Presupuestos de rendimiento.
- [x] Plan de migración 03–08 con gates.
- [x] Riesgos y decisiones pendientes explícitos.
- [x] Aprobación del usuario para materializar los contratos en código.

Los contratos de `core/` y `terrain/` se materializaron en la etapa 03. Los contratos de `biomes/` se materializaron en la etapa 04. `scatter/`, `splines/` y `editor/` quedan para sus etapas.
