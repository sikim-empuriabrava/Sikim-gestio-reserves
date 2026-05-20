import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getContactDisplayValue, normalizeEmail, normalizePhone, type CustomerContactType } from './normalize';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ReservationCustomerSnapshot = {
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_email?: unknown;
};

type ContactRow = {
  customer_id: string;
};

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function findCustomerByContact(
  supabase: SupabaseAdminClient,
  contactType: CustomerContactType,
  normalizedValue: string | null,
) {
  if (!normalizedValue) return null;

  const { data, error } = await supabase
    .from('customer_contacts')
    .select('customer_id')
    .eq('contact_type', contactType)
    .eq('normalized_value', normalizedValue)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<ContactRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data?.customer_id ?? null;
}

async function ensureContact(
  supabase: SupabaseAdminClient,
  customerId: string,
  contactType: CustomerContactType,
  contactValue: string | null,
  normalizedValue: string | null,
) {
  if (!contactValue || !normalizedValue) return;

  const { data: existingPrimary, error: primaryError } = await supabase
    .from('customer_contacts')
    .select('id')
    .eq('customer_id', customerId)
    .eq('contact_type', contactType)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (primaryError) {
    throw new Error(primaryError.message);
  }

  const { error } = await supabase.from('customer_contacts').upsert(
    {
      customer_id: customerId,
      contact_type: contactType,
      contact_value: contactValue,
      normalized_value: normalizedValue,
      is_primary: !existingPrimary,
    },
    {
      onConflict: 'customer_id,contact_type,normalized_value',
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function findOrCreateCustomerForSnapshot(
  supabase: SupabaseAdminClient,
  snapshot: ReservationCustomerSnapshot,
) {
  const customerName = nullableString(snapshot.customer_name);
  const customerPhone = nullableString(snapshot.customer_phone);
  const customerEmail = nullableString(snapshot.customer_email);
  const normalizedEmail = normalizeEmail(customerEmail);
  const normalizedPhone = normalizePhone(customerPhone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  let customerId = await findCustomerByContact(supabase, 'email', normalizedEmail);
  if (!customerId) {
    customerId = await findCustomerByContact(supabase, 'phone', normalizedPhone);
  }

  if (!customerId) {
    const displayName = customerName ?? customerEmail ?? customerPhone ?? 'Cliente';
    const { data, error } = await supabase
      .from('customers')
      .insert({
        display_name: displayName,
        source: 'reservation',
      })
      .select('id')
      .single<{ id: string }>();

    if (error || !data) {
      throw new Error(error?.message ?? 'Unable to create customer');
    }

    customerId = data.id;
  }

  await ensureContact(supabase, customerId, 'email', getContactDisplayValue(customerEmail), normalizedEmail);
  await ensureContact(supabase, customerId, 'phone', getContactDisplayValue(customerPhone), normalizedPhone);

  return customerId;
}

export async function linkGroupEventCustomerFromSnapshot(
  groupEventId: string,
  snapshot?: ReservationCustomerSnapshot,
  supabase = createSupabaseAdminClient(),
) {
  let customerSnapshot = snapshot;

  if (!customerSnapshot) {
    const { data, error } = await supabase
      .from('group_events')
      .select('customer_name, customer_phone, customer_email')
      .eq('id', groupEventId)
      .single<ReservationCustomerSnapshot>();

    if (error || !data) {
      throw new Error(error?.message ?? 'Unable to fetch reservation customer snapshot');
    }

    customerSnapshot = data;
  }

  const customerId = await findOrCreateCustomerForSnapshot(supabase, customerSnapshot);
  const { error } = await supabase
    .from('group_events')
    .update({ customer_id: customerId })
    .eq('id', groupEventId);

  if (error) {
    throw new Error(error.message);
  }

  return customerId;
}
