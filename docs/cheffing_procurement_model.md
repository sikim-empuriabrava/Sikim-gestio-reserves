# Cheffing — Modelo técnico inicial de Proveedores y Compras

## Alcance de esta PR

Esta PR deja preparada la base de datos y el diseño técnico para el bloque funcional de:

- Proveedores.
- Documentos de compra (factura/albarán).
- Líneas de documento.
- Referencias de compra por proveedor.
- Auditoría simple de cambios de coste.

Fuera de alcance (intencionadamente):

- OCR real.
- Extracción/validación por LLM.
- UI completa de revisión/aplicación.
- Job real de borrado en Storage.

## Principios funcionales implementados

1. **El histórico se conserva siempre**: no se sobrescriben líneas históricas ni auditoría.
2. **Modo borrador/aplicación completa**: el documento se aplica entero, no por líneas parciales.
3. **No aplicar con líneas sin resolver**: la DB bloquea pasar a `applied` si existe alguna línea en estado distinto de `resolved`.
4. **Proveedor nullable**: un documento puede existir sin proveedor validado.
5. **Multiproveedor por ingrediente**: un ingrediente puede tener múltiples referencias en `cheffing_supplier_product_refs`.
6. **Retención de archivo original por estado**:
   - `draft` / `pending` / `discarded`: sin fecha de borrado (`storage_delete_after = null`).
   - `applied`: elegible para borrado a +7 días (`storage_delete_after` se rellena automáticamente).

## Entidades

## `cheffing_suppliers`
Proveedor operativo.

Campos clave:

- `trade_name`, `legal_name`.
- `tax_id`, `normalized_tax_id`, `normalized_name`.
- `phone`, `email`, `address`, `notes`.
- `is_active`, `created_at`, `updated_at`.

Notas:

- La detección futura puede priorizar `normalized_tax_id` y luego `normalized_name`.
- No se fuerza unicidad global de NIF/CIF en esta fase para mantener compatibilidad con cargas reales sucias.

## `cheffing_purchase_documents`
Cabecera del documento de compra (factura/albarán/otro).

Campos clave:

- `supplier_id` nullable.
- `document_kind` (`invoice`, `delivery_note`, `other`).
- `document_number`.
- `document_date`, `document_time`, `effective_at`.
- `storage_bucket`, `storage_path`, `storage_delete_after`.
- `status` (`draft`, `pending`, `applied`, `discarded`).
- `ocr_raw_text` y `interpreted_payload` (jsonb) para futuras fases.
- `created_by`, `validated_by`, `applied_by` + `validated_at`, `applied_at`, `discarded_at`.
- `validation_notes`, `created_at`, `updated_at`.

## `cheffing_purchase_document_lines`
Líneas del documento.

Campos clave:

- `document_id`, `line_number`.
- Raw: `raw_description`, `raw_quantity`, `raw_unit`, `raw_unit_price`, `raw_line_total`.
- Interpretado/normalizado: `interpreted_*`, `normalized_*`.
- Enlace ingrediente: `suggested_ingredient_id`, `validated_ingredient_id`.
- Estado: `line_status` (`unresolved`, `resolved`).
- `warning_notes`, `line_effective_at`, `created_at`, `updated_at`.

## `cheffing_supplier_product_refs`
Relación multiproveedor ingrediente↔referencia de compra.

Campos clave:

- `supplier_id`, `ingredient_id`.
- `supplier_product_description`, `supplier_product_alias`.
- `normalized_supplier_product_name`.
- `reference_unit_code`, `reference_format_qty`, `notes`.
- `created_at`, `updated_at`.

## `cheffing_ingredient_cost_audit`
Auditoría simple de cambios de coste vigente de ingrediente.

Campos clave:

- `ingredient_id`.
- `purchase_document_id`, `purchase_document_line_id`.
- `supplier_id`.
- `previous_cost`, `new_cost`.
- `document_effective_at`.
- `applied_by`, `applied_at`, `created_at`.

## Relaciones

- Documento (`cheffing_purchase_documents`) pertenece opcionalmente a proveedor.
- Línea (`cheffing_purchase_document_lines`) pertenece a documento.
- Línea puede tener ingrediente sugerido y validado.
- Referencia de proveedor (`cheffing_supplier_product_refs`) conecta proveedor con ingrediente.
- Auditoría conecta ingrediente + documento + línea + proveedor (nullable).

## Estados funcionales

Semántica de negocio visible:

- `draft`: borrador en edición.
- `pending`: pendiente de validación manual.
- `applied`: aplicado/validado a modelo de coste vigente.
- `discarded`: descartado.

Regla de aplicación:

- En transición a `applied`, si hay alguna línea `unresolved`, la DB bloquea la operación.

## Dato bruto vs interpretado vs validado

Por diseño se separa en líneas:

- **Bruto (raw)**: lectura original del documento.
- **Interpretado/normalizado**: propuesta técnica (OCR/LLM futuro u otras heurísticas).
- **Validado**: ingrediente final en `validated_ingredient_id` + estado `resolved`.

Esto evita aplicar automáticamente datos no revisados.

## Política de coste vigente (definición técnica para fases siguientes)

Este scaffold prepara el registro de eventos de coste en `cheffing_ingredient_cost_audit`.

Criterio funcional objetivo para siguiente PR (sin job de aplicación en esta):

1. El coste vigente de un ingrediente será el `new_cost` del último documento aplicado por `document_effective_at`.
2. Si hay empate temporal no resoluble de forma fiable dentro del mismo día, se priorizará el `new_cost` más alto (histórico intacto).
3. No se usa media ponderada.

## Criterio temporal por fecha documental

- `effective_at` se deriva automáticamente de `document_date + document_time` (si falta hora, `00:00:00`).
- Cada línea hereda `line_effective_at` desde el documento si no se informa explícitamente.

## Política de retención en Supabase Storage

Modelada en documento con:

- `storage_bucket`.
- `storage_path`.
- `storage_delete_after`.

Regla automática actual:

- Si estado `applied` ⇒ `storage_delete_after = now() + 7 days` (si estaba vacío).
- Si estado distinto de `applied` ⇒ `storage_delete_after = null`.

Pendiente en próxima fase:

- Job programado real que purgue objetos vencidos en Storage.

## Seguridad y acceso

Las nuevas tablas siguen el patrón existente de Cheffing:

- RLS habilitado en todas.
- `*_select` con `public.cheffing_is_allowed()`.
- `*_write` con `public.cheffing_is_admin()`.

Sin introducir un sistema nuevo de auth/autorización.

## Decisiones mínimas pendientes

1. **Normalización exacta de NIF/CIF y nombres**: función canónica a reutilizar en ingestas.
2. **Algoritmo final de resolución de empates de mismo día** en el proceso de aplicación de costes.
3. **Job de limpieza Storage** (`storage_delete_after`) con trazabilidad.
4. **Estrategia de deduplicación documental** (mismo proveedor+número+fecha) cuando llegue la carga real.
