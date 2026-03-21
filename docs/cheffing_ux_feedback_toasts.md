# Cheffing UX Feedback (fase toast)

## Qué se añadió

- Infraestructura reusable de toasts para Cheffing con `CheffingToastProvider` + `useCheffingToast`.
- Posición fija en esquina inferior derecha, apilado vertical, cierre manual (`X`) y autocierre (~3s).
- Variantes disponibles: `success`, `error`, `info`.

## Convención aplicada en esta fase

- **Toast** para feedback global inmediato en acciones de crear/guardar/añadir/eliminar.
- **Mensaje inline** de error se mantiene donde ya existía (formularios y bloques locales).
- Botones de acción muestran estado durante el envío (`Guardando...`, `Creando...`, `Añadiendo...`, `Eliminando...`) y se desactivan mientras dura la operación.

## Alcance

- Aplicado en el módulo **Cheffing** (productos, elaboraciones, platos/bebidas, menús y carta).
- No introduce SQL ni migraciones.
