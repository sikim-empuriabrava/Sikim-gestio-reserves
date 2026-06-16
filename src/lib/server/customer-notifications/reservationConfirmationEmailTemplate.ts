export const RESERVATION_EMAIL_WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=34625064987&text&type=phone_number&app_absent=0';
export const RESERVATION_EMAIL_INSTAGRAM_URL = 'https://www.instagram.com/sikim_empuriabrava/';
export const RESERVATION_EMAIL_FACEBOOK_URL =
  'https://www.facebook.com/sikimempuriabrava/?locale=es_ES';
export const DEFAULT_RESERVATION_EMAIL_LOCATION_URL =
  'https://www.google.com/maps/search/?api=1&query=Sikim%20Empuriabrava';

const EMAIL_ICON_CALENDAR =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22 viewBox=%220 0 64 64%22 fill=%22none%22 stroke=%22%23ad7428%22 stroke-width=%223.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%2212%22 y=%2214%22 width=%2240%22 height=%2238%22 rx=%224%22/%3E%3Cpath d=%22M22 10v10M42 10v10M12 26h40M22 36h.1M32 36h.1M42 36h.1M22 44h.1M32 44h.1M42 44h.1%22/%3E%3C/svg%3E';
const EMAIL_ICON_CLOCK =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22 viewBox=%220 0 64 64%22 fill=%22none%22 stroke=%22%23ad7428%22 stroke-width=%223.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2222%22/%3E%3Cpath d=%22M32 18v16l11 7%22/%3E%3C/svg%3E';
const EMAIL_ICON_PEOPLE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22 viewBox=%220 0 64 64%22 fill=%22none%22 stroke=%22%23ad7428%22 stroke-width=%223.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Ccircle cx=%2232%22 cy=%2222%22 r=%227%22/%3E%3Cpath d=%22M18 50v-4c0-8 6-14 14-14s14 6 14 14v4%22/%3E%3Ccircle cx=%2217%22 cy=%2228%22 r=%225%22/%3E%3Cpath d=%22M8 50v-3c0-6 4-11 10-12%22/%3E%3Ccircle cx=%2247%22 cy=%2228%22 r=%225%22/%3E%3Cpath d=%22M56 50v-3c0-6-4-11-10-12%22/%3E%3C/svg%3E';
const EMAIL_ICON_WHATSAPP =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22 viewBox=%220 0 64 64%22%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2225%22 fill=%22%23f1fff4%22 stroke=%22%23099b3d%22 stroke-width=%223%22/%3E%3Cpath d=%22M23 45l2-7c-2-3-3-6-3-9 0-8 6-14 14-14s14 6 14 14-6 14-14 14c-3 0-6-1-8-2l-5 4z%22 fill=%22none%22 stroke=%22%23099b3d%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3Cpath d=%22M29 24c1 7 5 11 12 13%22 fill=%22none%22 stroke=%22%23099b3d%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3C/svg%3E';
const EMAIL_ICON_LOCATION =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M24 43s14-13 14-25a14 14 0 1 0-28 0c0 12 14 25 14 25z%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%224%22/%3E%3C/svg%3E';
const EMAIL_ICON_INSTAGRAM =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 fill=%22none%22 stroke=%22%23ad7428%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%2211%22 y=%2211%22 width=%2226%22 height=%2226%22 rx=%227%22/%3E%3Ccircle cx=%2224%22 cy=%2224%22 r=%226%22/%3E%3Ccircle cx=%2231%22 cy=%2217%22 r=%221.5%22 fill=%22%23ad7428%22 stroke=%22none%22/%3E%3C/svg%3E';
const EMAIL_ICON_FACEBOOK =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Ccircle cx=%2224%22 cy=%2224%22 r=%2219%22 fill=%22none%22 stroke=%22%23ad7428%22 stroke-width=%223%22/%3E%3Ctext x=%2224%22 y=%2233%22 text-anchor=%22middle%22 font-family=%22Georgia,serif%22 font-size=%2228%22 font-weight=%22700%22 fill=%22%23ad7428%22%3Ef%3C/text%3E%3C/svg%3E';

export const RESERVATION_EMAIL_LANGUAGES = ['ca', 'es', 'fr', 'en', 'de', 'nl', 'it'] as const;

export type ReservationEmailLanguage = (typeof RESERVATION_EMAIL_LANGUAGES)[number];

export type BuildReservationConfirmationEmailInput = {
  language?: string | null;
  customerName?: string | null;
  eventDate: string | null;
  entryTime: string | null;
  totalPax: number | null;
  locationUrl?: string | null;
  heroImageUrl?: string | null;
  heroIncludesLogo?: boolean;
  logoImageUrl?: string | null;
  whatsappIconUrl?: string | null;
  whatsappFooterIconUrl?: string | null;
  instagramIconUrl?: string | null;
  facebookIconUrl?: string | null;
  /**
   * Backward-compatible alias for the existing sender. Prefer locationUrl in new code.
   */
  googleMapsUrl?: string | null;
};

export type BuildReservationConfirmationEmailResult = {
  language: ReservationEmailLanguage;
  subject: string;
  html: string;
  text: string;
};

type ReservationEmailTranslation = {
  locale: string;
  subject: string;
  titlePrefix: string;
  titleAccent: string;
  greetingNameFallback: string;
  dateFallback: string;
  timeFallback: string;
  paxFallback: string;
  greeting: (customerName: string) => string;
  confirmation: string;
  labels: {
    date: string;
    time: string;
    people: string;
  };
  helpText: string;
  whatsappCta: string;
  directionsCta: string;
  footerBrand: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    whatsapp: string;
  };
  alt: {
    hero: string;
    logo: string;
  };
};

const TRANSLATIONS: Record<ReservationEmailLanguage, ReservationEmailTranslation> = {
  ca: {
    locale: 'ca-ES',
    subject: 'Reserva confirmada a Sikim Empuriabrava',
    titlePrefix: 'La teva reserva està',
    titleAccent: 'confirmada',
    greetingNameFallback: 'client',
    dateFallback: 'Pendent de concretar',
    timeFallback: 'Pendent de concretar',
    paxFallback: 'Pendent de concretar',
    greeting: (customerName) => `Hola ${customerName},`,
    confirmation: 'la teva reserva a Sikim Empuriabrava està confirmada.',
    labels: {
      date: 'Data',
      time: 'Hora',
      people: 'Persones',
    },
    helpText: 'Si necessites modificar o cancel.lar la reserva, som aquí per ajudar-te.',
    whatsappCta: 'Contactar per WhatsApp',
    directionsCta: 'Com arribar',
    footerBrand: 'Sikim Empuriabrava',
    socialLinks: {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    },
    alt: {
      hero: 'Ambient mediterrani de Sikim Empuriabrava',
      logo: 'Logotip de Sikim Empuriabrava',
    },
  },
  es: {
    locale: 'es-ES',
    subject: 'Reserva confirmada en Sikim Empuriabrava',
    titlePrefix: 'Tu reserva está',
    titleAccent: 'confirmada',
    greetingNameFallback: 'cliente',
    dateFallback: 'Pendiente de concretar',
    timeFallback: 'Pendiente de concretar',
    paxFallback: 'Pendiente de concretar',
    greeting: (customerName) => `Hola ${customerName},`,
    confirmation: 'tu reserva en Sikim Empuriabrava está confirmada.',
    labels: {
      date: 'Fecha',
      time: 'Hora',
      people: 'Personas',
    },
    helpText: 'Si necesitas modificar o cancelar tu reserva, estamos aquí para ayudarte.',
    whatsappCta: 'Contactar por WhatsApp',
    directionsCta: 'Cómo llegar',
    footerBrand: 'Sikim Empuriabrava',
    socialLinks: {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    },
    alt: {
      hero: 'Ambiente mediterráneo de Sikim Empuriabrava',
      logo: 'Logotipo de Sikim Empuriabrava',
    },
  },
  fr: {
    locale: 'fr-FR',
    subject: 'Réservation confirmée chez Sikim Empuriabrava',
    titlePrefix: 'Votre réservation est',
    titleAccent: 'confirmée',
    greetingNameFallback: 'client',
    dateFallback: 'À confirmer',
    timeFallback: 'À confirmer',
    paxFallback: 'À confirmer',
    greeting: (customerName) => `Bonjour ${customerName},`,
    confirmation: 'votre réservation chez Sikim Empuriabrava est confirmée.',
    labels: {
      date: 'Date',
      time: 'Heure',
      people: 'Personnes',
    },
    helpText: 'Si vous devez modifier ou annuler votre réservation, nous sommes là pour vous aider.',
    whatsappCta: 'Contacter par WhatsApp',
    directionsCta: 'Comment arriver',
    footerBrand: 'Sikim Empuriabrava',
    socialLinks: {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    },
    alt: {
      hero: 'Ambiance méditerranéenne de Sikim Empuriabrava',
      logo: 'Logo de Sikim Empuriabrava',
    },
  },
  en: {
    locale: 'en-GB',
    subject: 'Reservation confirmed at Sikim Empuriabrava',
    titlePrefix: 'Your reservation is',
    titleAccent: 'confirmed',
    greetingNameFallback: 'guest',
    dateFallback: 'To be confirmed',
    timeFallback: 'To be confirmed',
    paxFallback: 'To be confirmed',
    greeting: (customerName) => `Hello ${customerName},`,
    confirmation: 'your reservation at Sikim Empuriabrava is confirmed.',
    labels: {
      date: 'Date',
      time: 'Time',
      people: 'People',
    },
    helpText: 'If you need to modify or cancel your reservation, we are here to help.',
    whatsappCta: 'Contact by WhatsApp',
    directionsCta: 'How to get there',
    footerBrand: 'Sikim Empuriabrava',
    socialLinks: {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    },
    alt: {
      hero: 'Mediterranean atmosphere at Sikim Empuriabrava',
      logo: 'Sikim Empuriabrava logo',
    },
  },
  de: {
    locale: 'de-DE',
    subject: 'Reservierung bei Sikim Empuriabrava bestätigt',
    titlePrefix: 'Deine Reservierung ist',
    titleAccent: 'bestätigt',
    greetingNameFallback: 'Gast',
    dateFallback: 'Noch zu bestätigen',
    timeFallback: 'Noch zu bestätigen',
    paxFallback: 'Noch zu bestätigen',
    greeting: (customerName) => `Hallo ${customerName},`,
    confirmation: 'deine Reservierung bei Sikim Empuriabrava ist bestätigt.',
    labels: {
      date: 'Datum',
      time: 'Uhrzeit',
      people: 'Personen',
    },
    helpText: 'Wenn du deine Reservierung ändern oder stornieren musst, helfen wir dir gern.',
    whatsappCta: 'Per WhatsApp kontaktieren',
    directionsCta: 'Anfahrt',
    footerBrand: 'Sikim Empuriabrava',
    socialLinks: {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    },
    alt: {
      hero: 'Mediterranes Ambiente bei Sikim Empuriabrava',
      logo: 'Logo von Sikim Empuriabrava',
    },
  },
  nl: {
    locale: 'nl-NL',
    subject: 'Reservering bevestigd bij Sikim Empuriabrava',
    titlePrefix: 'Je reservering is',
    titleAccent: 'bevestigd',
    greetingNameFallback: 'gast',
    dateFallback: 'Nog te bevestigen',
    timeFallback: 'Nog te bevestigen',
    paxFallback: 'Nog te bevestigen',
    greeting: (customerName) => `Hallo ${customerName},`,
    confirmation: 'je reservering bij Sikim Empuriabrava is bevestigd.',
    labels: {
      date: 'Datum',
      time: 'Tijd',
      people: 'Personen',
    },
    helpText: 'Als je je reservering wilt wijzigen of annuleren, helpen we je graag.',
    whatsappCta: 'Contact via WhatsApp',
    directionsCta: 'Route',
    footerBrand: 'Sikim Empuriabrava',
    socialLinks: {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    },
    alt: {
      hero: 'Mediterrane sfeer bij Sikim Empuriabrava',
      logo: 'Logo van Sikim Empuriabrava',
    },
  },
  it: {
    locale: 'it-IT',
    subject: 'Prenotazione confermata da Sikim Empuriabrava',
    titlePrefix: 'La tua prenotazione è',
    titleAccent: 'confermata',
    greetingNameFallback: 'ospite',
    dateFallback: 'Da confermare',
    timeFallback: 'Da confermare',
    paxFallback: 'Da confermare',
    greeting: (customerName) => `Ciao ${customerName},`,
    confirmation: 'la tua prenotazione da Sikim Empuriabrava è confermata.',
    labels: {
      date: 'Data',
      time: 'Ora',
      people: 'Persone',
    },
    helpText: 'Se devi modificare o cancellare la tua prenotazione, siamo qui per aiutarti.',
    whatsappCta: 'Contattare via WhatsApp',
    directionsCta: 'Come arrivare',
    footerBrand: 'Sikim Empuriabrava',
    socialLinks: {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
    },
    alt: {
      hero: 'Atmosfera mediterranea da Sikim Empuriabrava',
      logo: 'Logo di Sikim Empuriabrava',
    },
  },
};

export type ReservationConfirmationEmailInput = BuildReservationConfirmationEmailInput;
export type ReservationConfirmationEmail = BuildReservationConfirmationEmailResult;

export function normalizeReservationEmailLanguage(value: string | null | undefined): ReservationEmailLanguage {
  const normalized = value?.trim().toLowerCase().replace('_', '-').split('-')[0];

  return RESERVATION_EMAIL_LANGUAGES.includes(normalized as ReservationEmailLanguage)
    ? (normalized as ReservationEmailLanguage)
    : 'es';
}

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

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (isoDateMatch) {
    const [, yearValue, monthValue, dayValue] = isoDateMatch;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
      ? parsed
      : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForCustomer(value: string | null | undefined, translation: ReservationEmailTranslation) {
  const parsed = parseDate(value);

  if (!parsed) {
    return normalizeDisplayText(value, translation.dateFallback);
  }

  return new Intl.DateTimeFormat(translation.locale, {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatTimeForCustomer(value: string | null | undefined, translation: ReservationEmailTranslation) {
  const normalized = normalizeDisplayText(value, translation.timeFallback);
  return /^\d{2}:\d{2}/.test(normalized) ? normalized.slice(0, 5) : normalized;
}

function formatPaxForCustomer(value: number | null | undefined, translation: ReservationEmailTranslation) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? String(Math.floor(value))
    : translation.paxFallback;
}

function getSafeHttpsUrl(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return fallback;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function getOptionalImageUrl(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function getOptionalEmailImageSrc(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(normalized)) {
    return normalized;
  }

  return getOptionalImageUrl(normalized);
}

function renderHero(input: {
  heroImageUrl: string | null;
  heroIncludesLogo: boolean;
  logoImageUrl: string | null;
  translation: ReservationEmailTranslation;
}) {
  const logo = input.logoImageUrl
    ? `<img src="${escapeHtml(input.logoImageUrl)}" width="168" alt="${escapeHtml(
        input.translation.alt.logo,
      )}" style="display:block; width:168px; max-width:168px; height:auto; margin:0 auto; border:0;">`
    : `<div style="font-family:Georgia, 'Times New Roman', serif; font-size:54px; line-height:1; font-weight:bold; color:#fffaf1; letter-spacing:0.01em;">Sikim</div>
       <div style="padding-top:8px; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:1.2; letter-spacing:0.34em; color:#d7ae74;">EMPURIABRAVA</div>`;

  if (input.heroImageUrl) {
    const heroRow = `<tr>
      <td style="padding:0; background:#fff7ef;">
        <img src="${escapeHtml(input.heroImageUrl)}" width="640" alt="${escapeHtml(
          input.translation.alt.hero,
        )}" style="display:block; width:100%; max-width:640px; height:auto; border:0; margin:0;">
      </td>
    </tr>`;

    if (input.heroIncludesLogo) {
      return heroRow;
    }

    return `${heroRow}
    <tr>
      <td align="center" style="padding:22px 24px 20px; background:#2b2119;">
        ${logo}
      </td>
    </tr>`;
  }

  return `<tr>
    <td align="center" style="padding:54px 24px 46px; background:#2b2119;">
      ${logo}
    </td>
  </tr>`;
}

function renderReservationDetailCell(iconUrl: string, label: string, value: string, isLast = false) {
  return `<td align="center" valign="middle" width="33.33%" height="168" style="padding:22px 14px 24px; height:168px; ${
    isLast ? '' : 'border-right:1px solid #d9b987;'
  }">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:0 0 14px;">
          <img src="${iconUrl}" width="42" height="42" alt="" style="display:block; width:42px; height:42px; border:0; margin:0 auto;">
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:1.2; letter-spacing:0.2em; text-transform:uppercase; color:#a36b21; font-weight:bold;">${escapeHtml(
          label,
        )}</td>
      </tr>
      <tr>
        <td align="center" style="padding-top:15px; font-family:Georgia, 'Times New Roman', serif; font-size:25px; line-height:1.18; color:#171311; text-align:center;">${escapeHtml(
          value,
        )}</td>
      </tr>
    </table>
  </td>`;
}

function buildHtml(input: {
  language: ReservationEmailLanguage;
  translation: ReservationEmailTranslation;
  customerName: string;
  eventDate: string;
  entryTime: string;
  totalPax: string;
  locationUrl: string;
  heroImageUrl: string | null;
  heroIncludesLogo: boolean;
  logoImageUrl: string | null;
  whatsappIconUrl: string;
  whatsappFooterIconUrl: string;
  instagramIconUrl: string;
  facebookIconUrl: string;
}) {
  const preheader = `${input.translation.greeting(input.customerName)} ${input.translation.confirmation}`;
  const titlePadding = input.heroImageUrl && input.heroIncludesLogo ? '0 28px 0' : '30px 28px 0';
  const titleOverlap = input.heroImageUrl && input.heroIncludesLogo ? '-58px' : '0';

  return `<!doctype html>
<html lang="${input.language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(input.translation.subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:#f4eee7; color:#201b18; font-family:Arial, Helvetica, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">${escapeHtml(
      preheader,
    )}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; background:#f4eee7;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:640px; border-collapse:separate; border-spacing:0; background:#fff7ef; border:1px solid #ead8c2; border-radius:18px; overflow:hidden; box-shadow:0 14px 34px rgba(74, 47, 24, 0.15);">
            ${renderHero({
              heroImageUrl: input.heroImageUrl,
              heroIncludesLogo: input.heroIncludesLogo,
              logoImageUrl: input.logoImageUrl,
              translation: input.translation,
            })}
            <tr>
              <td align="center" style="padding:${titlePadding};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%; border-collapse:collapse; margin-top:${titleOverlap};">
                  <tr>
                    <td align="center">
                      <h1 style="margin:0; font-family:Georgia, 'Times New Roman', serif; font-size:46px; line-height:1.08; font-weight:400; color:#171311;">
                        ${escapeHtml(input.translation.titlePrefix)}
                        <span style="color:#d7196f; font-weight:700;">${escapeHtml(input.translation.titleAccent)}</span>
                      </h1>
                      <div style="padding:18px 0 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:collapse;">
                          <tr>
                            <td width="122" style="border-top:1px solid #d8bb91; font-size:1px; line-height:1px;">&nbsp;</td>
                            <td style="padding:0 12px; color:#b8782d; font-size:18px; line-height:1;">&#9671;</td>
                            <td width="122" style="border-top:1px solid #d8bb91; font-size:1px; line-height:1px;">&nbsp;</td>
                          </tr>
                        </table>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 42px 0;">
                <p style="margin:0; font-size:17px; line-height:1.65; color:#1f2428;">
                  ${escapeHtml(input.translation.greeting(input.customerName))}
                  ${escapeHtml(input.translation.confirmation)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 46px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:separate; border-spacing:0; background:#fffaf6; border:1px solid #dcb77d; border-radius:14px; box-shadow:0 8px 18px rgba(140, 92, 39, 0.08);">
                  <tr>
                    ${renderReservationDetailCell(EMAIL_ICON_CALENDAR, input.translation.labels.date, input.eventDate)}
                    ${renderReservationDetailCell(EMAIL_ICON_CLOCK, input.translation.labels.time, input.entryTime)}
                    ${renderReservationDetailCell(
                      EMAIL_ICON_PEOPLE,
                      input.translation.labels.people,
                      input.totalPax,
                      true,
                    )}
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 46px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:separate; border-spacing:0; background:#fff8f5; border:1px solid #ead3c8; border-radius:14px;">
                  <tr>
                    <td align="center" width="104" style="padding:18px 14px;">
                      <a href="${escapeHtml(
                        RESERVATION_EMAIL_WHATSAPP_URL,
                      )}" style="display:inline-block; width:50px; height:50px; border:0; text-decoration:none;">
                        <img src="${escapeHtml(
                          input.whatsappIconUrl,
                        )}" width="50" height="50" alt="WhatsApp" style="display:block; width:50px; height:50px; border:0;">
                      </a>
                    </td>
                    <td width="1" style="background:#e1c4b6; font-size:1px; line-height:1px;">&nbsp;</td>
                    <td style="padding:18px 24px;">
                      <p style="margin:0; font-size:16px; line-height:1.55; color:#1f2428;">
                        ${escapeHtml(input.translation.helpText)}
                        <a href="${escapeHtml(
                          RESERVATION_EMAIL_WHATSAPP_URL,
                        )}" style="color:#0a8f35; text-decoration:none; font-weight:bold;">${escapeHtml(
                          input.translation.whatsappCta,
                        )}</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 28px 26px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:separate; border-spacing:0;">
                  <tr>
                    <td align="center" bgcolor="#b8792e" width="330" style="border-radius:9px; box-shadow:0 4px 10px rgba(135, 84, 28, 0.24);">
                      <a href="${escapeHtml(
                        input.locationUrl,
                      )}" style="display:block; padding:15px 20px; border-radius:9px; background:#b8792e; color:#fffdf8; font-family:Georgia, 'Times New Roman', serif; font-size:18px; line-height:1.2; letter-spacing:0.12em; text-transform:uppercase; text-decoration:none;">
                        <img src="${EMAIL_ICON_LOCATION}" width="22" height="22" alt="" style="display:inline-block; width:22px; height:22px; border:0; vertical-align:-5px;">&nbsp;&nbsp;${escapeHtml(
                          input.translation.directionsCta,
                        )}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="border-top:1px solid #d8bb91; font-size:1px; line-height:1px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 28px 28px;">
                <p style="margin:0 0 12px; font-family:Georgia, 'Times New Roman', serif; font-size:21px; line-height:1.2; color:#1f1b18; font-weight:bold;">${escapeHtml(
                  input.translation.footerBrand,
                )}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:separate; border-spacing:10px 0;">
                  <tr>
                    <td align="center"><a href="${escapeHtml(
                      RESERVATION_EMAIL_INSTAGRAM_URL,
                    )}" style="display:inline-block; width:34px; height:34px; text-decoration:none;"><img src="${escapeHtml(
                      input.instagramIconUrl,
                    )}" width="34" height="34" alt="${escapeHtml(
                      input.translation.socialLinks.instagram,
                    )}" style="display:block; width:34px; height:34px; border:0;"></a></td>
                    <td align="center"><a href="${escapeHtml(
                      RESERVATION_EMAIL_FACEBOOK_URL,
                    )}" style="display:inline-block; width:34px; height:34px; text-decoration:none;"><img src="${escapeHtml(
                      input.facebookIconUrl,
                    )}" width="34" height="34" alt="${escapeHtml(
                      input.translation.socialLinks.facebook,
                    )}" style="display:block; width:34px; height:34px; border:0;"></a></td>
                    <td align="center"><a href="${escapeHtml(
                      RESERVATION_EMAIL_WHATSAPP_URL,
                    )}" style="display:inline-block; width:34px; height:34px; text-decoration:none;"><img src="${escapeHtml(
                      input.whatsappFooterIconUrl,
                    )}" width="34" height="34" alt="${escapeHtml(
                      input.translation.socialLinks.whatsapp,
                    )}" style="display:block; width:34px; height:34px; border:0;"></a></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(input: {
  translation: ReservationEmailTranslation;
  customerName: string;
  eventDate: string;
  entryTime: string;
  totalPax: string;
  locationUrl: string;
}) {
  return [
    input.translation.subject,
    '',
    `${input.translation.greeting(input.customerName)} ${input.translation.confirmation}`,
    '',
    `${input.translation.labels.date}: ${input.eventDate}`,
    `${input.translation.labels.time}: ${input.entryTime}`,
    `${input.translation.labels.people}: ${input.totalPax}`,
    '',
    input.translation.helpText,
    `${input.translation.whatsappCta}: ${RESERVATION_EMAIL_WHATSAPP_URL}`,
    '',
    `${input.translation.directionsCta}: ${input.locationUrl}`,
    '',
    input.translation.footerBrand,
    `${input.translation.socialLinks.instagram}: ${RESERVATION_EMAIL_INSTAGRAM_URL}`,
    `${input.translation.socialLinks.facebook}: ${RESERVATION_EMAIL_FACEBOOK_URL}`,
    `${input.translation.socialLinks.whatsapp}: ${RESERVATION_EMAIL_WHATSAPP_URL}`,
  ].join('\n');
}

export function buildReservationConfirmationEmail(
  input: BuildReservationConfirmationEmailInput,
): BuildReservationConfirmationEmailResult {
  const language = normalizeReservationEmailLanguage(input.language);
  const translation = TRANSLATIONS[language];
  const customerName = normalizeDisplayText(input.customerName, translation.greetingNameFallback);
  const eventDate = formatDateForCustomer(input.eventDate, translation);
  const entryTime = formatTimeForCustomer(input.entryTime, translation);
  const totalPax = formatPaxForCustomer(input.totalPax, translation);
  const locationUrl = getSafeHttpsUrl(
    input.locationUrl ?? input.googleMapsUrl,
    DEFAULT_RESERVATION_EMAIL_LOCATION_URL,
  );
  const heroImageUrl = getOptionalImageUrl(input.heroImageUrl);
  const heroIncludesLogo = input.heroIncludesLogo === true;
  const logoImageUrl = getOptionalImageUrl(input.logoImageUrl);
  const whatsappIconUrl = getOptionalEmailImageSrc(input.whatsappIconUrl) ?? EMAIL_ICON_WHATSAPP;
  const whatsappFooterIconUrl = getOptionalEmailImageSrc(input.whatsappFooterIconUrl) ?? whatsappIconUrl;
  const instagramIconUrl = getOptionalEmailImageSrc(input.instagramIconUrl) ?? EMAIL_ICON_INSTAGRAM;
  const facebookIconUrl = getOptionalEmailImageSrc(input.facebookIconUrl) ?? EMAIL_ICON_FACEBOOK;

  return {
    language,
    subject: translation.subject,
    html: buildHtml({
      language,
      translation,
      customerName,
      eventDate,
      entryTime,
      totalPax,
      locationUrl,
      heroImageUrl,
      heroIncludesLogo,
      logoImageUrl,
      whatsappIconUrl,
      whatsappFooterIconUrl,
      instagramIconUrl,
      facebookIconUrl,
    }),
    text: buildText({
      translation,
      customerName,
      eventDate,
      entryTime,
      totalPax,
      locationUrl,
    }),
  };
}
