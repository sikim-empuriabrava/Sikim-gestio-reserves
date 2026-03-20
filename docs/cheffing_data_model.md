# Cheffing — Data model (Phase 1)

Este documento describe el núcleo de datos y cálculos de la fase 1 de Cheffing (ingredientes + estructura mínima para subrecetas y platos).

## Tablas

### `cheffing_units`
Catálogo de unidades de compra/uso.

- `code` (PK): identificador textual (`g`, `kg`, `ml`, `l`, `u`).
- `dimension`: `mass`, `volume` o `unit`.
- `to_base_factor`: factor de conversión a la unidad base de su dimensión (`kg → 1000`, `l → 1000`).

### `cheffing_ingredients`
Ingredientes (materia prima) con información de compra.

- `name`: nombre del ingrediente.
- `purchase_unit_code`: unidad de compra (`cheffing_units.code`).
- `purchase_pack_qty`: cantidad de unidades por pack.
- `purchase_price`: precio total del pack.
- `waste_pct`: merma en rango `0..1` (la UI siempre opera en porcentaje).
- `allergen_codes`: lista canónica editable de alérgenos.
- `indicator_codes`: lista canónica editable de indicadores de producto.
- `image_path`: ruta canónica editable de imagen en Storage.

### `cheffing_subrecipes`
Subrecetas/elaboraciones con rendimiento.

- `name`: nombre.
- `output_unit_code`: unidad de salida.
- `output_qty`: cantidad de salida.
- `waste_pct`: merma de proceso (0..1, UI en porcentaje).
- `notes`: notas internas.
- `indicator_codes`: lista canónica editable de indicadores de producto.
- `image_path`: ruta canónica editable de imagen en Storage.

Regla activa de alérgenos:
- `allergen_codes` puede existir por legado en DB, pero **no forma parte del flujo editable**.
- Los alérgenos efectivos de la elaboración se calculan por **herencia** (unión recursiva de ingredientes y subelaboraciones hijas).

### `cheffing_subrecipe_items`
Líneas de subreceta (ingredientes u otras subrecetas).

- `subrecipe_id`: referencia a la subreceta padre.
- `ingredient_id`: ingrediente usado (nullable).
- `subrecipe_component_id`: subreceta usada (nullable).
- `unit_code`: unidad de la línea.
- `quantity`: cantidad de la línea.
- `waste_pct`: merma específica de la línea (0..1, UI en porcentaje).

> Regla: exactamente uno de `ingredient_id` o `subrecipe_component_id` debe estar presente.

### `cheffing_dishes`
Platos de carta (venta).

- `name`: nombre.
- `family_id`: FK nullable al catálogo canónico `cheffing_families.id`.
- `selling_price`: precio de venta (nullable en esta fase).
- `servings`: número de raciones (mínimo 1).
- `notes`: notas internas.
- `indicator_codes`: lista canónica editable de indicadores de plato final.
- `image_path`: ruta canónica editable de imagen en Storage.
- `mycheftool_source_tag_names`: dato legacy de importación/histórico (ya no es la fuente principal de familia en UI).

Regla activa de alérgenos:
- `allergen_codes` puede existir por legado en DB, pero **no forma parte del flujo editable**.
- Los alérgenos efectivos del plato se calculan por **herencia** (unión de ingredientes directos + elaboraciones incluidas con sus alérgenos efectivos).

### `cheffing_families`
Catálogo canónico de familias de platos.

- `name`: etiqueta visible de familia.
- `slug`: identificador estable y único.
- `sort_order`: orden manual para filtros/selectores.
- `is_active`: activa/inactiva para UI.

> Regla de representación: **“Sin familia” no existe como fila física**, se representa con `cheffing_dishes.family_id = null`.

## Contrato canónico y legado

Para el detalle editable de productos, elaboraciones y platos, el contrato principal es:

- `indicator_codes`
- `image_path`

Política conservadora de alérgenos (flujo activo):
- **Productos (`cheffing_ingredients`)**: `allergen_codes` **sí** es editable y es la fuente de verdad.
- **Elaboraciones (`cheffing_subrecipes`)**: alérgenos solo heredados, sin add/exclude manual.
- **Platos (`cheffing_dishes`)**: alérgenos solo heredados, sin add/exclude manual.
- En API/UI de elaboraciones y platos, `allergen_codes` se ignora/queda fuera de escritura para evitar mezcla de modelos.

Semántica de `indicator_codes` por entidad:

- Ingredientes y elaboraciones: catálogo de **indicadores de producto** (`PRODUCT_INDICATORS`).
- Platos: catálogo de **indicadores de plato final** (`DISH_INDICATORS`).

Campos legacy que se mantienen solo por compatibilidad/histórico (no como flujo principal):

- `allergens_manual_add`
- `allergens_manual_exclude`
- `indicators_manual_add`
- `indicators_manual_exclude`
- `image_url` (en platos, pendiente de decisión futura)
- `description`

### `cheffing_dish_items`
Líneas de plato (ingredientes u otras subrecetas).

- `dish_id`: referencia al plato.
- `ingredient_id`: ingrediente usado (nullable).
- `subrecipe_id`: subreceta usada (nullable).
- `unit_code`: unidad de la línea.
- `quantity`: cantidad de la línea.
- `waste_pct`: merma específica de la línea (0..1, UI en porcentaje).

> Regla: exactamente uno de `ingredient_id` o `subrecipe_id` debe estar presente.

## Relaciones

- `cheffing_ingredients.purchase_unit_code → cheffing_units.code`.
- `cheffing_subrecipes.output_unit_code → cheffing_units.code`.
- `cheffing_subrecipe_items.subrecipe_id → cheffing_subrecipes.id`.
- `cheffing_subrecipe_items.ingredient_id → cheffing_ingredients.id`.
- `cheffing_subrecipe_items.subrecipe_component_id → cheffing_subrecipes.id`.
- `cheffing_dish_items.dish_id → cheffing_dishes.id`.
- `cheffing_dishes.family_id → cheffing_families.id` (nullable, `on delete set null`).
- `cheffing_dish_items.ingredient_id → cheffing_ingredients.id`.
- `cheffing_dish_items.subrecipe_id → cheffing_subrecipes.id`.

## Reglas de cálculo

### Convención de merma
- **Base de datos:** `waste_pct` se guarda como fracción `0..1`.
- **Interfaz:** siempre se muestra y se introduce como porcentaje (0–99,99%).

> No se permiten ciclos entre elaboraciones (A contiene B contiene A). La API y las vistas los evitan.

### Unidades base
- Masa → **g**
- Volumen → **ml**
- Unidad → **u**

### Ingredientes

Para cada ingrediente se calcula el coste por unidad base:

- **Coste bruto por base** = `purchase_price / (purchase_pack_qty * unit.to_base_factor)`
- **FC (factor merma)** = `1 / (1 - waste_pct)`
- **Coste neto por base** = `coste_bruto * FC`

Estas derivaciones se exponen en la vista `v_cheffing_ingredients_cost`.

### Subrecetas

- Las líneas se calculan cuando la dimensión de la unidad de la línea coincide con la dimensión de la unidad del ingrediente.
- **Coste total de subreceta** = suma de líneas válidas (si no hay líneas → `0`; si hay líneas pero todas son incompatibles → `NULL`).
- **Coste bruto por base** = `coste_total / (output_qty * output_unit.to_base_factor)`
- **Coste neto por base** = `coste_bruto * (1 / (1 - waste_pct))`
- Las líneas de subreceta aplican su merma propia antes de agregarse: `coste_línea / (1 - waste_pct_linea)`.
- La vista `v_cheffing_subrecipe_items_cost` expone el coste total por línea.

### Platos

- Las líneas de plato calculan su coste a partir de ingredientes o subrecetas.
- Solo se suman las líneas con dimensiones compatibles (si no hay conversión posible, el coste queda `NULL` y no rompe la vista). Si no hay líneas, el coste total queda en `0`.
- **Coste por ración** = `coste_total / servings`.
- **Importante**: `servings` representa yield/porciones de receta para calcular coste por ración; **no** representa ventas.
- **Ventas**: usar `units_sold` (POS/SumUp o placeholder temporal) para totales de facturación y margen.
- La vista `v_cheffing_dish_items_cost` expone el coste total por línea.

## Seguridad (RLS)

Todas las tablas `cheffing_*` tienen RLS activado y políticas basadas en `public.cheffing_is_allowed()`.

## Pendiente para fases futuras

- Conversiones masa ↔ volumen con densidades.
- Gestión de stock.
- OCR y proveedores.
- Fichas y PDF.
- UI avanzada de subrecetas, platos, menús y análisis de costes.

## BCM en Menu Engineering

La clasificación BCM segmenta platos en 4 cuadrantes a partir de dos ejes:

- **Popularidad**: `units_sold`.
- **Rentabilidad**: `margin_unit` (margen por ración sobre base imponible).

### Pivots usados

En la pantalla de Menu Engineering se usan pivots por **media (avg)**:

- `pivotPopularity = avg(units_sold)` sobre todas las filas con `units_sold` numérico (incluye ceros).
- `pivotMargin = avg(margin_unit)` sobre filas con `margin_unit != null`.
- Si no hay filas válidas para `margin_unit`, `pivotMargin = 0`.

### Reglas de clasificación

- High Popularity: `units_sold >= pivotPopularity`
- High Margin: `margin_unit >= pivotMargin`
- **Estrella**: High Pop + High Margin
- **Vaca**: High Pop + Low Margin
- **Puzzle**: Low Pop + High Margin
- **Perro**: Low Pop + Low Margin
- **Sin datos**: cuando no se puede clasificar (ej. `margin_unit = null`).

La matriz BCM se recalcula con el rango de fechas válido seleccionado, porque `units_sold` se recalcula en ese rango antes de clasificar.


## Flujo POS CSV (source of truth)

- La importación POS se hace con dos CSV de SumUp ES: pedidos totales (`orders_csv`) y líneas por producto (`items_csv`).
- El rango efectivo se calcula por `Fecha de apertura` (`opened_at`) usando mínimo y máximo entre ambos archivos.
- El proceso es overwrite por rango: se borra primero todo lo ya guardado en ese intervalo (rango semiabierto para evitar problemas de milisegundos) y luego se inserta lo del CSV.
- Esto garantiza que, ante solapes, el último archivo importado sea la verdad para ese periodo.
- Si los dos CSV cubren rangos distintos de `opened_at`, la API avisa con warning para evitar borrados inesperados en imports siguientes.
