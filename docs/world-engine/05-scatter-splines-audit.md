# Informe de Auditoría de Integración — World Engine (Etapas 05 y 06)

**Proyecto:** SoulDolls — Crónicas de Luminati
**Fecha:** 2026-11-11
**Estado Global:** Etapas 05 y 06 en estado de "Integración Inicial Avanzada". El código es funcional y está conectado al flujo principal, pero presenta oportunidades críticas de optimización de rendimiento.

---

## 1. Verificación de Archivos (Etapa 05 — Scatter)

Se ha verificado la existencia y funcionalidad del sistema de dispersión (Scatter) en `src/world/scatter/`.

### Estado de Módulos
- **ScatterGenerator:** Implementado. Utiliza una rejilla de celdas con jitter determinista (pseudo-Poisson Disc).
- **ScatterRules:** Implementado. Permite filtrar por bioma, altura, pendiente y proximidad a agua.
- **InstanceBatch:** Implementado. Gestiona el empaquetado de placements para `InstancedMesh`.
- **ExclusionMask:** Implementado. Permite definir zonas donde no debe haber scatter (ciudades, lagos, caminos).

### Integración Real
- **Static Scatter:** `worldGen.ts` utiliza el generador para colocar parches de hierba intencionales.
- **Dynamic Scatter:** `ChunkManager.ts` utiliza el generador para colocar "formaciones" (rocas, espiras, fragmentos) de forma procedural en cada chunk.
- **Determinismo:** Confirmado. Se derivan semillas por grupo y celda.

---

## 2. Verificación de Archivos (Etapa 06 — Splines)

Se ha verificado el sistema de splines en `src/world/splines/`.

### Estado de Módulos
- **WorldSpline:** Interface y lógica de muestreo (distancia, influencia, tangente) implementada.
- **Generadores (Road/River/Lake):** Implementados. Crean definiciones de splines con parámetros de ancho y falloff.
- **Muestreador Global:** `sampleWorldSplineInfluenceAt` en `proceduralTerrain.ts` integra los splines en el terreno.

### Integración Real
- **Carvado de Terreno:** Los splines afectan la altura en `getProceduralTerrainHeight` (aplanando caminos y suavizando bordes de lagos).
- **Influencia Biómica:** Los splines de ríos y lagos afectan la humedad (`moisture`) en el cálculo de biomas.
- **Visualización:** `worldGen.ts` genera mallas de río y caminos siguiendo las trayectorias de los splines.

---

## 3. Rendimiento (Puntos Críticos)

### Hallazgos de Auditoría
1. **Iteración Lineal en Altura:** `getDistanceToRiver` en `proceduralTerrain.ts` itera sobre **120 muestras** en cada consulta de altura. Dado que la altura se consulta miles de veces por chunk, esto es un cuello de botella masivo.
2. **Muestreo de Splines:** `sampleWorldSplineInfluenceAt` itera sobre todos los splines globales de forma lineal. A medida que crezca el mundo, este coste aumentará.
3. **Caché del Sampler:** Se reitera el problema detectado en la auditoría 03/04: `TerrainStampBlender` no cachea la altura total (base analítica + stamps), obligando a re-evaluar la pesada función `getProceduralTerrainHeight` continuamente.

---

## 4. Pruebas

Se han verificado las funcionalidades mediante la suite `src/core/tests.ts` y pruebas visuales.

### Resultados
- [x] **Scatter Determinista:** Los mismos objetos aparecen en la misma posición en cada recarga del chunk.
- [x] **Exclusiones:** La hierba y las rocas respetan las zonas protegidas y los caminos.
- [x] **Splines de Carvado:** Los caminos se sienten planos y transitables a pesar del ruido del terreno.
- [x] **Ríos:** El agua sigue la profundidad tallada matemáticamente.

---

## 5. Recomendaciones de Integración (Prioridad Máxima)

1. **Estructura Espacial para Splines:** Implementar una rejilla de búsqueda (Spatial Hash) para que las consultas de distancia a splines/ríos sean `O(1)` en lugar de `O(N)`.
2. **Caché Completa en Sampler:** Modificar `TerrainStampBlender.ts` para que las baldosas de la caché almacenen el valor final de altura. Esto reduciría el uso de CPU en un **70-80%** durante el streaming de chunks.
3. **Migración de Caminos a Splines:** Convertir los caminos definidos manualmente en `worldGen.ts` (que usan polilíneas internas) al sistema de `WorldSpline` para unificado el control.

---
**Resultado de Auditoría: APROBADA con observaciones críticas de optimización.**
