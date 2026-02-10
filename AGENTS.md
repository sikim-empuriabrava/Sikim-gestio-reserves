# AGENTS.md — Sikim Gestió Reserves

## TL;DR (qué es esto y para qué existe)
Esta web app existe para centralizar y profesionalizar la operativa del restaurante/discoteca Sikim:
- Reservas (especialmente grupos), asignación de sala/mesas, estado del día y control operativo.
- Gestión de carta/menús y “menu engineering” (rentabilidad + popularidad) para tomar decisiones de precios y estructura de carta.
- Tareas internas (checklists/operativa) y, a futuro, integraciones (calendario / ventas / reporting).

**Regla de oro:** este archivo debe ser útil para *casi cualquier tarea* del repo, sin volverse frágil u obsoleto.

---

## Visión de producto (qué queremos conseguir)
1. **Un solo lugar de verdad** (single source of truth) para la información operativa: reservas, ocupación, eventos, notas y tareas.
2. **Menos caos en servicio**: saber “cómo está el día” de un vistazo (carga, timings, incidencias, grupos críticos).
3. **Mejores decisiones de carta**: no solo “margen”, también “qué se vende” (menu engineering real).
4. **Escalable y mantenible**: cambios de carta, temporadas y equipo sin que el sistema se rompa ni se vuelva inmanejable.

---

## Usuarios típicos y roles (alto nivel)
- **Admin/Owner**: configuración general, permisos, reporting.
- **Manager**: gestiona reservas, planificación, tareas, carta/menús, incidencias.
- **Staff**: consulta operativa del día, tareas asignadas, notas de servicio.
> Los nombres exactos de roles/permisos pueden variar, pero el patrón debe ser: mínimo privilegio y reglas claras.

---

## Dominios principales (módulos funcionales)
### 1) Reservas
- Crear/editar reservas (especial foco en grupos).
- Datos clave: fecha/hora, nº pax, contacto, idioma, notas, necesidades (alergias, trona, etc.), estado (pendiente/confirmada/no-show/cancelada).
- Asignación a sala/mesa y control de conflictos (evitar sobre-reserva).

**Invariantes deseables:**
- No duplicar ocupación “física” (mesa/sala) si el sistema opera con asignación.
- Estados y transiciones coherentes (p.ej., no pasar de cancelada a confirmada sin rastro/auditoría).

### 2) Ocupación / Salas / Mesas
- Representar la realidad operativa (salas/zonas/mesas) de forma que sea útil en servicio.
- Vista del día/turno para entender ocupación y rotación.

### 3) Operativa del día (Day Status)
- Pantalla/resumen “qué pasa hoy”: reservas clave, grupos grandes, timings, notas internas, incidencias.
- Debe ser rápida, legible y resistente a errores humanos (menos clicks, más claridad).

### 4) Carta, Platos y Menús
- Base de datos de platos y menús (composición).
- Elementos esperables: categorías, alérgenos, disponibilidad/temporada, precio.

### 5) Menu Engineering (rentabilidad + popularidad)
Objetivo: poder contestar con datos a:
- ¿Qué platos son rentables pero no se venden?
- ¿Qué platos se venden mucho pero tienen margen pobre?
- ¿Qué conviene re-preciar, reformular o retirar?

**Nota importante:** el “menu engineering” ideal combina:
- **Coste/escandallo** (food cost) → margen teórico.
- **Ventas reales** (POS / sistema de ventas) → popularidad y margen real.
Puede haber integraciones pendientes (p.ej. ventas) y el módulo debe soportar “fases”.

### 6) Tareas / Checklists / Rutinas
- Checklists por turno/día (apertura, cierre, limpieza, etc.).
- Asignación y trazabilidad (quién lo hizo / cuándo / comentarios).

### 7) Reporting (básico al inicio, más potente después)
- Resúmenes por periodo: ocupación, no-shows, ratio de confirmación, platos estrella, etc.
- A futuro: dashboards y exportaciones.

---

## Integraciones (presentes o previstas)
- **Calendario** (p.ej. Google Calendar) para sincronizar reservas/eventos.
- **Sistema de ventas/POS** (para popularidad/ventas reales del menu engineering).
- Notificaciones (email/WhatsApp/SMS) si el producto lo requiere más adelante.
> No “inventar” integraciones en código: si no existen aún, dejar hooks limpios y documentados.

---

## Principios de calidad (no negociables)
- **No hardcodear secretos** (keys, tokens, service-role, URLs privadas).
- **Seguridad por defecto**: RLS/roles bien definidos; mínimo privilegio.
- **Cambios pequeños y verificables**: PRs/commits revisables, con checklist de verificación.
- **Evitar deuda silenciosa**: si se hace un workaround, dejarlo documentado (y si procede, ticket/TODO con contexto).

---

## Flujo de trabajo esperado (para agentes y humanos)
1. **Localiza el patrón existente** (componentes, hooks, queries, naming).
2. **Plan breve** (3–7 pasos) si la tarea no es trivial.
3. **Implementa en pequeño** y evita refactors masivos sin necesidad.
4. **Verifica** usando los scripts que ya existan en `package.json`.
5. **Describe el cambio**: qué se tocó, por qué, riesgos y cómo probar.

---

## Comandos y package manager (no inventar)
- No asumas npm/pnpm/yarn/bun: usa el que indique el repo (lockfile y/o `packageManager`).
- No inventes scripts: revisa `package.json -> scripts`.

---

## Supabase / DB (reglas estables)
- Cambios de esquema mediante migraciones (y coherentes con RLS/policies).
- Evitar queries “carísimas” en pantallas críticas (día/ocupación).
- Si tocas rendimiento: explica impacto y, si aplica, añade/ajusta índices.

---

## Vercel / Config
- Config sensible por env vars (Vercel + `.env.local` fuera de git).
- Evitar hardcodear endpoints/IDs de terceros.
- Mantener compatibilidad entre preview/prod (especial cuidado con URLs y auth).

---

## Skills disponibles (playbooks bajo demanda)
Las skills viven en `.agents/skills/<skill>/SKILL.md`. Úsalas cuando aplique.

### UI / UX / Frontend
- `.agents/skills/ui-ux-pro-max/`
- `.agents/skills/anthropic-frontend-design/`
- `.agents/skills/vercel-react-best-practices/`
- `.agents/skills/vercel-composition-patterns/`

### Testing
- `.agents/skills/anthropic-webapp-testing/`

### Supabase / Postgres
- `.agents/skills/supabase-postgres-best-practices/`

### Security (solo si se pide o si el cambio es sensible)
- `.agents/skills/openai-security-best-practices/`
- `.agents/skills/openai-security-threat-model/`

### AWS (solo si una tarea toca infraestructura AWS)
- `.agents/skills/aws-s3/`
- `.agents/skills/aws-iam/`
- `.agents/skills/aws-lambda/`
- `.agents/skills/aws-api-gateway/`
- `.agents/skills/aws-sqs/`
- `.agents/skills/aws-eventbridge/`
- `.agents/skills/aws-step-functions/`
- `.agents/skills/aws-cloudwatch/`
- `.agents/skills/aws-dynamodb/`

---

## Formato de entrega al usuario (cómo responder)
Cuando propongas cambios:
- Explica **qué** cambias y **por qué** (en lenguaje claro).
- Incluye **cómo verificar** (scripts / pasos manuales).
- Si aportas SQL o comandos: separa claramente:
  - **(EJEMPLO)** vs **(EJECUTAR TAL CUAL)**
