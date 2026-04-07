# Cheffing — Smoke checklist rápida (2026-04-07)

Checklist manual corta para validar que Cheffing está “en pie” antes de bloques grandes o cambios transversales.

## Alcance
- Checks de bajo riesgo, orientados a navegación/render/flujo básico.
- No incluye pruebas destructivas ni validación profunda de negocio.

## Prerrequisitos
- Usuario con acceso a Cheffing.
- Entorno apuntando a una base con datos de ejemplo mínimos.
- Para check OCR: variables/config de Azure/OpenAI disponibles (ver sección 4).

---

## 1) Catálogo base (navegación + detalle)

- [ ] Abrir `/cheffing/productos` y verificar que lista carga sin error visible.
- [ ] Entrar a un producto y volver al listado.
- [ ] Abrir `/cheffing/elaboraciones` y entrar a una elaboración.
- [ ] Abrir `/cheffing/platos` y comprobar que se ven controles de filtros/orden.
- [ ] Abrir `/cheffing/bebidas` y entrar a detalle de una bebida.

## 2) Bloques de análisis/consumo

- [ ] Abrir `/cheffing/menu-engineering` y confirmar que renderiza tabla/pestañas sin error.
- [ ] Abrir `/cheffing/menus` y entrar a detalle de un menú existente.
- [ ] Abrir `/cheffing/carta` y entrar a detalle de una carta existente.

## 3) Ventas, proveedores y compras (sin cambios destructivos)

- [ ] Abrir `/cheffing/ventas` y confirmar que la vista carga (aunque no haya datos).
- [ ] Abrir `/cheffing/proveedores` y confirmar listado visible.
- [ ] Abrir `/cheffing/compras` y confirmar listado de documentos.
- [ ] En `/mantenimiento/stock`, usar "Subir albarán/factura" y comprobar creación de borrador enlazado a Compras.
- [ ] Entrar a `/cheffing/compras/[id]` (un documento draft) y verificar:
  - [ ] cabecera visible (proveedor/tipo/fecha/estado);
  - [ ] líneas visibles ordenadas por `line_number`;
  - [ ] acciones por fila disponibles sin bloquear toda la tabla al guardar/borrar una línea;
  - [ ] si hay líneas dirty, el documento no permite “Aplicar documento”.

## 4) OCR (solo si entorno preparado)

> Ejecutar solo en entorno controlado/no productivo, con documento de prueba.

Prerequisitos técnicos:
- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_DOCUMENT_INTELLIGENCE_KEY`
- (Opcional cleanup) `OPENAI_API_KEY`
- (Opcional toggle) `OPENAI_OCR_CLEANUP_ENABLED`

Checks:
- [ ] En detalle de compra draft con archivo subido, lanzar “Procesar OCR Azure + cleanup OpenAI”.
- [ ] Confirmar que el proceso devuelve resultado sin error fatal.
- [ ] Confirmar que aparecen/actualizan líneas sugeridas para revisión manual.
- [ ] Confirmar que se mantiene necesidad de validación manual antes de aplicar.

---

## Qué NO cubre esta checklist
- No cubre regresión exhaustiva de fórmulas/costes.
- No cubre performance bajo carga.
- No cubre QA visual detallado ni responsive completo.
- No cubre integración externa real end-to-end (por ejemplo sync programático SumUp).
