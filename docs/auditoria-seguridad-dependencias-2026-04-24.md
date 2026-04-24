# Auditoría controlada de seguridad/dependencias (2026-04-24)

## Alcance y restricciones aplicadas
- Sin cambios funcionales de aplicación.
- Sin ejecutar `npm audit fix` ni `npm audit fix --force`.
- Sin actualizar `next`, `react`, `react-dom`, `@supabase/*`, `eslint`.
- Auditoría basada únicamente en estado local del repositorio y comandos disponibles.

## 1) Inspección de dependencias actuales

### Versiones declaradas (package.json)
- `next`: `14.2.14`
- `react`: `18.3.1`
- `react-dom`: `18.3.1`
- `eslint`: `8.57.1`
- `typescript`: `5.6.3`
- `@supabase/supabase-js`: `^2.45.4`
- `@supabase/ssr`: `file:supabase-ssr`

### Versiones efectivamente bloqueadas/resueltas (package-lock + npm ls)
- `next`: `14.2.14`
- `react`: `18.3.1`
- `react-dom`: `18.3.1`
- `eslint`: `8.57.1`
- `typescript`: `5.6.3`
- `@supabase/supabase-js`: `2.87.1` (nota: más nueva que el mínimo declarado por `^2.45.4`)
- `@supabase/ssr`: paquete local enlazado `0.0.0-local` (`link: true` a `./supabase-ssr`)

### Node esperado por el repo
- No hay campo `engines` en `package.json`.
- No existe `.nvmrc`.
- No existe `.node-version`.
- No existe `vercel.json` en la raíz.

Conclusión: no hay versión de Node fijada explícitamente por configuración del repo inspeccionada.

## 2) Auditoría con comandos

### Comandos solicitados y resultado
1. `npm audit --omit=dev`  
   - **Resultado**: fallo por acceso al endpoint de advisories (`403 Forbidden` en `https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`).
2. `npm audit`  
   - **Resultado**: mismo fallo (`403 Forbidden`), sin reporte de CVEs descargable en esta sesión.
3. `npm ls next react react-dom`  
   - **Resultado**: OK.
   - Árbol confirma `next@14.2.14`, `react@18.3.1`, `react-dom@18.3.1`.
4. `npm ls eslint typescript`  
   - **Resultado**: OK.
   - Árbol confirma `eslint@8.57.1`, `typescript@5.6.3`.
5. `npm ls @supabase/supabase-js @supabase/ssr`  
   - **Resultado**: OK.
   - Árbol confirma `@supabase/supabase-js@2.87.1` y `@supabase/ssr@0.0.0-local -> ./supabase-ssr`.

### Observación de entorno
En todos los comandos npm aparece warning:
- `npm warn Unknown env config "http-proxy"`.

No bloquea los `npm ls`, pero conviene limpiar esta variable/config en CI para evitar ruido y futuros comportamientos no soportados.

## 3) Riesgo y diagnóstico controlado (sin inventar advisories externos)

Con evidencia local disponible:
- Existe un aviso previo reportado durante `npm ci` indicando vulnerabilidad de `next@14.2.14`.
- En esta sesión **no se puede recuperar** el detalle de advisories vía `npm audit` (403), por lo que no se atribuyen CVEs concretos ni severidades adicionales más allá del contexto recibido.

Riesgo operativo:
- `next@14.2.14` debe tratarse como versión con parche pendiente de seguridad.
- El proyecto ya opera con `react@18.3.1`; por tanto, una subida dentro de la misma línea mayor de Next (14.x parcheado) debería ser el primer movimiento de menor riesgo.

## 4) Propuesta segura de upgrade (plan por fases, sin ejecutar aún)

### Fase A — Mitigación mínima (prioritaria)
Objetivo: cerrar riesgo conocido de Next con mínimo impacto.

1. Fijar `next` y `eslint-config-next` al **último parche estable compatible de la rama 14.x**.
2. Regenerar lockfile de forma controlada (`npm install --package-lock-only` o instalación normal según política del repo).
3. Ejecutar verificación:
   - `npm run build`
   - `npm run lint`
   - smoke tests manuales de auth/middleware/rutas críticas (App Router, reservas, roles).
4. Re-ejecutar `npm audit --omit=dev` y `npm audit` en un entorno con acceso al endpoint.

**Criterio de éxito**: desaparece el warning de seguridad asociado a `next@14.2.14` y no hay regresiones funcionales.

### Fase B — Higiene de dependencias no críticas
Objetivo: reducir deuda técnica y warnings deprecados sin mezclar cambios grandes.

1. Revisar dependencias deprecated reportadas (`rimraf`, `glob`, `eslint@8.x`, etc.) y clasificar:
   - transitivas sin acción inmediata,
   - actualizables sin breaking changes,
   - candidatas a migración mayor.
2. Aplicar actualizaciones en lotes pequeños y auditables.

### Fase C — Hardening de pipeline
1. Fijar versión de Node en repo (`engines` + `.nvmrc`) para consistencia local/CI/Vercel.
2. Añadir job de seguridad en CI:
   - `npm audit --omit=dev --json` (con tolerancias explícitas)
   - política clara para bloquear merges según severidad/alcance.
3. Resolver/eliminar configuración `http-proxy` inválida del entorno de build.

## 5) Comandos exactos ejecutados en esta auditoría
```bash
cat package.json
cat next.config.mjs
node -e "...lectura package-lock..."
npm audit --omit=dev
npm audit
npm ls next react react-dom
npm ls eslint typescript
npm ls @supabase/supabase-js @supabase/ssr
```

## 6) Recomendación ejecutiva
- Prioridad alta: actualizar `next`/`eslint-config-next` a parche seguro dentro de 14.x en una PR dedicada y pequeña.
- No mezclar esta PR con refactors funcionales ni cambios de Supabase.
- Repetir `npm audit` en entorno con acceso al endpoint para obtener evidencia completa de cierre.

## 7) Intento de PR mínima de seguridad (2026-04-24)
- Se actualizaron en `package.json` los objetivos de versión:
  - `next`: `14.2.35`
  - `eslint-config-next`: `14.2.35`
- La regeneración de `package-lock.json` quedó **bloqueada por red/política de registry**:
  - `npm install next@14.2.35 eslint-config-next@14.2.35 --save-exact` devolvió `403 Forbidden` contra `registry.npmjs.org`.
  - Intento sin proxy devolvió `ENETUNREACH`.
- Con node_modules actuales (sin poder reinstalar), `npm ls` marca `invalid` porque siguen instaladas localmente las versiones antiguas (`14.2.14`).
- `npm run lint` y `npm run build` se ejecutaron correctamente con el estado instalado actual; existen warnings previos no bloqueantes (`<img>` en lint y warnings Edge Runtime de Supabase durante build).
- `npm audit --omit=dev` y `npm audit` continúan fallando por `403 Forbidden` al endpoint de advisories.

## 8) Remate de lockfile solicitado (2026-04-24)
Se reintentó completar la regeneración del lockfile y validaciones obligatorias:

1. `npm install --package-lock-only`  
   - Error: `E403` al descargar `eslint-config-next` desde `https://registry.npmjs.org/eslint-config-next`.
2. `env -u ... npm install --package-lock-only` (sin proxy)  
   - Error: `ENETUNREACH` hacia `https://registry.npmjs.org/eslint-config-next`.
3. `npm ci`  
   - Error: `E403` por el mismo acceso bloqueado al registry.
4. `npm ls next eslint-config-next react react-dom`  
   - Reporta `ELSPROBLEMS` (instalado local sigue en `next@14.2.14` / `eslint-config-next@14.2.14` por no poder reinstalar).
5. `npm run lint`  
   - OK con warnings no bloqueantes ya existentes (`@next/next/no-img-element`).
6. `npm run build`  
   - OK con warnings no bloqueantes ya existentes.
7. `npm audit --omit=dev` y `npm audit`  
   - Error: `403 Forbidden` al endpoint `/-/npm/v1/security/advisories/bulk`.

Conclusión: en este entorno no fue posible completar la regeneración de `package-lock.json` para `14.2.35` por bloqueo de acceso a npm registry.
