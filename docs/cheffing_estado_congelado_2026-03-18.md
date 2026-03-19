# Cheffing — Estado congelado

## Fecha de corte
18 de marzo de 2026

## Objetivo de este documento
Dejar una foto clara del estado actual del módulo Cheffing antes de entrar en los siguientes bloques grandes:
1. importación histórica de ventas de SumUp
2. sistema de importación de albaranes/facturas de proveedores con OCR
3. rediseño global de interfaz

---

## 1. Estado general
Cheffing ya está en un punto funcional y utilizable a nivel interno.

## Nota de handoff (hotfix de compatibilidad schema, 2026-03-18)

Se aplicó un ajuste pequeño en detalle de platos/elaboraciones para corregir drift entre código y schema real de producción:

- En cargas de catálogo (`cheffing_ingredients`) se dejó de depender de columnas legacy (`allergens`, `indicators`) y se normaliza desde `allergen_codes` / `indicator_codes` al shape de UI.
- En detalle de platos y elaboraciones se eliminaron embeds frágiles sobre vistas `v_cheffing_*_items_cost`; ahora se cargan filas simples y los nombres de ingrediente/elaboración se enriquecen en memoria con mapas locales.
- En updates de header (`PATCH /api/cheffing/dishes/[id]` y `PATCH /api/cheffing/subrecipes/[id]`) se restringió el payload al bloque base soportado por schema actual para evitar errores por columnas no existentes.
- **Actualización posterior (misma fecha):** el detalle de elaboraciones y platos vuelve a operar con contrato canónico en DB para metadata editable:
  - `allergen_codes`
  - `indicator_codes`
  - `image_path`
- El flujo manual add/exclude se mantiene solo como legado de compatibilidad y ya no es el camino principal de edición en UI/API de detalle.
- En platos, `cheffing_dishes.notes` ya es el campo canónico real para el campo UI “Notas”.
- Se retiró la compatibilidad temporal con `cheffing_dishes.description` en carga/guardado de detalle de platos.
- `cheffing_dishes.description` queda como campo legacy y su futuro se decidirá en un bloque posterior.

La base del sistema está operativa:
- productos
- elaboraciones
- platos
- costes
- menú engineering
- alérgenos
- indicadores
- navegación interna principal

No está “cerrado al 100%” como producto final, pero sí suficientemente estable como para usarlo como base de trabajo real y seguir construyendo encima.

---

## 2. Migración desde MyChefTool
### Estado
Completada funcionalmente.

### Qué quedó resuelto
- importación de productos
- importación de elaboraciones
- importación de platos
- importación de componentes de platos
- importación de componentes de elaboraciones
- tags de origen cargados
- trazabilidad con `source_system`, `source_uid`, `source_raw`
- deduplicación de productos
- deduplicación de elaboraciones
- mantenimiento de relaciones sin romper recetas ni escandallos

### Resultado
La migración principal puede considerarse cerrada a nivel técnico-operativo.

### Matiz importante
Siguen existiendo tablas de staging y tablas auxiliares/mapping como auditoría e histórico del proceso de migración.
No forman parte del flujo normal de la app, pero se conservan como respaldo y trazabilidad.

---

## 3. Corrección del bug de costes
### Problema original
Había un error sistémico en algunas líneas importadas desde MyChefTool:
- cantidades que conceptualmente eran `g` o `ml`
- estaban siendo tratadas como `kg` o `l`

Eso inflaba costes x1000 y destrozaba:
- coste por ración
- márgenes
- PVP objetivo
- Menu Engineering

### Qué se hizo
- snapshot / backup previo
- diagnóstico de ratios y outliers
- corrección masiva de `unit_code` en items importados
- validación posterior

### Resultado
El problema sistémico de costes quedó resuelto.

### Estado actual
Los costes ya no están rotos por ese bug estructural.
Si quedan casos raros, ya serían casos puntuales de datos o negocio, no un fallo masivo de importación.

---

## 4. Productos
### Estado
Funcionales y bastante estabilizados.

### Mejoras ya hechas
- visualización principal de coste en:
  - `€/kg`
  - `€/l`
  - `€/u`
- tooltip secundario con coste base interno:
  - `€/g`
  - `€/ml`
- apertura correcta de ficha de producto
- corrección del falso 404 al entrar en detalle
- guardado funcional de datos principales

### Observación
La presentación de productos ya es razonablemente útil para operativa, aunque todavía no forma parte del rediseño visual final.

---

## 5. Elaboraciones
### Estado
Funcionales y bastante estabilizadas.

### Mejoras ya hechas
- coste total mostrado con formato más legible
- coste unitario mostrado en:
  - `€/kg`
  - `€/l`
  - `€/u`
- tooltip con coste base interno
- detalle de elaboración usable

### Observación
Igual que en productos, está suficientemente bien para trabajo interno, aunque no es aún la versión final de diseño.

---

## 6. Platos
### Estado
Funcionales.

### Qué quedó resuelto
- carga y visualización correctas
- composición con ingredientes y elaboraciones
- merma en líneas de plato corregida respecto a `waste_pct` / `waste_pct_override`
- edición manual operativa
- vínculo entre Menu Engineering y plato ya planteado para navegación

### Merma
#### Regla actual
- la merma de línea funciona como **override/reemplazo**
- no como suma acumulativa

#### Restricción actual
- una línea no puede tener merma inferior a la merma base heredada del ingrediente o elaboración

---

## 7. Alérgenos e indicadores
### 7.1 Alérgenos
#### Estado
Modelo funcional correcto.

#### Regla
Los alérgenos son:
- compartidos
- heredables
- sumables por unión

Es decir:
si cualquier ingrediente o elaboración aporta un alérgeno, el plato lo hereda.

### 7.2 Indicadores
#### Problema detectado
No tenía sentido tratar todos los indicadores como heredables del mismo modo que los alérgenos.

Ejemplo:
- un limón puede ser compatible con `vegan`
- pero un plato con calamares + limón no debe heredar `vegan`

#### Modelo actual decidido e implementado
##### Indicadores de producto
Se consideran heredables:
- `contains_alcohol`
- `contains_pork`
- `spicy`
- `very_spicy`

Viven en:
- productos
- elaboraciones

Y pueden heredarse al plato.

##### Indicadores de plato
Se consideran manuales/editoriales:
- `vegan`
- `vegetarian`
- `halal`
- `kosher`

Viven en:
- platos

Y **no** se heredan automáticamente desde ingredientes o elaboraciones.

#### Semántica de `indicator_codes` (canónica)
- `cheffing_ingredients.indicator_codes` → catálogo de indicadores de producto.
- `cheffing_subrecipes.indicator_codes` → catálogo de indicadores de producto.
- `cheffing_dishes.indicator_codes` → catálogo de indicadores de plato final.

### 7.3 Catálogo compartido
Se centralizó el catálogo en código para evitar duplicidades y desajustes.

### 7.4 Bulk de alérgenos/indicadores
Se exploró y se dejó preparado conceptualmente, pero NO se ha ejecutado aún de forma masiva.
Se ha decidido posponerlo por ahora.

---

## 8. Menu Engineering
### Estado
Ya es una primera versión seria y alineada con el Excel de referencia.

---

## Actualización incremental (2026-03-19)

Se deja registrada una mejora pequeña-media enfocada a robustez en detalle de elaboraciones y UX transversal de listados:

- **Bugfix en ficha de elaboración (`/cheffing/elaboraciones/[id]`)**:
  - se eliminó la dependencia a la vista inexistente `v_cheffing_subrecipe_items_cost`;
  - se pasó a usar `cheffing_subrecipe_items` como fuente canónica de líneas;
  - el enriquecimiento de nombres (ingrediente/subelaboración) se resuelve en memoria;
  - `line_cost_total` puede quedar temporalmente degradado (`null`) y en UI se muestra `—` sin romper la ficha.
  - **hotfix de compatibilidad con schema real (2026-03-19):**
    - se mantiene operativa la **merma de cabecera** (`cheffing_subrecipes.waste_pct`);
    - la **imagen de elaboraciones** queda temporalmente fuera por no existir `image_path` en `cheffing_subrecipes`;
    - la **merma por línea** queda temporalmente fuera por no existir `waste_pct` en `cheffing_subrecipe_items`;
    - este ajuste queda explícitamente pendiente de normalización futura.
- **Breadcrumbs clicables** en fichas de:
  - productos
  - elaboraciones
  - platos
- **Orden asc/desc por cabecera** añadido en listados principales de:
  - productos
  - elaboraciones
  - platos
- **Platos: familia en listado + filtro por familia**:
  - columna `Familia` visible
  - selector con opción `Todas`
  - fallback `Sin familia`
  - derivación reutilizando la base conceptual existente de Menu Engineering (`mycheftool_source_tag_names`).
- **Alcance explícitamente fuera de este bloque**:
  - no se toca todavía el trabajo para permitir `0.5` raciones.

### 8.1 Tabla principal
La tabla principal ya replica la lógica base validada contra el Excel:

- PVP (con IVA)
- Coste/ración
- Precio sin IVA
- Margen/ración
- COGS %
- Margen %
- PVP objetivo
- Dif
- Unidades vendidas
- Total ventas
- Total margen

### Fórmulas clave adoptadas
- `Precio sin IVA = PVP / (1 + IVA)`
- `Margen/ración = Precio sin IVA - Coste/ración`
- `COGS % = Coste/ración / Precio sin IVA`
- `Margen % = Margen/ración / Precio sin IVA`
- `PVP objetivo = Coste/ración * 4 * (1 + IVA)`  
  (equivalente a un food cost objetivo del 25%)
- `Dif = PVP actual - PVP objetivo`
- `Total ventas = Unidades vendidas * Precio sin IVA`
- `Total margen = Unidades vendidas * Margen/ración`

### 8.2 Matriz BCM
La BCM ya está separada abajo, en bloque propio, con formato híbrido:
- resumen
- tabla
- gráfico / scatter visual

### Fórmulas BCM adoptadas
- `Margen medio = Total margen / Total unidades vendidas`
- `% corrección popularidad = 70%`
- `Índice medio popularidad = (1 / nº platos) * 0.7`
- `Índice ventas = Unidades del plato / Total unidades vendidas`
- `Margen G = Margen unitario - Margen medio`
- `Popularidad G = Índice ventas - Índice medio popularidad`

### Clasificación BCM
- `++` = Estrella
- `-+` = Vaca
- `+-` = Puzzle
- `--` = Perro

### 8.3 Mejoras UX ya hechas
- tooltips explicativos en columnas de Menu Engineering
- navegación desde Menu Engineering al plato referenciado
- ordenación ascendente/descendente por columnas
- filtro por familia
- columna de familia visible en tabla

### 8.4 Familia
#### Fuente elegida
La familia no sale de una columna explícita nativa en la vista de Menu Engineering.

La base elegida para derivarla es:
- `cheffing_dishes.mycheftool_source_tag_names`

#### Importante
No se usa el tag crudo como familia final, sino una normalización en código para acercarlo a las familias del Excel.

#### Observación
Esta parte está implementada, pero sigue siendo una de las zonas que conviene revisar con Pau porque algunas familias son más ambiguas que otras, especialmente:
- bebidas
- combinados
- refrescos
- “entradas frías” / compartir

---

## 9. Navegación / UX general de Cheffing
### Mejoras ya integradas
- botón para volver de Cheffing a la app principal
- links internos más útiles
- tooltips en zonas clave
- filtros y ordenaciones en Menu Engineering

### Estado
La UX ha mejorado bastante, pero todavía no se considera rediseño final.

---

## 10. Qué NO está hecho todavía
### 10.1 Histórico completo de ventas de SumUp
Pendiente.

#### Qué habrá que hacer
- importar histórico completo
- validar deduplicados
- validar mapeo producto/plato
- validar cifras finales en Menu Engineering

### 10.2 Importación de albaranes/facturas de proveedores
Pendiente.

#### Qué habrá que hacer
- subida de documentos
- OCR
- extracción de líneas
- matching contra ingredientes de Cheffing
- revisión humana
- actualización controlada de precios de compra / costes

### 10.3 Rediseño global de interfaz
Pendiente.

#### Idea
Pasar de una UI funcional y bastante “maquetera” a una interfaz más sólida, pulida y profesional.

---

## 11. Riesgos / puntos sensibles abiertos
### A. Familias de Menu Engineering
La lógica ya existe, pero la clasificación final de ciertas familias debe validarse con Pau.

Especialmente:
- Combinats
- Refrescos
- Resfrescos Pub
- Entras freds

### B. Bulk de alérgenos/indicadores
No está ejecutado.
Si se retoma, debe hacerse con cuidado y con revisión humana donde haya dudas.

### C. Precios dinámicos de proveedores
Todavía no existe el circuito automático de actualización a partir de facturas/albaranes.
Hoy los costes se apoyan en los datos cargados en Cheffing, no en una sincronización documental viva.

---

## 12. Estado recomendado para seguir
A partir de este punto, el orden recomendado de trabajo es:

1. **Importación histórica de ventas de SumUp**
2. **Importación de facturas/albaranes con OCR + matching + revisión**
3. **Rediseño global de interfaz**

---

## 13. Conclusión resumida
Cheffing ya no está en fase de “rescate técnico”.
La base funcional principal está resuelta.

El sistema ya tiene:
- datos migrados
- costes razonables
- análisis funcional
- navegación operativa
- estructura conceptual bastante limpia

Los siguientes bloques ya no son de “arreglar lo roto”, sino de:
- enriquecer datos reales (SumUp)
- automatizar mantenimiento de costes (facturas)
- profesionalizar presentación y experiencia de uso (rediseño)

---

## Nota UX (2026-03-19)
En detalle y creación de **platos** y **elaboraciones** se invirtió el orden visual del bloque de composición:
- primero se muestra **Elementos seleccionados**;
- debajo se muestra el **selector para añadir productos o elaboraciones**.
