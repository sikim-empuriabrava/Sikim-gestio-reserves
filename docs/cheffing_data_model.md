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
- `waste_pct`: merma en rango `0..1`.

### `cheffing_subrecipes`
Subrecetas/elaboraciones con rendimiento.

- `name`: nombre.
- `output_unit_code`: unidad de salida.
- `output_qty`: cantidad de salida.
- `waste_pct`: merma de proceso.

### `cheffing_subrecipe_items`
Líneas de subreceta (ingredientes u otras subrecetas).

- `subrecipe_id`: referencia a la subreceta padre.
- `ingredient_id`: ingrediente usado (nullable).
- `subrecipe_component_id`: subreceta usada (nullable).
- `unit_code`: unidad de la línea.
- `quantity`: cantidad de la línea.

> Regla: exactamente uno de `ingredient_id` o `subrecipe_component_id` debe estar presente.

### `cheffing_dishes`
Platos de carta (venta).

- `name`: nombre.
- `selling_price`: precio de venta (nullable en esta fase).

### `cheffing_dish_items`
Líneas de plato (ingredientes u otras subrecetas).

- `dish_id`: referencia al plato.
- `ingredient_id`: ingrediente usado (nullable).
- `subrecipe_id`: subreceta usada (nullable).
- `unit_code`: unidad de la línea.
- `quantity`: cantidad de la línea.

> Regla: exactamente uno de `ingredient_id` o `subrecipe_id` debe estar presente.

## Relaciones

- `cheffing_ingredients.purchase_unit_code → cheffing_units.code`.
- `cheffing_subrecipes.output_unit_code → cheffing_units.code`.
- `cheffing_subrecipe_items.subrecipe_id → cheffing_subrecipes.id`.
- `cheffing_subrecipe_items.ingredient_id → cheffing_ingredients.id`.
- `cheffing_subrecipe_items.subrecipe_component_id → cheffing_subrecipes.id`.
- `cheffing_dish_items.dish_id → cheffing_dishes.id`.
- `cheffing_dish_items.ingredient_id → cheffing_ingredients.id`.
- `cheffing_dish_items.subrecipe_id → cheffing_subrecipes.id`.

## Reglas de cálculo

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
- **Coste total de subreceta** = suma de líneas válidas.
- **Coste bruto por base** = `coste_total / (output_qty * output_unit.to_base_factor)`
- **Coste neto por base** = `coste_bruto * (1 / (1 - waste_pct))`

### Platos

- Las líneas de plato calculan su coste a partir de ingredientes o subrecetas.
- Solo se suman las líneas con dimensiones compatibles (si no hay conversión posible, el coste queda `NULL` y no rompe la vista).

## Seguridad (RLS)

Todas las tablas `cheffing_*` tienen RLS activado y políticas basadas en `public.cheffing_is_allowed()`.

## Pendiente para fases futuras

- Conversiones masa ↔ volumen con densidades.
- Gestión de stock.
- OCR y proveedores.
- Fichas y PDF.
- UI avanzada de subrecetas, platos, menús y análisis de costes.
