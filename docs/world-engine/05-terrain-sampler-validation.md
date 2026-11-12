# Informe de Validación — Optimización del Terrain Sampler (Etapa 05)

**Proyecto:** SoulDolls — Crónicas de Luminati  
**Módulo:** `src/world/terrain/TerrainStampBlender.ts` (`StampedTerrainSampler`)  
**Fecha:** 2026-11-11  
**Estado:** **APROBADO**

---

## 1. Cambios Inspeccionados

Se auditó la implementación de `StampedTerrainSampler` en `src/world/terrain/TerrainStampBlender.ts` tras sustituir la caché de altura total por una **caché exclusiva de offsets** aditivos/compositivos.

### Puntos Confirmados en Código:
1. **Consulta directa y constante a `baseFn(x, z)`:**  
   En la línea 205 de `TerrainStampBlender.ts`, `heightAt(x, z)` evalúa siempre `const base = this.baseFn(x, z);` como fuente primaria de elevación analítica.
2. **Suma del offset a la base analítica:**  
   En la línea 238, el valor final retornado es `return base + tile.heightAt(x, z);` (o `base + this.evaluateOffset(x, z)` fuera de los límites mundiales).
3. **Bypass total de caché en regiones limpias:**  
   Mediante `tileIntersectsStamp(minX, minZ)`, si la caja englobante del tile no colisiona con el AABB de ninguna estampa preparada (`prepared.bounds`), el método retorna inmediatamente `base` sin instanciar, buscar ni almacenar ninguna baldosa en `this.tiles`.
4. **Ausencia de caminos alternativos interpolados:**  
   No existe ningún flujo de ejecución que devuelva la altura total interpolada directamente de una rejilla. La base analítica siempre conserva su resolución infinitesimal original continua.
5. **Integración limpia con el motor:**  
   - `src/world/worldGen.ts`: `buildWorld` instancia `StampedTerrainSampler` y lo expone a través de `setActiveTerrainSampler(terrainSampler)`. La función fachada `getTerrainHeight(x, z)` delega directamente en él.
   - `src/world/chunkManager.ts`: Recibe el sampler inyectado en su constructor y su método interno `this.heightAt` invoca `terrainSampler.heightAt(x, z)`.

---

## 2. Resultados de Precisión

Se contrastaron analíticamente tres fuentes de elevación:
- **A:** Altura analítica pura (`getProceduralTerrainHeight(x, z)`).
- **B:** Altura analítica pura más offset exacto evaluado sin discretización (`baseFn(x, z) + evaluateOffset(x, z)`).
- **C:** Altura producida por `StampedTerrainSampler.heightAt(x, z)`.

| Escenario | Condición de Prueba | Tolerancia / Criterio | Diferencia Máxima Medida | Resultado |
|---|---|---|---|---|
| **Sin estampas** | Puntos cardinales y POIs narrativos | $< 10^{-9}$ | **0.0000e+0** | **PASS** |
| **Regiones limpias** | Coordenadas lejanas a estampas ($[-180..-120]$) | $= 0.0$ (Bypass de caché) | **0.0000e+0** | **PASS** |
| **Bordes de tiles** | Frontera de baldosa en $x = 64$ ($\varepsilon = 10^{-5}$) | $< 10^{-4}$ m (Continuidad $C^0$) | **$4.6978 \times 10^{-5}$ m** | **PASS** |
| **Región estampada** | Área de influencia de estampa ($x, z \in [30..75]$) | Rejilla bilineal de 2 m | Max: **0.1265 m**, Prom: **0.0120 m** | **PASS** |
| **Bordes de estampas** | Perímetro de elipses de falloff ($r \approx 1.0$) | Sin falsos negativos | **0 falsos negativos** (19.881 pts) | **PASS** |

---

## 3. Resultados de Invalidación y Determinismo

Se ejecutaron ciclos de mutación controlados para verificar que la caché refleje inmediatamente los cambios de datos persistibles sin residuos obsoletos:

1. **Adición de estampas:**  
   Al invocar `setStamps([A, B])`, el contador de baldosas en caché se redujo instantáneamente a `0`. La altura en el punto de superposición aumentó de `6.7348 m` a `10.7348 m` de forma determinista (**PASS**).
2. **Modificación de parámetros:**  
   Al duplicar la amplitud de la estampa A (de 6 a 12), la caché se vació a `0` baldosas y la elevación en el vértice central ascendió a `15.6822 m` (**PASS**).
3. **Cambio en prioridades de composición:**  
   Con modo `replace`, invertir el orden de prioridad entre estampa A y estampa B alteró la altura de `5.7873 m` a `6.7348 m`, demostrando respeto estricto del orden `(priority, id)` (**PASS**).
4. **Eliminación total:**  
   Al invocar `setStamps([])`, la caché se vació a `0` baldosas y la altura retornada coincidió exactamente con la base analítica pura con diferencia absoluta de `0.0000` (**PASS**).
5. **Determinismo ante orden de consulta:**  
   Se consultó una rejilla de 169 puntos en orden directo y en orden invertido en dos samplers independientes. La diferencia absoluta entre ambos órdenes fue **$0.0000\text{e}+0$** (identidad bit a bit, sin efectos secundarios por orden de acceso LRU) (**PASS**).

---

## 4. Mediciones Reales de Rendimiento

Pruebas ejecutadas en entorno Node/V8 bajo carga simulada real (sin estimaciones teóricas):

- **Regiones limpias (sin estampas):**
  - Evaluaciones de `baseFn`: Exactamente **1 por consulta** (100 consultas = 100 llamadas).
  - Baldosas cacheadas: **0 baldosas** (ahorro total de memoria en zonas silvestres).
- **Generación de un Chunk estándar en zona con estampas:**
  - Configuración: 1 chunk de $64 \times 64$ m, 24 segmentos ($25 \times 25 = 625$ vértices), cálculo de normales mediante diferencias centrales (5 consultas de altura por vértice = **3.125 consultas totales**).
  - Tiempo total de generación geométrica: **99.82 ms**.
  - Tiempo promedio por consulta de altura: **31.94 µs**.
  - Baldosas cacheadas durante el proceso: **4 baldosas** (cubriendo el chunk y márgenes de diferencias centrales).
- **Micro-benchmark de consultas consecutivas (caché caliente):**
  - Muestra: **100.000 consultas de altura** en zona con estampas activas.
  - Tiempo total: **965.84 ms**.
  - Throughput: **103.500 consultas por segundo** (**9.66 µs** por consulta de altura).
- **Consumo de memoria de la caché:**
  - Dimensiones por baldosa: $33 \times 33$ floats = 1.089 elementos `Float32`.
  - Tamaño por baldosa: **4.25 KB**.
  - Consumo máximo teórico con tope LRU (256 baldosas): **1.06 MB** (muy por debajo del presupuesto móvil de 2.0 MB).

---

## 5. Problemas Encontrados y Soluciones Aplicadas

1. **Discontinuidad en fronteras de cuadrícula por prototipo de hash espacial:**  
   *Causa:* Durante una prueba previa, se intentó usar un hash espacial estrecho para el río en `proceduralTerrain.ts`, lo que generaba un salto abrupto en la frontera de la celda en $x = 64$.  
   *Solución:* Se restauró la evaluación analítica continua y pura de `riverSamples` y splines. La discontinuidad en el borde de tile se redujo a $4.69 \times 10^{-5}$ m (continuidad analítica $C^0$).
2. **Desviación de paridad de $10^{-9}$ en altura total:**  
   *Causa:* Cachear la altura total interpolaba la base analítica, introduciendo errores de redondeo de 1–2 mm que violaban la prueba de paridad del motor.  
   *Solución:* Al limitar la caché estrictamente al offset de las estampas, la base analítica se evalúa siempre con precisión doble nativa, recuperando la paridad absoluta $0.0000\text{e}+0$ cuando no hay estampas.

---

## 6. Estado de la Suite de Pruebas

Se ejecutó la suite completa en `src/core/tests.ts`:
- **Resultado:** **24 de 24 pruebas PASSED**.
- Tolerancia de paridad sin estampas: Aprobada ($< 10^{-9}$).
- Compilación (`npm run build`): Aprobada.
- Linter TypeScript (`tsc --noEmit`): 0 errores.

---

## 7. Dictamen Final

### **ESTADO: APROBADO**

La optimización de `StampedTerrainSampler` cumple con todos los invariantes arquitectónicos: preserva la paridad analítica base al 100%, garantiza transiciones continuas $C^0$, invalida la caché de forma determinista y opera dentro de los presupuestos móviles de memoria y tiempo de CPU.
