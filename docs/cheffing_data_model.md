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
Platos/bebidas canónicos de Cheffing (unidad base de reutilización).

- `name`: nombre.
- `family_id`: FK nullable al catálogo canónico `cheffing_families.id`.
- `selling_price`: precio de venta (nullable en esta fase).
- `servings`: número de raciones base de receta (mínimo 1, yield técnico del escandallo).
- `notes`: notas internas.
- `indicator_codes`: lista canónica editable de indicadores de plato final.
- `image_path`: ruta canónica editable de imagen en Storage.
- `mycheftool_source_tag_names`: dato legacy de importación/histórico (ya no es la fuente principal de familia en UI).


Semántica canónica (regla de dominio):
- Cada plato o bebida representa **1 unidad/ración base canónica**.
- Los multiplicadores decimales de reutilización (ej. `0.25`, `0.50`, `1.33`) **no viven en `cheffing_dishes`**.
- Esos multiplicadores deben vivir en la **línea consumidora** (menú/carta/composición futura) cuando ese modelo exista.
- Ejemplos de negocio: tapa compartida en menú de grupo `0.25`; bebida reforzada/ración ampliada `1.33`.

Regla activa de alérgenos:
- `allergen_codes` puede existir por legado en DB, pero **no forma parte del flujo editable**.
- Los alérgenos efectivos del plato se calculan por **herencia** (unión de ingredientes directos + elaboraciones incluidas con sus alérgenos efectivos).


### `cheffing_menus`
Menús de Cheffing (consumidor por persona).

- `name`: nombre del menú.
- `price_per_person`: precio por persona (nullable).
- `is_active`: estado activo/inactivo.

### `cheffing_menu_items`
Líneas consumidoras de menú.

- `menu_id`: referencia al menú padre.
- `dish_id`: referencia a `cheffing_dishes` (plato/bebida canónica).
- `section_kind`: sección de negocio (`starter`, `main`, `drink`, `dessert`).
- `multiplier`: multiplicador decimal de consumo por persona (`> 0`, ejemplo `0.25`, `1.33`).
- `sort_order`: orden manual de visualización.

Reglas de cálculo económico conservadoras (menús):
- Entrantes (`starter`) = **suma** de líneas.
- Segundos (`main`) = **media** de líneas (elección de un segundo por comensal).
- Bebidas (`drink`) = **suma** de líneas.
- Postres (`dessert`) = **suma** de líneas.
- Coste total menú/persona = `starter_sum + main_avg + drink_sum + dessert_sum`.
- Si una sección tiene alguna línea sin coste calculable, esa sección queda bloqueada y también el total/margen del menú.
- Margen y porcentajes en menús se calculan contra **precio sin IVA** (`PVP / (1 + IVA)`).

### `cheffing_cards`
Cartas de Cheffing (colección comercial, no calculadora).

- `name`: nombre de la carta.
- `is_active`: estado activo/inactivo.

### `cheffing_card_items`
Líneas asociadas de carta.

- `card_id`: referencia a la carta padre.
- `dish_id`: referencia a `cheffing_dishes` (plato/bebida canónica).
- `multiplier`: se mantiene por compatibilidad técnica, pero en flujo Carta se fija conceptualmente a `1` y no se edita.
- `sort_order`: orden manual de visualización.

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
- `cheffing_menus.id ← cheffing_menu_items.menu_id`.
- `cheffing_cards.id ← cheffing_card_items.card_id`.
- `cheffing_menu_items.dish_id → cheffing_dishes.id`.
- `cheffing_card_items.dish_id → cheffing_dishes.id`.
- **Importante:** `public.menus` (reservas/eventos) queda fuera de Cheffing y no se reutiliza aquí.

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
- En **Menús**, la fórmula activa por línea es: `coste_linea = coste_base_plato * multiplicador_decimal_linea`.
- En **Carta**, el módulo actúa como asociación comercial: muestra datos heredados en solo lectura y no edita economía del plato/bebida.
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

La pantalla de Menu Engineering se segmenta por pestañas:
- `Platos`
- `Bebidas`
- `Menús`

Para `Menús`, cada menú se trata como unidad vendible a nivel económico (PVP, neto, coste, margen, COGS, PVP objetivo), pero las métricas de ventas/popularidad/BCM solo se muestran si existe una fuente canónica fiable; en ausencia de esa fuente, se muestran como `Sin datos`.

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


## SQL incremental aplicado (2026-03-20)

Se añade especialización de secciones en menús de forma conservadora:

```sql
alter table public.cheffing_menu_items
  add column if not exists section_kind text;

update public.cheffing_menu_items
set section_kind = 'starter'
where section_kind is null;

alter table public.cheffing_menu_items
  alter column section_kind set default 'starter';

alter table public.cheffing_menu_items
  alter column section_kind set not null;

alter table public.cheffing_menu_items
  add constraint cheffing_menu_items_section_kind_check
  check (section_kind in ('starter', 'main', 'drink', 'dessert'));
```

No hay cambios destructivos. `public.menus` (módulo reservas) sigue fuera de Cheffing.
