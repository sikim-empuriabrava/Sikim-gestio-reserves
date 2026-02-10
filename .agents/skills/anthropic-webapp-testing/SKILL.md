---
name: webapp-testing
description: Guía para planear pruebas de aplicaciones web (funcionales, UI y regresión) sin asumir ejecución local ni dependencias.
license: Complete terms in LICENSE.txt
---

# Web Application Testing

**En Codex Web:** usar como guía; no asumir ejecución local ni herramientas instaladas.

Si no hay acceso a herramienta externa, usar alternativa manual en el repo (documentación, pruebas existentes, o checklist reproducible).

## Objetivo

Proveer un plan de pruebas claro, con criterios de aceptación y casos clave para UI y flujos críticos.

## Cómo usar esta skill

1. **Identifica flujos críticos** (login, búsqueda, CRUD, pagos, etc.).
2. **Define riesgos** (estado, permisos, errores, latencia, datos inválidos).
3. **Propón pruebas** por capa:
   - UI: componentes, estados, accesibilidad.
   - Integración: endpoints clave, contratos, validaciones.
   - Regresión: rutas críticas y edge cases.
4. **Especifica criterios de aceptación** claros por flujo.

## Plan mínimo sugerido

- **Smoke**: páginas principales cargan, navegación básica.
- **Estados**: loading/empty/error visibles y correctos.
- **Accesibilidad**: focus visible, labels, contraste.
- **Permisos**: roles y restricciones clave.
- **Datos**: paginación/orden/filtros funcionan.

## Criterios de aceptación (plantilla)

- ✅ El flujo principal completa la tarea sin errores visibles.
- ✅ Los estados loading/empty/error están presentes.
- ✅ Los controles tienen labels accesibles y focus visible.
- ✅ Los errores se muestran cerca del problema.
- ✅ La UI responde correctamente en 375/768/1024 px.

## Notas

- Si existen pruebas en el repo, priorizarlas y extenderlas en lugar de sugerir nuevas herramientas.
- Si no hay harness, documenta un plan reproducible y los comandos **solo si están disponibles** en el repo.
