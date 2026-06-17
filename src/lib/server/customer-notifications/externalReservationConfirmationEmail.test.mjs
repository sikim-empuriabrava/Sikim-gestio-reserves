import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let ts = null;

try {
  ts = require('typescript');
} catch {
  ts = null;
}

const notificationsDir = join(process.cwd(), 'src', 'lib', 'server', 'customer-notifications');
const templatePath = join(notificationsDir, 'reservationConfirmationEmailTemplate.ts');
const senderPath = join(notificationsDir, 'externalReservationConfirmationEmail.ts');

const templateUrl = pathToFileURL(templatePath).href;

function compileTsModule(filePath, customRequire = require) {
  const source = readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const compiledModule = { exports: {} };
  const loadModule = new Function('exports', 'module', 'require', '__filename', '__dirname', compiled.outputText);
  loadModule(compiledModule.exports, compiledModule, customRequire, filePath, notificationsDir);
  return compiledModule.exports;
}

async function loadSenderModule() {
  if (ts) {
    const templateExports = compileTsModule(templatePath);

    return compileTsModule(senderPath, (specifier) => {
      if (specifier === 'server-only') {
        return {};
      }

      if (specifier === '@/lib/supabaseAdmin') {
        return {
          createSupabaseAdminClient() {
            throw new Error('Tests inject a Supabase client explicitly.');
          },
        };
      }

      if (specifier === './reservationConfirmationEmailTemplate') {
        return templateExports;
      }

      return require(specifier);
    });
  }

  const senderSource = readFileSync(senderPath, 'utf8')
    .replace(/import 'server-only';\r?\n\r?\n/, '')
    .replace(/import type .*?;\r?\n/g, '')
    .replace(
      /import \{ createSupabaseAdminClient \} from '@\/lib\/supabaseAdmin';\r?\n/,
      "function createSupabaseAdminClient() { throw new Error('Tests inject a Supabase client explicitly.'); }\n",
    )
    .replace(
      /import \{([\s\S]*?)\} from '\.\/reservationConfirmationEmailTemplate';\r?\n/,
      (_, imports) => `import {${imports}} from '${templateUrl}';\n`,
    );
  const generatedDir = mkdtempSync(join(tmpdir(), 'sikim-email-test-'));
  const generatedSenderPath = join(generatedDir, 'externalReservationConfirmationEmail.generated.mts');
  writeFileSync(generatedSenderPath, senderSource);

  return import(pathToFileURL(generatedSenderPath).href);
}

const { sendExternalReservationConfirmationEmail } = await loadSenderModule();

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function restoreGlobals() {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
}

function assertNoBrokenImageSrcs(html, context) {
  assert.ok(!html.includes('src=""'), `${context} should not include empty image sources`);
  assert.ok(!html.includes('src="undefined"'), `${context} should not include undefined image sources`);
  assert.ok(!html.includes('src="null"'), `${context} should not include null image sources`);
}

function getDirectionsLinkInnerHtml(html, locationUrl) {
  const escapedHref = locationUrl.replaceAll('&', '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<a href="${escapedHref}"[^>]*>([\\s\\S]*?)<\\/a>`));

  assert.ok(match, 'expected to find the directions CTA link in the Resend payload');
  return match[1];
}

function createSupabaseDouble({
  reservation = {},
  submission = {},
  updateError = null,
} = {}) {
  const updates = [];
  const calls = [];
  const groupEvent = {
    id: 'group-event-1',
    customer_name: 'Laura',
    customer_email: ' Laura@example.com ',
    event_date: '2026-06-21',
    entry_time: '21:30:00',
    adults: 3,
    children: 1,
    total_pax: null,
    status: 'confirmed',
    ...reservation,
  };
  const externalSubmission =
    submission === null
      ? null
      : {
          id: 'submission-1',
          group_event_id: groupEvent.id,
          preferred_language: 'fr',
          confirmation_email_sent_at: null,
          confirmation_email_attempted_at: null,
          confirmation_email_to: null,
          confirmation_email_language: null,
          confirmation_email_provider: null,
          confirmation_email_provider_id: null,
          confirmation_email_error: null,
          ...submission,
        };

  const supabase = {
    updates,
    calls,
    from(tableName) {
      calls.push({ type: 'from', tableName });
      const state = {
        tableName,
        patch: null,
      };
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          if (state.tableName === 'group_events') {
            return { data: groupEvent, error: null };
          }

          if (state.tableName === 'external_reservation_submissions') {
            return { data: externalSubmission, error: null };
          }

          return { data: null, error: null };
        },
        update(patch) {
          state.patch = patch;
          return builder;
        },
        async then(resolve, reject) {
          try {
            if (state.patch) {
              updates.push({ tableName: state.tableName, patch: state.patch });
              resolve({ error: updateError });
              return;
            }

            resolve({ data: null, error: null });
          } catch (error) {
            reject(error);
          }
        },
      };
      return builder;
    },
  };

  return supabase;
}

async function withEnv(env, testFn) {
  restoreGlobals();
  process.env = {
    ...originalEnv,
    RESERVATION_EMAIL_CONFIRMATIONS_ENABLED: 'true',
    RESEND_API_KEY: 'test-api-key',
    RESERVATION_EMAIL_FROM: 'Sikim Empuriabrava <booking@sikimempuriabrava.com>',
    RESERVATION_EMAIL_REPLY_TO: 'booking@sikimempuriabrava.com',
    ...env,
  };

  try {
    await testFn();
  } finally {
    restoreGlobals();
  }
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('does not send or update tracking when confirmation_email_sent_at already exists', async () => {
  await withEnv({}, async () => {
    const supabase = createSupabaseDouble({
      submission: { confirmation_email_sent_at: '2026-06-16T10:00:00.000Z' },
    });
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ id: 'email-id' }), { status: 200 });
    };

    await sendExternalReservationConfirmationEmail('group-event-1', supabase);

    assert.equal(fetchCalls, 0);
    assert.deepEqual(supabase.updates, []);
  });
});

test('does not send or update tracking when reservation status is not confirmed', async () => {
  await withEnv({}, async () => {
    const supabase = createSupabaseDouble({
      reservation: { status: 'pending' },
    });
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ id: 'email-id' }), { status: 200 });
    };

    await sendExternalReservationConfirmationEmail('group-event-1', supabase);

    assert.equal(fetchCalls, 0);
    assert.deepEqual(supabase.updates, []);
  });
});

test('uses preferred_language from external submission and falls back to es when invalid or null', async () => {
  await withEnv({}, async () => {
    const supabase = createSupabaseDouble({
      submission: { preferred_language: 'de-DE' },
    });
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 'resend-1' }), { status: 200 });

    await sendExternalReservationConfirmationEmail('group-event-1', supabase);

    assert.equal(supabase.updates.at(-1).patch.confirmation_email_language, 'de');
  });

  await withEnv({}, async () => {
    const supabase = createSupabaseDouble({
      submission: { preferred_language: 'pt-BR' },
    });
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 'resend-2' }), { status: 200 });

    await sendExternalReservationConfirmationEmail('group-event-1', supabase);

    assert.equal(supabase.updates.at(-1).patch.confirmation_email_language, 'es');
  });

  await withEnv({}, async () => {
    const supabase = createSupabaseDouble({
      submission: { preferred_language: null },
    });
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 'resend-3' }), { status: 200 });

    await sendExternalReservationConfirmationEmail('group-event-1', supabase);

    assert.equal(supabase.updates.at(-1).patch.confirmation_email_language, 'es');
  });
});

test('records an error and skips Resend when the customer email is missing or invalid', async () => {
  await withEnv({}, async () => {
    const supabase = createSupabaseDouble({
      reservation: { customer_email: 'not-an-email' },
      submission: { preferred_language: 'en' },
    });
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ id: 'email-id' }), { status: 200 });
    };

    await sendExternalReservationConfirmationEmail('group-event-1', supabase);

    assert.equal(fetchCalls, 0);
    assert.equal(supabase.updates.length, 1);
    assert.equal(supabase.updates[0].tableName, 'external_reservation_submissions');
    assert.equal(supabase.updates[0].patch.confirmation_email_error, 'Missing or invalid customer email.');
    assert.equal(supabase.updates[0].patch.confirmation_email_to, 'not-an-email');
    assert.equal(supabase.updates[0].patch.confirmation_email_language, 'en');
  });
});

test('records an error and skips Resend when the provider is not configured', async () => {
  await withEnv(
    {
      RESEND_API_KEY: '',
    },
    async () => {
      const supabase = createSupabaseDouble();
      let fetchCalls = 0;
      globalThis.fetch = async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ id: 'email-id' }), { status: 200 });
      };

      await sendExternalReservationConfirmationEmail('group-event-1', supabase);

      assert.equal(fetchCalls, 0);
      assert.equal(supabase.updates.length, 1);
      assert.equal(supabase.updates[0].patch.confirmation_email_error, 'Email provider is not configured');
      assert.equal(supabase.updates[0].patch.confirmation_email_provider, 'resend');
      assert.equal(supabase.updates[0].patch.confirmation_email_provider_id, null);
    },
  );
});

test('on success sends html and text to Resend and records sent tracking with provider id', async () => {
  await withEnv({
    RESERVATION_EMAIL_HERO_IMAGE_URL: 'https://cdn.example.com/sikim-hero.jpg',
    RESERVATION_EMAIL_HERO_INCLUDES_LOGO: 'true',
    RESERVATION_EMAIL_LOGO_IMAGE_URL: 'https://cdn.example.com/sikim-logo.png',
    RESERVATION_EMAIL_WHATSAPP_ICON_URL: 'https://cdn.example.com/whatsapp.png',
    RESERVATION_EMAIL_WHATSAPP_HELP_ICON_URL: 'https://cdn.example.com/whatsapp-help.png',
    RESERVATION_EMAIL_INSTAGRAM_ICON_URL: 'https://cdn.example.com/instagram.png',
    RESERVATION_EMAIL_FACEBOOK_ICON_URL: 'https://cdn.example.com/facebook.png',
  }, async () => {
    const supabase = createSupabaseDouble({
      submission: { preferred_language: 'fr' },
    });
    let request = null;
    globalThis.fetch = async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: 'resend-message-123' }), { status: 200 });
    };

    await sendExternalReservationConfirmationEmail('group-event-1', supabase);

    assert.equal(request.url, 'https://api.resend.com/emails');
    const payload = JSON.parse(request.init.body);
    assert.equal(payload.subject, 'Réservation confirmée chez Sikim Empuriabrava');
    assert.ok(payload.html.length > 0);
    assert.ok(payload.text.length > 0);
    assert.ok(payload.html.includes('https://cdn.example.com/sikim-hero.jpg'));
    assert.ok(!payload.html.includes('https://cdn.example.com/sikim-logo.png'));
    assert.ok(payload.html.includes('https://cdn.example.com/whatsapp-help.png'));
    assert.ok(payload.html.includes('https://cdn.example.com/whatsapp.png'));
    assert.ok(payload.html.includes('https://cdn.example.com/instagram.png'));
    assert.ok(payload.html.includes('https://cdn.example.com/facebook.png'));
    assert.ok(!payload.html.includes('data:image/svg+xml'));
    assertNoBrokenImageSrcs(payload.html, 'Resend payload html');
    const directionsLinkInnerHtml = getDirectionsLinkInnerHtml(
      payload.html,
      'https://www.google.com/maps/search/?api=1&query=Sikim%20Empuriabrava',
    );
    assert.ok(!directionsLinkInnerHtml.includes('<img'));
    assert.equal(request.init.headers['Idempotency-Key'], 'external-reservation-confirmation-group-event-1');
    assert.equal(supabase.updates.length, 1);
    assert.ok(supabase.updates[0].patch.confirmation_email_sent_at);
    assert.ok(supabase.updates[0].patch.confirmation_email_attempted_at);
    assert.equal(supabase.updates[0].patch.confirmation_email_to, 'Laura@example.com');
    assert.equal(supabase.updates[0].patch.confirmation_email_provider, 'resend');
    assert.equal(supabase.updates[0].patch.confirmation_email_provider_id, 'resend-message-123');
    assert.equal(supabase.updates[0].patch.confirmation_email_error, null);
  });
});

test('on Resend failure records a short error without throwing', async () => {
  await withEnv({}, async () => {
    const supabase = createSupabaseDouble();
    const originalConsoleError = console.error;
    const errorLogs = [];
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'Bad sender domain from provider payload' }), { status: 400 });

    console.error = (...args) => {
      errorLogs.push(args);
    };

    try {
      await sendExternalReservationConfirmationEmail('group-event-1', supabase);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(supabase.updates.length, 1);
    assert.equal(supabase.updates[0].patch.confirmation_email_sent_at, null);
    assert.equal(supabase.updates[0].patch.confirmation_email_provider_id, null);
    assert.equal(supabase.updates[0].patch.confirmation_email_error, 'Bad sender domain from provider payload');
    assert.equal(errorLogs.length, 1);
  });
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

console.log('externalReservationConfirmationEmail tests passed');
