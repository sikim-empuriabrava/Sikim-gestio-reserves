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
- Desde **2026-04-08 (Fase B)** el listado funciona como **bandeja operativa**:
  - tabs por estado (`Borradores`, `Aplicados`, `Descartados`) con contador visible;
  - vista por defecto en `Borradores`;
  - lectura por fila orientada a priorización diaria (estado DB + estado operativo + proveedor confirmado/provisional + líneas + importe útil).
- En borradores se añade una señal prudente de “estado operativo” para priorizar:
  - sin proveedor confirmado;
  - líneas pendientes;
  - coste pendiente en líneas (no marcar “listo para aplicar” mientras falte coste aplicable);
  - listo para revisar;
  - listo para aplicar.
- La bandeja puede mostrar una señal warning-first de posible duplicado documental (si `possible_document_duplicate.status = possible_duplicate`) para revisión manual antes de aplicar.
- La señal de posible duplicado se muestra de forma visible en la bandeja de **borradores** (no en aplicados/descartados) para evitar ruido fuera de contexto.
- La descripción de “Líneas pendientes” en listado muestra solo motivos activos (sin contadores a cero) y la ordenación de borradores prioriza primero estados operativos más críticos.
- Ordenación estable orientada a uso diario (fecha de documento descendente, con desempate por actualización/creación).

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

### 2.6 Grounding DB-first en matching OCR (proveedor e ingredientes)
- El backend de OCR intenta resolver **primero contra entidades reales de DB**:
  - proveedor: candidatos desde `cheffing_suppliers` (trade/legal name + señales fiscales/contacto) con score y trazas;
  - líneas: shortlist de ingredientes reales priorizando `cheffing_supplier_product_refs` y nombre normalizado/tokens.
- OpenAI ya no actúa como resolvedor “a ciegas” sobre toda la base: recibe shortlist/candidatos y se usa como capa de cleanup/reranking conservadora.
- El payload interpretado mantiene trazabilidad útil (`match_reasons`, `match_trace`, shortlist por línea) para depuración en revisión manual.
- El matching final de líneas usa la mejor representación disponible tras cleanup (sin perder referencia de la línea raw).
- La normalización se separa por dominio: proveedor (nombres societarios) vs ingrediente/producto (texto OCR de línea/ref).
- El bonus de proveedor en candidaturas de ingredientes se centra en el proveedor top sugerido (especialmente si es fuerte/dominante), evitando inflar refs de candidatos secundarios.
- El matching de proveedor añade una capa fuzzy (Dice sobre trigramas normalizados) para variantes cercanas reales (`frigorificos` vs `frigorifics`) sin sustituir señales fuertes (NIF/email/teléfono/exact).

### 2.5 Hints de revisión en líneas
La UI diferencia tipos de hint documentados en payload:

- `duplicate` (reservado para coincidencia fuerte de descripción + precio/importe con líneas coherentes);
- `possible_shadow_code_line` (repetición parcial/codificada o de menor calidad donde conviene revisión manual prudente).

El criterio vigente prioriza evitar deduplicación agresiva: ante dudas de prefijo/código, texto parcial o señal económica incompleta, se degrada a warning conservador en lugar de `duplicate`.

Además, el backend aplica exclusión automática **solo en alta confianza** antes de insertar líneas revisables:
- `section_header_non_purchasable`: líneas de cabecera/sección no comprables (sin cantidad/precio útil y sin grounding convincente) se excluyen de revisión manual.
- `shadow_duplicate_strong`: en duplicado sombra fuerte se conserva únicamente la línea más rica/fiable y se excluye la sombra.

Las líneas excluidas no se insertan en `cheffing_purchase_document_lines`, pero quedan trazadas en `interpreted_payload.excluded_lines` con motivo y (si aplica) línea superviviente.

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

## 7) Retención de archivo original (Fase D — 2026-04-08)

Desde Fase D ya existe automatización **conservadora** de limpieza física en Storage para documentos descartados: 

- alcance automático actual: solo `status = discarded`;
- solo cuando el documento todavía mantiene `storage_bucket` + `storage_path`;
- solo si supera antigüedad configurada por retención;
- la purga elimina el archivo original en Supabase Storage y limpia referencias en DB (`storage_bucket = null`, `storage_path = null`).

Importante (limitación deliberada de fase):
- no borra `draft`;
- no borra `applied`;
- no limpia de forma agresiva `ocr_raw_text`, `interpreted_payload` ni líneas;
- no introduce colas backend nuevas ni migraciones de esquema para esta fase.

### 7.1 Endpoint interno cron-ready

Ruta interna preparada para ejecución manual o cron:

- `GET /api/internal/cheffing/procurement/retention?mode=dry-run`
- `GET /api/internal/cheffing/procurement/retention?mode=execute`
- `POST /api/internal/cheffing/procurement/retention?mode=execute`

Protección:
- requiere secreto por `Authorization: Bearer <PROCUREMENT_RETENTION_SECRET>` (o `x-procurement-retention-secret`);
- `mode=execute` queda bloqueado si `PROCUREMENT_RETENTION_ENABLED` no está activo.
- si `mode` llega informado con valor inválido, la ruta responde `400` (no degrada silenciosamente a `dry-run`).

### 7.2 Política de selección conservadora

- prioridad temporal: `discarded_at`;
- fallback prudente: `updated_at` solo para descartados sin `discarded_at`;
- límite de lote por ejecución (batch) configurable para evitar purgas masivas en un único run.

### 7.3 Variables de entorno

- `PROCUREMENT_RETENTION_ENABLED`: habilita/deshabilita `execute` (por defecto apagado);
- `PROCUREMENT_RETENTION_SECRET`: secreto requerido por la ruta interna;
- `PROCUREMENT_RETENTION_DISCARDED_DAYS`: días de retención para descartados;
- `PROCUREMENT_RETENTION_BATCH_LIMIT`: máximo de candidatos por ejecución.

### 7.4 Modos operativos

- `dry-run`: lista candidatos y resumen, sin mutaciones;
- `execute`: intenta purgar por candidato, continúa ante errores parciales y devuelve resumen (candidatos/procesados/purgados/omitidos/errores + IDs afectados).
- `execute` aplica defensa en profundidad: bloqueo por flag tanto en la ruta interna como en el helper server-side.

---

## 8) Pendientes y decisiones abiertas reales

Aunque el bloque está avanzado, no se documenta como final cerrado:

- persisten heurísticas en extracción/matching OCR;
- hay que seguir validando comportamiento con casos reales de proveedor/documento;
- la estrategia final de duplicados y líneas sombra sigue afinándose (cuánto resolver en cleanup vs frontend/backend);
- queda pendiente decidir el momento de migrar coste aplicado desde `raw_unit_price` a flujo normalizado estable;
- la automatización de retención (Fase D) ya existe para descartados y purga física de originales; pendientes futuros quedan en ampliar alcance/políticas si producto lo decide.

---

## 9) Nota de uso para handoff

Este documento describe **estado actual implementado** en repo. Para decisiones de roadmap/“definitivo”, validar siempre sobre código + datos reales de operación antes de cerrar criterios de producto.

---

## 10) Ajustes recientes en revisión OCR (neto/bruto + sugerencias manuales)

- **Comparación económica neto vs bruto**: en la revisión de detalle se separan subtotal/base de líneas, IVA detectado (solo con señal OCR suficiente), IVA estimado por diferencia y total declarado. Solo cuando el delta cuadra con **IVA detectado real** se trata como caso esperado y no como discrepancia OCR real; si solo hay **IVA estimado por diferencia**, se muestra como hipótesis prudente para revisión, sin darlo por confirmado.
- **Sugerencias de ingrediente manuales útiles**: el pipeline distingue entre:
  - `auto/high confidence` (señal fuerte y dominante);
  - `manual suggestion candidate` (útil para aceptar con 1 clic sin auto-validar);
  - candidatos débiles (no sugerir fuerte).
- **Prudencia en variedades**: se evita promover con demasiada fuerza casos con riesgo de variante distinta (p.ej. diferentes tipos de tomate cherry) aunque el parecido textual sea razonable.


## 11) Entrada documental móvil compartida (Bloque 1)

Desde **2026-04-07** existe un punto de entrada documental compartido para subir 1 documento y crear borrador draft reutilizando el pipeline actual de procurement.

Separación operativa vigente:
- `/mantenimiento/stock`: rol **upload-only intake** (hacer foto/galería/archivo, crear draft y subir original). No incluye listado/revisión de compras ni navegación a módulos de Cheffing.
- `/cheffing/compras`: mantiene el flujo completo de revisión (listado, detalle, OCR, validación y aplicación).

Capacidades del intake inicial:
- acciones explícitas para **hacer foto** (preferencia de cámara trasera cuando el navegador lo permite) y **galería/archivo**;
- formatos aceptados: **imagen** y **PDF**;
- flujo reutilizado: crear documento draft + subir archivo original + lanzar OCR automáticamente + confirmación de envío.
- `document_kind` inicial explícito en intake compartido: `delivery_note` (albarán) en mantenimiento y compras, por decisión operativa de producto (sin impacto en elección de extractor Azure).

Importante de permisos/mutación:
- OCR desde mantenimiento se ejecuta en modo intake-only: genera payload/sugerencias y duplicate warnings, pero **no** muta maestro de proveedor.
- OCR en cualquier flujo (mantenimiento, cheffing o admin) **no muta** `cheffing_suppliers`; solo interpreta y persiste sugerencias/warnings.
- **Guardar cabecera en draft no muta maestro**: desde el hardening de invariantes (2026-04-09), los datos de contacto confirmados en cabecera (`tax_id`, `email`, `phone`) se guardan en `interpreted_payload.supplier_contact_review` como revisión persistida del borrador.
- En cabecera del borrador se muestran sugerencias OCR editables (teléfono/email y, si aplica, tax_id) para confirmación manual antes de guardar.
- El `tax_id` de proveedor en cabecera puede quedar en tres estados visibles:
  - sugerencia OCR normal (señal suficientemente fiable),
  - detección OCR bloqueada por prudencia (se enseña valor detectado + motivo, sin autocompletar),
  - sin detección útil (`—`).
- Política de aplicación al **aplicar documento**:
  - `tax_id`: no se sobreescribe automáticamente si entra en conflicto con valor previo.
  - `email` y `phone`: merge no destructivo, manteniendo existentes y agregando nuevos valores únicos.
- Invariante funcional reforzado: acciones de borrador (OCR, guardar cabecera, guardar línea y aceptar sugerencias) persisten estado revisable, pero los efectos definitivos de negocio quedan reservados a **Aplicar documento**.

### 11.1 Matriz de mutaciones auditada (draft vs apply)

- **Guardar cabecera (draft)**:
  - sí: actualiza `cheffing_purchase_documents` (cabecera) y persiste revisión de contacto en `interpreted_payload.supplier_contact_review` en una misma operación de persistencia;
  - si falla cualquier parte (incluida la persistencia de `supplier_contact_review`), la request responde error y no devuelve `ok: true`;
  - no: no actualiza `cheffing_suppliers`, no recalcula costes oficiales.
- **Guardar línea (draft)**:
  - sí: actualiza `cheffing_purchase_document_lines` del documento draft;
  - no: no toca `cheffing_ingredients.purchase_price`, stock ni auditoría de costes.
- **Aceptar sugerencia (draft)**:
  - sí: prepara cambios locales de revisión y, tras guardar línea, persiste en `cheffing_purchase_document_lines`;
  - no: no ejecuta efectos de negocio definitivos.
- **Crear ingrediente desde línea (draft)**:
  - hardening conservador activo: acción visible pero deshabilitada en revisión draft, con copy de “no disponible en draft” para evitar falsa disponibilidad.
  - micro-UX: el botón expone ayuda contextual breve (tooltip/`title`) indicando que queda disponible tras aplicar documento.
  - sigue bloqueada para evitar mutación de maestro (`cheffing_ingredients`) antes de aplicar.
- **OCR (draft)**:
  - sí: actualiza `ocr_raw_text`, `interpreted_payload` y, si procede, inserta líneas sugeridas en `cheffing_purchase_document_lines`;
  - no: no muta costes oficiales ni stock, ni maestro de proveedor.
- **Aplicar documento**:
  - único punto que ejecuta efectos definitivos: cambio de estado a `applied`, auditoría de costes (`cheffing_ingredient_cost_audit`), actualización de `cheffing_ingredients.purchase_price`, y enriquecimiento final de contacto de proveedor desde revisión draft.

### 11.2 Señal prudente de posible duplicado documental (warning-first)

Como base del siguiente bloque, los documentos draft calculan una señal conservadora de `possible_document_duplicate` y se persiste dentro de `interpreted_payload`:
- estado (`none` o `possible_duplicate`), score, motivos y candidatos;
- heurística prudente con metadatos disponibles (tipo, número, fecha, proveedor, total declarado), con fallback desde `document_detected` y `supplier_existing_suggestion` cuando la cabecera DB aún está vacía;
- **sin** auto-descartar, auto-borrar ni bloquear irreversiblemente.

La política actual es de advertencia y trazabilidad para revisión manual posterior.

## 12) Ajustes UX revisión línea a línea (Fase A OCR procurement)

En la revisión de `/cheffing/compras/[id]` se ha endurecido el enfoque operativo por línea:

- cada línea muestra mejor la sugerencia principal de ingrediente (nombre + score + motivo resumido cuando existe);
- se añade warning visual de ambigüedad cuando hay más de un candidato cercano;
- se mantiene warning explícito cuando no hay match OCR suficientemente fiable;
- se mantiene acción **Aceptar sugerencia** (1 clic) por línea, orientada a dejar la línea lista para guardado sin atajos de persistencia inesperados;
- el selector manual de ingrediente pasa a interacción tipo combobox buscable (más usable en listados largos);
- el combobox manual de ingrediente ya soporta cierre por click fuera + teclado básico (`ArrowUp/Down`, `Enter`, `Escape`) con resaltado de opción activa y scroll interno al navegar;
- al crear ingrediente desde línea, se preserva el snapshot editado de la fila para no perder cambios locales;
- la unidad canónica de la fila se precompleta con inferencia prudente (`validated_unit`/`normalized_unit_code`/señal pipeline) cuando existe, evitando vacíos innecesarios.
- hardening final operativo: aceptar sugerencia mientras la fila está en edición ya no pisa otros campos locales no guardados;
- el reset de snapshot local por re-render se evita cuando la fila está en edición con cambios pendientes (cancelar sigue volviendo al persistido real);
- el combobox manual cierra de forma consistente en `Escape`/`Tab`/click fuera y evita quedarse abierto en estados inválidos (sin resultados tras filtro o limpieza).

## 13) Intake documental unificado con cola visual conservadora (2026-04-08 / 2026-04-09)

En `/cheffing/compras` la entrada documental queda unificada en un único bloque de intake (sin separación visual entre “individual” y “batch”), sin cambiar el modelo de datos ni introducir colas backend nuevas:

- selección de 1 o varios archivos en el mismo control (`PDF/JPG/PNG/WEBP`);
- selección única de `document_kind` para los archivos que se añaden en ese gesto (`delivery_note` o `invoice`);
- misma cola visual por archivo para ambos casos (1 archivo = cola de 1 item), con estado explícito:
  - `pending`;
  - `creating_draft`;
  - `uploading_file`;
  - `running_ocr`;
  - `completed`;
  - `failed`.

### 13.1 Comportamiento operativo

- procesamiento **secuencial** por defecto (prioridad robustez y trazabilidad frente a paralelización agresiva);
- tolerancia a errores parciales: si un archivo falla, el lote continúa con el siguiente;
- si un archivo falla tras crear draft, la cola conserva `documentId` y link al detalle para revisión manual;
- no hay redirección automática al detalle durante el intake en cola; la bandeja se refresca al cerrar el lote.
- cuando ya existe señal fiable en el payload del documento (`possible_document_duplicate`), la cola también puede mostrar badge de **posible duplicado** por item además de la bandeja `draft`.

### 13.2 UX mínima aplicada

- resumen de cola con contadores (`pendientes`, `en proceso`, `completados`, `fallidos`);
- botón de procesado deshabilitado cuando no toca (sin pendientes o lote en curso);
- botón para limpiar items finalizados (`completed` / `failed`) sin mezclar esta cola con tabs del listado principal.
