# Admin: tracking de reservas externas

La app interna expone la pantalla `/admin/reservas-externas/tracking` para que un usuario con rol `admin` pueda preparar configuraciones de medicion para futuras fases del motor publico de reservas.

## Que guarda

La configuracion vive en `public.external_tracking_integrations` y guarda solo IDs y labels estructurados:

- proveedor;
- nombre interno;
- estado activo/inactivo;
- categoria de consentimiento;
- evento previsto;
- IDs especificos del proveedor;
- notas internas.

Proveedores soportados:

- Meta Pixel;
- Google Tag;
- Google Ads Conversion;
- Google Tag Manager.

## Diferencia con atribucion propia

La atribucion propia es el dashboard interno `/admin/reservas-externas/atribucion`. Usa datos server-side ya guardados en `public.external_reservation_submissions`, como `source_label`, UTM, `gclid`, `fbclid`, referrer y landing page.

Los pixeles/tags son otra capa. Sirven para enviar eventos a plataformas externas en el navegador o por integraciones futuras, y dependen de consentimiento, cookies/legal y configuracion de eventos.

## Endpoint seguro de configuración pública

La app interna expone `GET /api/external-tracking-config` para que `Reserves_extern` pueda leer la configuracion activa en una fase posterior.

La ruta es publica solo a nivel de middleware para evitar sesion Supabase, pero el handler exige `Authorization: Bearer <secret>`. El secreto vive en la variable server-only `SIKIM_PUBLIC_TRACKING_CONFIG_SECRET`.

La respuesta devuelve solo integraciones activas y seguras, con campos camelCase:

- `provider`;
- `consentCategory`;
- `triggerEvent`;
- el ID estructurado correspondiente al proveedor (`metaPixelId`, `googleTagId`, `googleAdsConversionId` + `googleAdsConversionLabel`, o `gtmContainerId`).

No devuelve scripts, notas internas, nombre interno, estado, IDs de base de datos ni timestamps. Las respuestas usan `Cache-Control: no-store` para que el consumidor pueda obtener siempre la configuracion actual tras cambios desde Admin.

Este endpoint no carga pixels por si mismo, no crea cookies y no ejecuta tags. Solo expone configuracion controlada para que `Reserves_extern` la consuma en un PR posterior.

## Alcance de esta fase

Esta fase guarda configuracion interna y expone la configuracion activa segura mediante el endpoint server-to-server anterior.

No hace nada de esto:

- no carga Meta Pixel;
- no carga Google Tag;
- no carga Google Tag Manager;
- no implementa conversion tracking;
- no crea cookies;
- no cambia el formulario publico;
- no cambia el consentimiento de `Reserves_extern`;
- no toca `POST /api/external-reservation-requests`.

## Consentimiento futuro

Cuando una fase futura conecte esta configuracion con `Reserves_extern`, la carga debera respetar el consentimiento del usuario:

- `analytics` para medicion analitica;
- `marketing` para publicidad, retargeting o conversiones.

Meta Pixel y Google Ads Conversion quedan fijados como `marketing`.

Google Tag y Google Tag Manager pueden configurarse como `analytics` o `marketing`, segun el uso futuro. GTM debe tratarse con especial cuidado porque puede cargar multiples tags dentro del contenedor.

## Seguridad

No se permiten scripts arbitrarios. La tabla y la API admin no aceptan campos como:

- `custom_script`;
- `html`;
- `javascript`;
- `code`.

La configuracion solo acepta IDs estructurados y labels acotados. La validacion se aplica server-side y tambien en DB mediante constraints para evitar combinaciones ambiguas por proveedor.

## Acceso

La ruta cuelga de `/admin`, asi que queda protegida por el middleware y por la comprobacion server-side del layout de Admin.

Las APIs admin exigen:

- usuario autenticado;
- fila activa en allowlist;
- rol `admin`.

La tabla tiene RLS habilitado. El acceso directo de `anon` y `authenticated` queda revocado, y la app la gestiona server-side con `service_role`.
