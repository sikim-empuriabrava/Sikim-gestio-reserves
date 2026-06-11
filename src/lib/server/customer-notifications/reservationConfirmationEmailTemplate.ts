const DEFAULT_GOOGLE_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Sikim%20Empuriabrava';

type ReservationConfirmationEmailInput = {
  customerName: string | null;
  eventDate: string | null;
  entryTime: string | null;
  totalPax: number | null;
  googleMapsUrl?: string | null;
};

export type ReservationConfirmationEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeDisplayText(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : fallback;
}

function formatDateForCustomer(value: string | null | undefined) {
  const fallback = normalizeDisplayText(value, 'Pendiente de concretar');
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return fallback;
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatTimeForCustomer(value: string | null | undefined) {
  const normalized = normalizeDisplayText(value, 'Pendiente de concretar');
  return /^\d{2}:\d{2}/.test(normalized) ? `${normalized.slice(0, 5)} h` : normalized;
}

function getGoogleMapsUrl(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && /^https:\/\/www\.google\.com\/maps\//.test(normalized)
    ? normalized
    : DEFAULT_GOOGLE_MAPS_URL;
}

export function buildReservationConfirmationEmail(
  input: ReservationConfirmationEmailInput,
): ReservationConfirmationEmail {
  const subject = 'Reserva confirmada en Sikim Empuriabrava';
  const customerName = normalizeDisplayText(input.customerName, 'cliente');
  const eventDate = formatDateForCustomer(input.eventDate);
  const entryTime = formatTimeForCustomer(input.entryTime);
  const totalPax = input.totalPax && input.totalPax > 0 ? String(input.totalPax) : 'Pendiente de concretar';
  const googleMapsUrl = getGoogleMapsUrl(input.googleMapsUrl);

  const text = [
    `Hola ${customerName},`,
    '',
    'Tu reserva en Sikim Empuriabrava está confirmada.',
    '',
    `Día: ${eventDate}`,
    `Hora: ${entryTime}`,
    `Personas: ${totalPax}`,
    '',
    'Te esperamos.',
    '',
    'Si necesitas modificar o cancelar la reserva, responde a este correo o contacta con el equipo de Sikim.',
    '',
    'Información útil:',
    '- El envío inicial era una solicitud; este email confirma que el equipo de Sikim la ha aceptado.',
    '- Si tu reserva incluye zona de fiesta o discoteca, el equipo te indicará las condiciones correspondientes.',
    '- Puedes ver la ubicación en Google Maps desde el enlace incluido.',
    '',
    `Ver ubicación en Google Maps: ${googleMapsUrl}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:#f7f1e8; color:#2b241d; font-family:Arial, Helvetica, sans-serif;">
    <div style="padding:28px 14px;">
      <div style="max-width:620px; margin:0 auto; background:#fffaf2; border:1px solid #eadcc9; border-radius:16px; overflow:hidden;">
        <div style="padding:28px 28px 18px; background:#221b15; color:#fff7ec;">
          <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#d8b073;">Sikim Empuriabrava</p>
          <h1 style="margin:0; font-size:26px; line-height:1.2; font-weight:700;">Reserva confirmada</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px; font-size:16px; line-height:1.6;">Hola ${escapeHtml(customerName)},</p>
          <p style="margin:0 0 22px; font-size:16px; line-height:1.6;">Tu reserva en <strong>Sikim Empuriabrava</strong> está confirmada.</p>

          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%; margin:0 0 24px; border-collapse:collapse;">
            <tr>
              <td style="padding:12px 0; border-top:1px solid #eadcc9; font-size:13px; color:#7c6a58;">Día</td>
              <td style="padding:12px 0; border-top:1px solid #eadcc9; text-align:right; font-size:15px; font-weight:700;">${escapeHtml(eventDate)}</td>
            </tr>
            <tr>
              <td style="padding:12px 0; border-top:1px solid #eadcc9; font-size:13px; color:#7c6a58;">Hora</td>
              <td style="padding:12px 0; border-top:1px solid #eadcc9; text-align:right; font-size:15px; font-weight:700;">${escapeHtml(entryTime)}</td>
            </tr>
            <tr>
              <td style="padding:12px 0; border-top:1px solid #eadcc9; border-bottom:1px solid #eadcc9; font-size:13px; color:#7c6a58;">Personas</td>
              <td style="padding:12px 0; border-top:1px solid #eadcc9; border-bottom:1px solid #eadcc9; text-align:right; font-size:15px; font-weight:700;">${escapeHtml(totalPax)}</td>
            </tr>
          </table>

          <p style="margin:0 0 18px; font-size:16px; line-height:1.6;">Te esperamos.</p>
          <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#5f5144;">Si necesitas modificar o cancelar la reserva, responde a este correo o contacta con el equipo de Sikim.</p>

          <div style="margin:0 0 26px; padding:18px; background:#f3eadc; border:1px solid #eadcc9; border-radius:12px;">
            <p style="margin:0 0 10px; font-size:14px; font-weight:700;">Información útil</p>
            <ul style="margin:0; padding-left:18px; color:#5f5144; font-size:14px; line-height:1.6;">
              <li>El envío inicial era una solicitud; este email confirma que el equipo de Sikim la ha aceptado.</li>
              <li>Si tu reserva incluye zona de fiesta o discoteca, el equipo te indicará las condiciones correspondientes.</li>
              <li>Puedes ver la ubicación en Google Maps desde el enlace incluido.</li>
            </ul>
          </div>

          <a href="${escapeHtml(googleMapsUrl)}" style="display:inline-block; padding:13px 18px; background:#9b693a; color:#fffaf2; border-radius:10px; text-decoration:none; font-size:14px; font-weight:700;">Ver ubicación en Google Maps</a>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
