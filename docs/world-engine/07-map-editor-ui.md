# 07 — UI del Editor de Mapas (implementación)

**Proyecto:** `procedural-map-souldolls-rpgv1`  
**Estado:** implementada y validada. **Pendiente de revisión/aprobación del usuario.**  
**Base:** `02-world-engine-architecture.md`, `03-terrain-stamps.md`, `04-biomes.md`, `05-scatter-splines-audit.md`

---

## 1. Objetivo de la etapa

Implementar una interfaz de usuario visual, ergonómica y totalmente conectada al motor real para el World Engine de SoulDolls / Luminati. El editor permite inspeccionar, modificar y regenerar en caliente el terreno, biomas, scatter, splines y zonas de trabajo (WorkZones) sin salir del juego ni romper la jugabilidad original.

---

## 2. Principios de diseño e integración

1. **Desactivado por defecto:** El editor arranca cerrado (`isEditorOpen: false`) sin interferir con el HUD del juego ni con el rendimiento.
2. **Acceso rápido diegético:** Se abre y cierra mediante tecla `F2`, tecla Backquote / Tilde (`` ` `` / `~`), botón diegético `🛠️ EDITOR` en la barra superior del HUD, o desde el Menú Central de Acciones.
3. **Aislamiento de control:** Mientras el editor está abierto, los inputs de movimiento del jugador, ataques e interacciones se suspenden. Todo clic o arrastre dentro de la UI utiliza `stopPropagation` para no emitir eventos al mundo 3D.
4. **Proyección en 3D en tiempo real:** Raycasting exacto entre el puntero del ratón y la superficie poligonal de los chunks de terreno, con lectura continua de coordenadas mundiales `(X, Y, Z)`.
5. **Gizmos Three.js no intrusivos:**
   - **Retícula del cursor:** Anillo resplandeciente dorado sobre la superficie del suelo en la coordenada del cursor 3D.
   - **Huella de estampa:** Elipse 3D con indicador de orientación, radio exterior y radio de transición interior para la estampa seleccionada.
   - **Caja de WorkZone:** Líneas de contorno 3D ambarinas que demarcan los límites exactos de la zona de trabajo activa.
6. **Regeneración regional real:** Los cambios de terreno o biomas ejecutan `chunkManager.invalidateRegion(bounds)`, descargando y reconstruyendo de inmediato la geometría y colisiones de los chunks afectados.

---

## 3. Distribución de la interfaz

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✦ WORLD ENGINE — EDITOR v0.7 | Mundo: default | Cursor 3D: X: 14.2 Y: 3.1 Z: -8.4 | [Cerrar F2] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                        ┌───────────────────┐│
│                                                        │ [🏔️][🌿][🌲][〰️][📐] ││
│                                                        ├───────────────────┤│
│                         VISTA 3D                       │ Panel Contextual: ││
│                  (Mundo Three.js en vivo)              │ - Terreno         ││
│                 + Gizmo Retícula 3D                    │ - Biomas          ││
│                 + Huella de Estampa                    │ - Scatter         ││
│                 + Contorno WorkZone                    │ - Splines         ││
│                                                        │ - WorkZone        ││
│                                                        │                   ││
│                                                        │ [✓ Aplicar / Reg] ││
│                                                        └───────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│ [↶ Deshacer] [↷ Rehacer] | ✦ Estado: Estampa 'hill_crest' aplicada | [💾 Exportar JSON] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Archivos creados

```text
src/components/editor/
├── EditorTopBar.tsx           # Título, nombre del mundo, semilla, coordenadas (X, Y, Z), estado y botón de cierre
├── EditorToolBar.tsx          # Pestañas de herramientas (Terreno, Biomas, Scatter, Splines, WorkZone) con contadores
├── TerrainEditorPanel.tsx     # Selector de estampas, presets de elevación, posición, amplitud, rotación, mezcla y regeneración
├── BiomesEditorPanel.tsx      # Detección de bioma en cursor, tabla de prioridades, toggles y pintor de máscaras
├── ScatterEditorPanel.tsx     # Control de densidad y visibilidad por grupos (árboles, arbustos, rocas, etc.)
├── SplinesEditorPanel.tsx     # Selector de caminos y ríos, visualización y adición de puntos de control en el cursor 3D
├── WorkZoneEditorPanel.tsx    # Definición de límites regionales, alineación a chunks (64m) y regeneración por zona
├── EditorBottomBar.tsx        # Deshacer/Rehacer (Ctrl+Z / Ctrl+Y), log de estado, indicador de cambios y exportación JSON
└── MapEditorModal.tsx         # Contenedor principal integrado con Three.js, GameEngine y WorldEditor

src/world/editor/
├── EditorGizmoManager.ts      # Visualizadores 3D en Three.js (retícula del cursor, huella de estampa y marco de WorkZone)
└── WorkZoneTools.ts           # Comandos de creación y borrado de WorkZones para el historial de comandos del editor
```

---

## 5. Archivos modificados

| Archivo | Modificación |
|---|---|
| `src/world/chunkManager.ts` | Añadidos `getTerrainMeshes()` e `invalidateRegion(region?: Bounds2)` para reconstrucción selectiva e inmediata de mallas y colisionadores. |
| `src/world/biomes/BiomePriorityResolver.ts` | Añadidos `setMasks(masks)` y `getMasks()` para inyección y actualización reactiva de máscaras. |
| `src/world/biomes/BiomeGenerator.ts` | Delegación pública de `setMasks` y `getMasks` al resolver. |
| `src/world/editor/WorldEditor.ts` | Ampliada la unión `EditorTool` para incluir `'workzone'`. |
| `src/world/editor/index.ts` | Exportados `createWorkZoneCommand` y `removeWorkZoneCommand`. |
| `src/game/engine.ts` | Añadidos `isEditorActive()`, `setEditorActive(active)`, `getChunkManager()`, `getScene()`, `getCamera()`, `getPlayerPosition()`, `getGroundIntersection(clientX, clientY)`, y bloqueo de movimiento/ataques durante edición. |
| `src/components/GameHUD.tsx` | Añadido botón diegético de apertura de editor, acceso en menú central y soporte de atajo `F2`/`~`. |
| `src/App.tsx` | Estado `showMapEditor`, escucha global de teclado y montaje del componente `MapEditorModal`. |
| `AGENTS.md` | Actualizado estado de Etapa 07 como COMPLETADA Y VALIDADA. |

---

## 6. Verificación y Resultados

- **Linter (`tsc --noEmit`):** PASS (0 errores).
- **Compilación de producción (`npm run build`):** PASS (compilado en 1.02s).
- **Suite de pruebas (`src/core/tests.ts`):** **24/24 PASS (0 fallos)**.
- **Rendimiento:** Cero interferencia cuando está cerrado; el editor no genera recolección de basura continua y actualiza la retícula de forma reactiva en base a eventos de puntero.
