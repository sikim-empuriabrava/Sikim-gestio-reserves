---
name: ui-ux-pro-max
description: "UI/UX design intelligence for web and mobile interfaces. Use when designing, reviewing, or implementing UI components, layouts, typography, accessibility, and interaction patterns across common stacks."
---

# UI/UX Pro Max - Design Intelligence

> **Uso en Codex Web:** tratar como checklist/guía; no ejecutar scripts.

Guía compacta para diseño y revisión de UI con alta señal: accesibilidad, layout, tipografía, interacción, estados y anti‑patrones.

## When to Apply

Usa esta skill cuando:
- Diseñas páginas, dashboards, formularios o componentes.
- Revisas UI para mejorar claridad, accesibilidad o consistencia visual.
- Ajustas layouts responsive o jerarquía tipográfica.

## MDS Defaults (B2B SaaS)

- Data-first: tablas, filtros y comparación clara.
- Estados loading/empty/error obligatorios.
- No introducir librerías nuevas sin justificar.
- Consistencia visual (spacing/typography/buttons).
- Accesibilidad mínima (focus/labels/contrast).
- Performance: paginación/virtualización si listas grandes.

## Core Checklist (alta señal)

### Accesibilidad (CRITICAL)
- Contraste mínimo 4.5:1 en texto normal.
- Focus visible en todos los elementos interactivos.
- Labels explícitos en inputs; `aria-label` en icon-only.
- Navegación por teclado sin trampas de foco.

### Layout & Responsive (HIGH)
- Respeta breakpoints clave: 375 / 768 / 1024 / 1440.
- Evita scroll horizontal en mobile.
- Define escala de z-index y úsala consistente.
- Mantén padding suficiente para contenido con elementos fijos.

### Tipografía & Color (MEDIUM)
- Texto base mínimo 16px en mobile.
- Line-height 1.5–1.75 para cuerpo.
- No mezclar familias tipográficas sin propósito.
- Usa tonos de texto legibles (no grises demasiado claros).

### Interacción & Estados (HIGH)
- Hover/active/focus con feedback visible.
- Botones deshabilitados durante acciones async.
- Mensajes de error cerca del problema y en lenguaje claro.
- Evita cambios que generen layout shift en hover.

### Datos & Visualización (MEDIUM)
- Usa el tipo de gráfico correcto para el dato.
- Provee tabla alternativa para accesibilidad.
- No sobrecargues el color: usa acentos consistentes.

### Performance (HIGH)
- Optimiza imágenes (WebP/AVIF, lazy loading).
- Respeta `prefers-reduced-motion`.
- Evita sombras/pinturas pesadas en listas largas.

## Anti‑patterns a evitar

- Emojis como íconos de UI.
- Variar estilos de botones sin razón.
- Texto demasiado tenue o pequeño.
- Layouts sin estados vacíos o de error.
- Interacciones sin estados de focus.

## Entrega rápida

Antes de finalizar:
- Verifica contraste y foco.
- Revisa estados loading/empty/error.
- Prueba responsive básico.
- Confirma consistencia visual (spacing/typography/buttons).
