import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let ts = null;

try {
  ts = require('typescript');
} catch {
  ts = null;
}

const templatePath = join(
  process.cwd(),
  'src',
  'lib',
  'server',
  'customer-notifications',
  'reservationConfirmationEmailTemplate.ts',
);

const moduleUrl = pathToFileURL(templatePath).href;
async function loadTemplateModule() {
  if (!ts) {
    return import(moduleUrl);
  }

  const source = readFileSync(templatePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const compiledModule = { exports: {} };
  const loadTemplate = new Function('exports', 'module', 'require', '__filename', '__dirname', compiled.outputText);

  loadTemplate(compiledModule.exports, compiledModule, require, templatePath, process.cwd());
  return compiledModule.exports;
}

const {
  buildReservationConfirmationEmail,
  normalizeReservationEmailLanguage,
  RESERVATION_EMAIL_LANGUAGES,
  RESERVATION_EMAIL_WHATSAPP_URL,
  RESERVATION_EMAIL_INSTAGRAM_URL,
  RESERVATION_EMAIL_FACEBOOK_URL,
  DEFAULT_RESERVATION_EMAIL_LOCATION_URL,
} = await loadTemplateModule();

const baseInput = {
  customerName: 'Laura',
  eventDate: '2026-06-21',
  entryTime: '21:30:00',
  totalPax: 4,
  locationUrl: 'https://www.google.com/maps/search/?api=1&query=Sikim%20Empuriabrava',
  heroImageUrl: 'https://cdn.example.com/sikim-hero.jpg',
  logoImageUrl: 'https://cdn.example.com/sikim-logo.png',
};

assert.equal(moduleUrl.endsWith('reservationConfirmationEmailTemplate.ts'), true);
assert.equal(normalizeReservationEmailLanguage('pt-BR'), 'es');
assert.equal(normalizeReservationEmailLanguage('EN_us'), 'en');

for (const language of RESERVATION_EMAIL_LANGUAGES) {
  const email = buildReservationConfirmationEmail({ ...baseInput, language });

  assert.equal(email.language, language);
  assert.ok(email.subject.length > 0, `${language} subject should not be empty`);
  assert.ok(email.html.length > 0, `${language} html should not be empty`);
  assert.ok(email.text.length > 0, `${language} text should not be empty`);
  assert.ok(email.html.includes('Sikim Empuriabrava'), `${language} should include brand`);
  assert.ok(email.html.includes('Laura'), `${language} should include customer name`);
  assert.ok(email.html.includes('21:30'), `${language} should include time`);
  assert.ok(email.html.includes('4'), `${language} should include pax`);
  assert.ok(!email.html.includes('Sala'), `${language} html must not include Sala`);
  assert.ok(!email.text.includes('Sala'), `${language} text must not include Sala`);
  assert.ok(!email.html.includes('Ver reserva'), `${language} html must not include Ver reserva`);
  assert.ok(!email.text.includes('Ver reserva'), `${language} text must not include Ver reserva`);
  assert.ok(!email.html.includes('Te esperamos'), `${language} html must not include removed sentence`);
  assert.ok(!email.text.includes('Te esperamos'), `${language} text must not include removed sentence`);
  assert.ok(email.text.includes(RESERVATION_EMAIL_WHATSAPP_URL), `${language} text should include WhatsApp`);
  assert.ok(
    email.html.includes(RESERVATION_EMAIL_WHATSAPP_URL.replaceAll('&', '&amp;')),
    `${language} html should include WhatsApp`,
  );
  assert.ok(email.text.includes(RESERVATION_EMAIL_INSTAGRAM_URL), `${language} text should include Instagram`);
  assert.ok(email.text.includes(RESERVATION_EMAIL_FACEBOOK_URL), `${language} text should include Facebook`);
  assert.ok(email.html.includes('href='), `${language} html should include CTA links`);
}

const fallbackEmail = buildReservationConfirmationEmail({ ...baseInput, language: 'unknown' });
assert.equal(fallbackEmail.language, 'es');
assert.equal(fallbackEmail.subject, 'Reserva confirmada en Sikim Empuriabrava');
assert.ok(fallbackEmail.html.includes('Cómo llegar'));

const formattedEmail = buildReservationConfirmationEmail({ ...baseInput, language: 'es' });
assert.ok(formattedEmail.html.includes('domingo, 21 de junio de 2026'));
assert.ok(formattedEmail.text.includes('Fecha: domingo, 21 de junio de 2026'));
assert.ok(formattedEmail.html.includes('Fecha'));
assert.ok(formattedEmail.html.includes('Hora'));
assert.ok(formattedEmail.html.includes('Personas'));
assert.ok(formattedEmail.html.includes('WhatsApp'));
assert.ok(formattedEmail.html.includes('Cómo llegar'));
assert.ok(!formattedEmail.html.includes('&#9586;'));

const precomposedHeroEmail = buildReservationConfirmationEmail({
  ...baseInput,
  language: 'es',
  heroIncludesLogo: true,
});
assert.ok(precomposedHeroEmail.html.includes('https://cdn.example.com/sikim-hero.jpg'));
assert.ok(!precomposedHeroEmail.html.includes('https://cdn.example.com/sikim-logo.png'));

const separateLogoEmail = buildReservationConfirmationEmail({
  ...baseInput,
  language: 'es',
  heroIncludesLogo: false,
});
assert.ok(separateLogoEmail.html.includes('https://cdn.example.com/sikim-hero.jpg'));
assert.ok(separateLogoEmail.html.includes('https://cdn.example.com/sikim-logo.png'));

const noHeroFallbackEmail = buildReservationConfirmationEmail({
  ...baseInput,
  language: 'es',
  heroImageUrl: null,
  heroIncludesLogo: true,
});
assert.ok(!noHeroFallbackEmail.html.includes('https://cdn.example.com/sikim-hero.jpg'));
assert.ok(noHeroFallbackEmail.html.includes('https://cdn.example.com/sikim-logo.png'));

const customIconEmail = buildReservationConfirmationEmail({
  ...baseInput,
  language: 'es',
  whatsappIconUrl: 'https://cdn.example.com/whatsapp.png',
  whatsappFooterIconUrl: 'https://cdn.example.com/whatsapp-footer.png',
  instagramIconUrl: 'https://cdn.example.com/instagram.png',
  facebookIconUrl: 'https://cdn.example.com/facebook.png',
});
assert.ok(customIconEmail.html.includes('https://cdn.example.com/whatsapp.png'));
assert.ok(customIconEmail.html.includes('https://cdn.example.com/whatsapp-footer.png'));
assert.ok(customIconEmail.html.includes('https://cdn.example.com/instagram.png'));
assert.ok(customIconEmail.html.includes('https://cdn.example.com/facebook.png'));

const unsafeEmail = buildReservationConfirmationEmail({
  language: 'es',
  customerName: '<Laura & "VIP">',
  eventDate: '<not-a-date>',
  entryTime: '<21:30>',
  totalPax: 4,
  locationUrl: 'javascript:alert(1)',
  heroImageUrl: 'javascript:alert(2)',
  logoImageUrl: 'javascript:alert(3)',
});

assert.ok(unsafeEmail.html.includes('&lt;Laura &amp; &quot;VIP&quot;&gt;'));
assert.ok(!unsafeEmail.html.includes('<Laura & "VIP">'));
assert.ok(unsafeEmail.html.includes('&lt;not-a-date&gt;'));
assert.ok(unsafeEmail.html.includes('&lt;21:30&gt;'));
assert.ok(!unsafeEmail.html.includes('javascript:alert'));
assert.ok(unsafeEmail.html.includes(DEFAULT_RESERVATION_EMAIL_LOCATION_URL.replaceAll('&', '&amp;')));

console.log('reservationConfirmationEmailTemplate tests passed');
