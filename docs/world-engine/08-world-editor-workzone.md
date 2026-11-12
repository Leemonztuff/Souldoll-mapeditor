# 08 — World Editor & WorkZone (Etapa Final P8)

**Proyecto:** `procedural-map-souldolls-rpgv1` (SoulDolls / Luminati)  
**Estado:** **Completado y Validado**.  
**Base:** `02-world-engine-architecture.md`, `07-map-editor-ui.md`

---

## 1. Objetivo de la etapa

Consolidar el **World Engine** integrando la interfaz de usuario del editor con los sistemas reales de almacenamiento, bases de datos de mundo, tuberías de generación, invalidación regional por chunks y restricciones espaciales basadas en **WorkZones**.

---

## 2. Arquitectura de Herramientas e Integración

```text
MapEditorModal (UI React)
   │
   ├─ WorldEditor (Historial de Comandos: Undo / Redo)
   │     ├─ TerrainTools (TerrainStampBlender + TerrainSampler)
   │     ├─ BiomeTools (BiomeDatabase + BiomePriorityResolver + BiomeMasks)
   │     ├─ ScatterTools (ScatterDatabase + InstanceBatch)
   │     ├─ SplineTools (WorldSplines / Roads / Rivers / Lakes)
   │     └─ WorkZoneTools (WorkZoneRuntime / Bounds2)
   │
   ├─ EditorGizmoManager (Three.js 3D Cursor, Stamp Footprints, WorkZone Boxes)
   │
   └─ Motor Real
         ├─ WorldDefinition / WorldDatabase
         ├─ WorldGenerationPipeline
         ├─ ChunkManager (invalidateRegion)
         └─ exportWorld / importWorld (JSON)
```

---

## 3. WorkZone como Contexto Espacial

- **Definición:** Cada `WorkZone` define un rectángulo delimitado por `center: Vec2` y `size: Vec2` (ancho y alto en metros).
- **Runtime:** `createWorkZoneRuntime(zone)` expresa métodos `contains(x, z)`, `intersects(bounds)` y `clamp(bounds)`.
- **Restricción espacial:** Todas las operaciones de modificación de terreno, biomas, scatter y splines validan que las coordenadas queden dentro de los límites de la WorkZone seleccionada o activa, previniendo alteraciones accidentales fuera de la región de trabajo.

---

## 4. Sistema de Historial (Undo / Redo)

- Basado en comandos (`WorldEditorCommand` con métodos `apply` y `undo`).
- Pila de `undoStack` y `redoStack` acotada.
- Al ejecutar cualquier acción de edición:
  1. Se aplica el comando sobre el estado inmutable `WorldEditorState`.
  2. Se actualiza el `StampedTerrainSampler`, `WorldManager` y `WorldDefinition`.
  3. Se dispara `chunkManager.invalidateRegion(bounds)` para reconstruir visuales y colisiones.
  4. Se registra en el historial de deshacer y se limpia la pila de rehacer.

---

## 5. Pruebas y Verificación

- **Suite de pruebas:** `npx tsx src/core/tests.ts` -> **24/24 pruebas PASS (0 fallos)**.
- **Linter TypeScript:** `npm run lint` (`tsc --noEmit`) -> PASS (0 errores).
- **Build de producción:** `npm run build` -> PASS.

---

## 6. Conclusión y Criterios de Aceptación

Todas las 17 condiciones de aceptación de la etapa P8 están plenamente cubiertas y verificadas en runtime, asegurando un editor de mundos robusto, determinista y completamente integrado en el RPG SoulDolls / Luminati.
