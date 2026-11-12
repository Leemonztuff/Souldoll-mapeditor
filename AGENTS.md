# AGENTS.md — SoulDolls / Procedural Map

## Proyecto

RPG 3D en React + TypeScript + Three.js con mundo procedural continuo, estética pixel-art, generación por chunks y soporte móvil. Este es el único proyecto autorizado para el World Engine.

**No tocar** `../Argentum-tales` ni ningún proyecto fuera de este directorio.

## Comandos

```bash
bun run dev       # servidor de desarrollo
bun run lint      # tsc --noEmit
bun run build     # build de producción
bun run preview   # preview del build
```

No existe script `test`. `src/core/tests.ts` es un runner de aserciones en runtime, no una suite automatizada.

### Estado de dependencias (reparado)

- `bun run lint`, `bun run build` y `bun run dev` funcionan en Windows x64.
- Se instalaron los binarios nativos que faltaban: `@typescript/typescript-win32-x64@7.0.2`, `@rolldown/binding-win32-x64-msvc@1.2.16`, `lightningcss-win32-x64-msvc@1.33.0` y `@tailwindcss/oxide-win32-x64-msvc@4.3.5`.
- `package-lock.json` fue regenerado para incluir las dependencias opcionales de todas las plataformas; `npm ci --dry-run` pasa y las versiones resueltas se mantuvieron.
- No se degradó ninguna versión de `package.json`.
- Bundling de verificación: `bun build src/world/worldGen.ts --target=browser` y `bun build src/game/engine.ts --target=browser`.
- **Problema conocido:** `public/assets/souldolls/17.webp` (ECHO `#007`) sigue a 0 bytes. Los assets `08.webp`–`12.webp` ya fueron restaurados por el usuario; el arranque con los starters `01/03/09` ya no queda bloqueado. No se modificó `17.webp` porque falta el arte original.

## Arquitectura actual

```text
src/App.tsx
└─ src/game/engine.ts            # Renderer, cámara, loop, colisiones
   ├─ src/world/worldGen.ts      # Fachada buildWorld / updateWorld / getTerrainHeight
   │  ├─ src/world/proceduralTerrain.ts  # Altura analítica, biomas, río, lago
   │  ├─ src/world/chunkManager.ts       # Chunks, formaciones, colisiones
   │  ├─ src/world/buildingGen.ts        # Aldea / edificios
   │  ├─ src/world/caveGen.ts            # Cuevas
   │  └─ src/world/manualLocations.ts    # POIs
   ├─ src/world/playerController.ts
   ├─ src/world/textures.ts      # Texturas canvas pixel-art
   └─ src/world/instancing.ts    # Billboard + instancing
```

World Engine en construcción:

```text
src/world/core/       WorldTypes, WorldSeed, WorldEvents, WorkZone
src/world/terrain/    TerrainData, TerrainHeightmap, TerrainStamp,
                      TerrainStampBlender, terrainStamps.data
src/world/biomes/     BiomeDefinition, BiomeDatabase, BiomeMask,
                      BiomeSpline, BiomePriorityResolver, BiomePainter,
                      BiomeGenerator, biomes.data
```

`worldGen` crea un `StampedTerrainSampler` activo y `getTerrainHeight` delega en él. `ChunkManager` recibe el sampler por inyección. La base analítica `getProceduralTerrainHeight` sigue siendo la fuente base. Los biomas se resuelven por base de datos, prioridad, máscaras y splines abiertos; `sampleBiomeAt` es el adaptador público.

Otros: `src/data/regions.ts`, `src/data/constants.ts`, `src/save/saveManager.ts`, `src/core/tests.ts`, `src/types.ts`.

## Invariantes del World Engine

1. `getTerrainHeight(x, z)` conserva firma; es el contrato público de altura.
2. `worldGen.buildWorld` se conserva como fachada durante la migración.
3. La base analítica existente no se reescribe; se conserva como altura base.
4. Datos persistibles = JSON plano; nunca `THREE.*`, funciones ni clases.
5. Una sola fuente de verdad de altura para terreno, jugador, colisiones, agua, props y NPCs.
6. Generación determinista por semillas derivadas; el mundo lógico no usa `Math.random`.
7. Invalidación por capa y región; no regenerar el mundo entero por una edición.
8. Reutilizar texturas, materiales, instancing, edificios, cuevas y POIs existentes.
9. No añadir motores 3D ni dependencias sin aprobación.
10. No modificar combate, movimiento, cámara, personajes, inventario, NPCs, quests ni HUD.
11. No dejar TODO, mocks, stubs ni botones decorativos.
12. Documentar cada etapa y esperar autorización antes de la siguiente.

## Documentación del World Engine

- `docs/world-engine/01-current-engine-audit.md` — auditoría del motor real (etapa 01, completada).
- `docs/world-engine/02-world-engine-architecture.md` — arquitectura, contratos, dependencias, rendimiento y plan 03–08 (etapa 02, aprobada).
- `docs/world-engine/03-terrain-stamps.md` — implementación de estampas, caché, integración y verificación (etapa 03, aprobada).
- `docs/world-engine/04-biomes.md` — base de datos, prioridades, máscaras, splines abiertos, painter e integración (etapa 04, aprobada).
- `docs/world-engine/05-terrain-sampler-validation.md` — validación de la caché de offsets en StampedTerrainSampler (aprobada).
- `docs/world-engine/07-map-editor-ui.md` — interfaz visual del editor, paneles contextuales, gizmos 3D y regeneración (etapa 07, completada y validada).
- `docs/world-engine/08-world-editor-workzone.md` — integración completa de herramientas, WorkZone, historial Undo/Redo y WorldDatabase (etapa 08, completada y validada).

La estructura objetivo vive en `src/world/core|terrain|biomes|scatter|splines|editor`. Todos los directorios y módulos base ya han sido creados y están totalmente integrados.

## Estado de etapas

| Etapa | Estado | Notas |
|---|---|---|
| 01 Auditoría | Completada | Auditoría del motor original. |
| 02 Arquitectura | Completada | Diseño modular aprobado. |
| 03 Terrain Stamps | **COMPLETADA Y VALIDADA** | 24/24 pruebas PASS. Caché ~1.1 MB. |
| 04 Biomas | **COMPLETADA Y VALIDADA** | 24/24 pruebas PASS. Resolver y Painter integrados. |
| 05 Scatter | **COMPLETADA Y VALIDADA** | Auditada. Integrado en `ChunkManager` y `worldGen.ts`. |
| 06 Splines | **COMPLETADA Y VALIDADA** | Auditada. Caminos y ríos funcionales y deterministas. |
| 07 Editor | **COMPLETADA Y VALIDADA** | UI visual integrada, retícula 3D, gizmos, 5 paneles, comandos y regeneración. |
| 08 Producción | **COMPLETADA Y VALIDADA** | Integración total con WorldDatabase, WorkZones y Undo/Redo. |

## Decisiones pendientes

- Optimización de `TerrainStampBlender.ts` (caché exclusiva de offsets) VALIDADA (ver `05-terrain-sampler-validation.md`).
- UI del Editor (Etapa 07 & P8) COMPLETADA Y VALIDADA (ver `07-map-editor-ui.md`, `08-world-editor-workzone.md`).
- Confirmar posiciones finales de las estampas demo del este.
- Restaurar `17.webp` antes de lanzamiento final.

## Instrucciones para el siguiente agente

- Leer `docs/world-engine/01-current-engine-audit.md`, `02-world-engine-architecture.md`, `03-terrain-stamps.md`, `04-biomes.md` y `04-integration-audit.md` antes de tocar código.
- No declarar etapas como finalizadas sin pasar la suite de pruebas `src/core/tests.ts`.
- Al implementar, preservar el juego jugable en cada paso y reportar archivos creados/modificados, funcionalidad, lint/build/tests y pendientes.
