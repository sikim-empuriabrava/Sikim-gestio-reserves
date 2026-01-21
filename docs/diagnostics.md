# Diagnóstico temporal

## Endpoint de entorno

`GET /api/_health/env` devuelve si existen las variables necesarias para Supabase sin exponer valores.

Respuesta esperada:

```json
{
  "ok": true,
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": true,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": true,
    "SUPABASE_SERVICE_ROLE_KEY": true
  }
}
```

> Nota: endpoint temporal para verificación post-deploy. Eliminar cuando ya no sea necesario.
