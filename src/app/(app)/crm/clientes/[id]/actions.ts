'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { requireCrmWriteAccess } from '@/lib/crm/access';
import { getContactDisplayValue, normalizeContactValue, type CustomerContactType } from '@/lib/crm/normalize';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readContactType(formData: FormData): CustomerContactType {
  const value = readString(formData, 'contact_type');
  if (value !== 'phone' && value !== 'email') {
    throw new Error('Tipo de contacto no valido');
  }
  return value;
}

async function ensureAdmin(customerId: string) {
  await requireCrmWriteAccess(`/crm/clientes/${customerId}`);
}

async function promoteFallbackPrimary(customerId: string, contactType: CustomerContactType) {
  const supabase = createSupabaseAdminClient();
  const { data: currentPrimary, error: primaryError } = await supabase
    .from('customer_contacts')
    .select('id')
    .eq('customer_id', customerId)
    .eq('contact_type', contactType)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (primaryError) throw new Error(primaryError.message);
  if (currentPrimary) return;

  const { data: fallback, error: fallbackError } = await supabase
    .from('customer_contacts')
    .select('id')
    .eq('customer_id', customerId)
    .eq('contact_type', contactType)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (fallbackError) throw new Error(fallbackError.message);
  if (!fallback) return;

  const { error } = await supabase
    .from('customer_contacts')
    .update({ is_primary: true })
    .eq('id', fallback.id);

  if (error) throw new Error(error.message);
}

export async function updateCustomerDetails(formData: FormData) {
  const customerId = readString(formData, 'customer_id');
  await ensureAdmin(customerId);

  const displayName = readString(formData, 'display_name');
  const notes = readString(formData, 'notes');

  if (!displayName) {
    throw new Error('El nombre visible es obligatorio');
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('customers')
    .update({
      display_name: displayName,
      notes: notes || null,
    })
    .eq('id', customerId);

  if (error) throw new Error(error.message);

  revalidatePath('/crm');
  revalidatePath(`/crm/clientes/${customerId}`);
  redirect(`/crm/clientes/${customerId}`);
}

export async function addCustomerContact(formData: FormData) {
  const customerId = readString(formData, 'customer_id');
  await ensureAdmin(customerId);

  const contactType = readContactType(formData);
  const contactValue = readString(formData, 'contact_value');
  const normalizedValue = normalizeContactValue(contactType, contactValue);

  if (!contactValue || !normalizedValue) {
    throw new Error('El contacto no es valido');
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingPrimary, error: primaryError } = await supabase
    .from('customer_contacts')
    .select('id')
    .eq('customer_id', customerId)
    .eq('contact_type', contactType)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (primaryError) throw new Error(primaryError.message);

  const { error } = await supabase.from('customer_contacts').insert({
    customer_id: customerId,
    contact_type: contactType,
    contact_value: getContactDisplayValue(contactValue),
    normalized_value: normalizedValue,
    is_primary: !existingPrimary,
  });

  if (error && error.code !== '23505') throw new Error(error.message);

  revalidatePath('/crm');
  revalidatePath(`/crm/clientes/${customerId}`);
  redirect(`/crm/clientes/${customerId}`);
}

export async function deleteCustomerContact(formData: FormData) {
  const customerId = readString(formData, 'customer_id');
  await ensureAdmin(customerId);

  const contactId = readString(formData, 'contact_id');
  const contactType = readContactType(formData);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('id', contactId)
    .eq('customer_id', customerId);

  if (error) throw new Error(error.message);

  await promoteFallbackPrimary(customerId, contactType);

  revalidatePath('/crm');
  revalidatePath(`/crm/clientes/${customerId}`);
  redirect(`/crm/clientes/${customerId}`);
}

export async function markCustomerContactPrimary(formData: FormData) {
  const customerId = readString(formData, 'customer_id');
  await ensureAdmin(customerId);

  const contactId = readString(formData, 'contact_id');
  const contactType = readContactType(formData);

  const supabase = createSupabaseAdminClient();
  const { error: clearError } = await supabase
    .from('customer_contacts')
    .update({ is_primary: false })
    .eq('customer_id', customerId)
    .eq('contact_type', contactType);

  if (clearError) throw new Error(clearError.message);

  const { error } = await supabase
    .from('customer_contacts')
    .update({ is_primary: true })
    .eq('id', contactId)
    .eq('customer_id', customerId)
    .eq('contact_type', contactType);

  if (error) throw new Error(error.message);

  revalidatePath('/crm');
  revalidatePath(`/crm/clientes/${customerId}`);
  redirect(`/crm/clientes/${customerId}`);
}
