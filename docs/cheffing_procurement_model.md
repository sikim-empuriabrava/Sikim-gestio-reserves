# Cheffing — Compras/Procurement técnico (estado actual)

## Propósito de este documento
Este documento sustituye la foto previa de “modelo inicial” y alinea la documentación con el estado real del repo a fecha **2026-04-07**.

> Contexto: la versión anterior describía Compras como una V1 manual con OCR/LLM fuera de alcance. Ese encuadre ya no refleja el código actual.

---

## 1) Alcance real actual del bloque de Compras
El flujo de Compras en el repo ya cubre un circuito operativo completo de **documento draft revisable** con OCR asistido:

- alta/listado de documentos de compra en `/cheffing/compras`;
- detalle operativo en `/cheffing/compras/[id]`;
- subida y preview de archivo original (imagen/PDF);
- procesamiento OCR real vía Azure Document Intelligence (`prebuilt-invoice`);
- cleanup/interpretación adicional con OpenAI (cuando está habilitado por entorno);
- persistencia separada de capa **raw**, capa **interpreted/normalized** y capa **validated**;
- revisión manual asistida de cabecera, proveedor y líneas antes de aplicar.

No se documenta aquí como “cerrado al 100%”: sigue habiendo heurística y decisiones abiertas (ver sección 8).

---

## 2) Estado funcional actual

### 2.1 Listado y entrada a detalle (`/cheffing/compras`)
- El listado carga documentos y proveedores activos.
- El copy de la página ya declara explícitamente “flujo draft revisable” y “pase inicial OCR”.

### 2.2 Detalle operativo (`/cheffing/compras/[id]`)
En la ficha de documento existe revisión operativa real sobre cabecera + líneas:

- cabecera editable en draft (tipo, número, fecha, proveedor, notas, total declarado);
- preview de archivo original firmado temporalmente;
- líneas renderizadas y ordenadas por `line_number`;
- edición por fila (guardar línea a línea), con estado local por fila;
- tracking de cambios (dirty) por línea/modelo/formulario;
- estados por fila durante operaciones (`saving`, `deleting`), sin bloquear globalmente toda la tabla;
- validaciones de readiness antes de aplicar (incluyendo líneas dirty y condiciones de completitud).

### 2.3 OCR real (backend)
El endpoint `POST /api/cheffing/procurement/documents/[id]/ocr`:

- descarga el archivo origen desde Storage con signed URL;
- llama a Azure Document Intelligence (`2024-11-30`, modelo `prebuilt-invoice`);
- parsea proveedor, metadatos documentales y líneas detectadas;
- genera hints de duplicado y “línea sombra/código”;
- opcionalmente ejecuta cleanup OpenAI sobre OCR bruto + candidatos internos;
- actualiza el documento con `ocr_raw_text` + `interpreted_payload`;
- inserta líneas detectadas como base revisable (`line_status = unresolved`).

### 2.4 Sugerencia/confirmación de proveedor y enriquecimiento prudente
Si hay sugerencia de proveedor existente en payload interpretado, la UI de detalle muestra:

- sugerencia con score/hints;
- acción explícita para **“Confirmar proveedor sugerido y guardar cabecera”**;
- bloque de estado de enriquecimiento del proveedor (auto-fill prudente, conflictos y warning de update).

### 2.5 Hints de revisión en líneas
La UI diferencia tipos de hint documentados en payload:

- `duplicate` (reservado para coincidencia fuerte de descripción + precio/importe con líneas coherentes);
- `possible_shadow_code_line` (repetición parcial/codificada o de menor calidad donde conviene revisión manual prudente).

El criterio vigente prioriza evitar deduplicación agresiva: ante dudas de prefijo/código, texto parcial o señal económica incompleta, se degrada a warning conservador en lugar de `duplicate`.

---

## 3) Capas de dato: raw / interpreted / validated

El diseño activo mantiene separación de capas para evitar aplicar automáticamente datos no confirmados:

1. **Raw**
   - OCR bruto textual (`ocr_raw_text`) y campos raw de líneas (`raw_*`).
2. **Interpreted / normalized**
   - `interpreted_payload` del documento.
   - Campos `interpreted_*` y `normalized_*` por línea (incluyendo unidad/precios normalizados cuando aplica cleanup).
3. **Validated**
   - Confirmación operativa manual (ej. `validated_ingredient_id`, `line_status = resolved`, cabecera final).

Esta separación sigue siendo clave para auditoría y control de riesgo.

---

## 4) Entidades principales (resumen)

- `cheffing_suppliers`: proveedores operativos y datos de contacto/fiscales.
- `cheffing_purchase_documents`: cabecera documental, storage, estado, OCR raw y payload interpretado.
- `cheffing_purchase_document_lines`: líneas raw + interpreted/normalized + validación final.
- `cheffing_supplier_product_refs`: referencias proveedor↔ingrediente para sugerencias/matching.
- `cheffing_ingredient_cost_audit`: auditoría de cambios de coste al aplicar documentos.

---

## 5) Flujo documental actual (alto nivel)

1. Crear documento draft.
2. Subir archivo original (opcional pero previsto como flujo normal).
3. Lanzar OCR (si entorno/config preparados).
4. Revisar/ajustar cabecera y proveedor.
5. Revisar líneas una a una (ingrediente, unidad, coste, notas, hints).
6. Aplicar documento cuando cumple reglas de readiness.
7. Documento aplicado queda en solo lectura operativa.

---

## 6) Política de coste vigente (estado actual)

Sigue activa la decisión conservadora de V1:

- al aplicar, el coste usado por línea para auditoría y recalculo vigente sale de `raw_unit_price`;
- existe `normalized_unit_price` en modelo/líneas OCR, pero no es aún la fuente final de aplicación;
- por tanto, esta política debe considerarse **temporal/pivotable** en futuros bloques cuando se consolide normalización.

---

## 7) Retención de archivo original

A nivel de modelo se mantiene `storage_delete_after` con trigger por estado documental:

- `applied` => fecha elegible de borrado (+7 días);
- resto de estados => `null`.

Sigue pendiente un **job automático real** que ejecute la purga física en Storage según esa fecha.

---

## 8) Pendientes y decisiones abiertas reales

Aunque el bloque está avanzado, no se documenta como final cerrado:

- persisten heurísticas en extracción/matching OCR;
- hay que seguir validando comportamiento con casos reales de proveedor/documento;
- la estrategia final de duplicados y líneas sombra sigue afinándose (cuánto resolver en cleanup vs frontend/backend);
- queda pendiente decidir el momento de migrar coste aplicado desde `raw_unit_price` a flujo normalizado estable;
- la limpieza automática de Storage por retención todavía no está automatizada end-to-end.

---

## 9) Nota de uso para handoff

Este documento describe **estado actual implementado** en repo. Para decisiones de roadmap/“definitivo”, validar siempre sobre código + datos reales de operación antes de cerrar criterios de producto.
