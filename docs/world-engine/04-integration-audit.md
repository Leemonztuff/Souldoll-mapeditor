# Informe de Auditoría de Integración — World Engine (Etapas 03 y 04)

**Proyecto:** SoulDolls — Crónicas de Luminati
**Fecha:** 2026-11-11
**Estado Global:** Etapas 03 y 04 completadas e integradas funcionalmente. Se detectan implementaciones adelantadas de las etapas 05 y 06.

---

## 1. Verificación de Archivos

Se ha verificado la existencia de todos los módulos declarados en la arquitectura `02-world-engine-architecture.md` para las etapas 03 y 04.

### Estado de Módulos
- **Etapa 03 (Terrain Stamps):** 100% de los archivos existen y están conectados.
- **Etapa 04 (Biomas):** 100% de los archivos existen y están conectados.
- **Etapa 05/06/07 (Scatter/Splines/Editor):** Los archivos existen y algunos están integrados en `worldGen.ts` y `proceduralTerrain.ts`, a pesar de que `AGENTS.md` los lista como "No iniciada".

### Discrepancias de Arquitectura
- `TerrainGenerator.ts`, `TerrainSurface.ts` y `TerrainMaterial.ts` (mencionados en el diseño 02) no existen como archivos independientes. Sus funciones han sido absorbidas por `TerrainStampBlender.ts` y `BiomePainter.ts`.
- La tubería modular `WorldGenerationPipeline` tiene sus fases (`run`) como **stubs (return true)**. La integración actual es manual en `worldGen.ts` en lugar de orquestada por el pipeline.

---

## 2. Integración del Terreno (Etapa 03)

### Verificación de Puntos Críticos
- [x] **Fuente Pública:** `getTerrainHeight(x, z)` en `worldGen.ts` es la única fuente de altura y delega correctamente en `activeTerrainSampler`.
- [x] **Instalación del Sampler:** `StampedTerrainSampler` se instancia en `buildWorld` con las estampas de SoulDolls.
- [x] **Uso en Chunks:** `ChunkManager` recibe e utiliza el sampler para generar la geometría y calcular normales.
- [x] **Consistencia de Altura:** El jugador (`PlayerController`), las colisiones y el scatter consultan la misma altura a través de la fachada.
- [x] **Paridad Analítica:** Se ha verificado que sin estampas, el sampler devuelve exactamente la altura de la base analítica.

### Problema Detectado (Rendimiento)
En `TerrainStampBlender.ts`, la función `heightAt(x, z)` llama a `this.baseFn(x, z)` (la pesada base analítica) en **cada consulta**, incluso si el resultado del offset está cacheado. Esto anula gran parte del beneficio de rendimiento esperado para la base analítica (aunque sí ahorra el coste de las estampas).

---

## 3. Integración de Biomas (Etapa 04)

### Verificación de Puntos Críticos
- [x] **Migración:** Los 10 biomas originales están definidos en `biomes.data.ts`.
- [x] **Adaptador:** `sampleBiomeAt` en `proceduralTerrain.ts` delega completamente en `BiomeGenerator`.
- [x] **Pintado:** `getTerrainVertexColor` utiliza `BiomePainter` para la visualización.
- [x] **Encuentros:** `getEncounterTypesForPosition` en `regions.ts` utiliza el nuevo sistema y mantiene la compatibilidad de los pools.
- [x] **Prioridades:** El sistema de resolución por pesos y prioridades es funcional y estable.

### Observaciones
No existen dos sistemas de clasificación funcionando en paralelo; la transición ha sido completa y limpia.

---

## 4. Rendimiento

### Mediciones y Hallazgos
- **Memoria de Caché:** 256 baldosas a 2m de resolución ocupan **~1.1 MB** (dentro del presupuesto de 2 MB).
- **Coste de Evaluación:** Debido a que `heightAt` sigue evaluando la base analítica en cada llamada, consultas pesadas (como la distancia al río, que itera 120 puntos) se ejecutan repetidamente.
- **Generación de Chunks:** El presupuesto móvil de 1 chunk por frame se respeta en `ChunkManager`.
- **Regeneración Regional:** El mecanismo de invalidación existe en el código pero no se activa por falta de disparadores en el juego (está reservado para el editor).

---

## 5. Pruebas

Se ejecutó la suite completa en `src/core/tests.ts`.

### Resultados (24/24 PASS)
- **Terreno:** Paridad analítica, determinismo de estampas y desplazamientos locales confirmados.
- **Biomas:** Presencia de los 10 biomas, resolución de prioridades, máscaras (add/subtract/override) y splines abiertos confirmados.
- **Core:** Semillas derivadas, WorkZones y Pipeline (estructura) confirmados.
- **Juego:** Simulación de combates y consistencia de guardado confirmados.

---

## 6. Resumen de Hallazgos

### Problemas Críticos
- **Ninguno.** El juego es estable y las etapas 03 y 04 cumplen su función.

### Problemas Menores
- **Caché de altura incompleta:** `TerrainStampBlender` debería cachear la altura total o el resultado de `baseFn` para evitar recalculados analíticos en cada frame.
- **Inconsistencia documental:** `AGENTS.md` está desactualizado respecto al estado de Scatter y Splines.

### Deuda Técnica
- Las fases del `WorldGenerationPipeline` son stubs. La lógica de generación está dispersa entre `worldGen.ts` y los generadores individuales.

---

## 7. Recomendaciones (Prioridad Alta a Baja)

1. **Optimizar Sampler:** Modificar `TerrainStampBlender` para que las baldosas de caché almacenen la altura total (base + offset) o cachear el resultado de `baseFn` por separado.
2. **Actualizar Pipeline:** Implementar la lógica real en los métodos `run` de `WorldGenerationPipeline` para que `WorldManager` sea el único orquestador.
3. **Sincronizar Documentación:** Actualizar `AGENTS.md` para marcar Scatter y Splines como "En proceso" o "Integración inicial completa".
4. **Optimizar Río:** El cálculo de distancia al río en `proceduralTerrain.ts` debería usar una estructura espacial (rejilla) para evitar el bucle `O(120)`.

---
**Resultado de Auditoría: APROBADA con observaciones menores de rendimiento.**
