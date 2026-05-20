import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { normalizeEmail, normalizePhone } from './normalize';

export type CrmCustomer = {
  id: string;
  display_name: string;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmContact = {
  id: string;
  customer_id: string;
  contact_type: 'phone' | 'email';
  contact_value: string;
  normalized_value: string;
  is_primary: boolean;
  created_at: string;
};

export type CrmReservation = {
  id: string;
  customer_id: string | null;
  name: string;
  event_date: string;
  entry_time: string | null;
  total_pax: number | null;
  adults: number | null;
  children: number | null;
  event_mode: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
};

export type CrmCustomerListItem = {
  customer: CrmCustomer;
  primaryPhone: CrmContact | null;
  primaryEmail: CrmContact | null;
  contacts: CrmContact[];
  reservationCount: number;
  totalPax: number;
  lastReservation: CrmReservation | null;
  nextReservation: CrmReservation | null;
};

export type CrmListMetrics = {
  totalCustomers: number;
  customersWithReservations: number;
  linkedReservations: number;
  customersMissingPhoneOrEmail: number;
};

const TODAY = new Date().toISOString().slice(0, 10);

function includesNormalized(value: string | null | undefined, query: string) {
  return (value ?? '').toLowerCase().includes(query);
}

function sortByEventDateDesc(a: CrmReservation, b: CrmReservation) {
  const dateDelta = b.event_date.localeCompare(a.event_date);
  if (dateDelta !== 0) return dateDelta;
  return (b.entry_time ?? '').localeCompare(a.entry_time ?? '');
}

function sortByEventDateAsc(a: CrmReservation, b: CrmReservation) {
  const dateDelta = a.event_date.localeCompare(b.event_date);
  if (dateDelta !== 0) return dateDelta;
  return (a.entry_time ?? '').localeCompare(b.entry_time ?? '');
}

function pickPrimaryContact(contacts: CrmContact[], type: 'phone' | 'email') {
  const candidates = contacts
    .filter((contact) => contact.contact_type === type)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at));

  return candidates[0] ?? null;
}

function buildCustomerItem(
  customer: CrmCustomer,
  contacts: CrmContact[],
  reservations: CrmReservation[],
): CrmCustomerListItem {
  const sortedPastReservations = reservations
    .filter((reservation) => reservation.event_date <= TODAY)
    .sort(sortByEventDateDesc);
  const sortedFutureReservations = reservations
    .filter((reservation) => reservation.event_date >= TODAY)
    .sort(sortByEventDateAsc);

  return {
    customer,
    contacts,
    primaryPhone: pickPrimaryContact(contacts, 'phone'),
    primaryEmail: pickPrimaryContact(contacts, 'email'),
    reservationCount: reservations.length,
    totalPax: reservations.reduce((sum, reservation) => sum + (reservation.total_pax ?? 0), 0),
    lastReservation: sortedPastReservations[0] ?? reservations.sort(sortByEventDateDesc)[0] ?? null,
    nextReservation: sortedFutureReservations[0] ?? null,
  };
}

function matchesSearch(
  item: CrmCustomerListItem,
  reservations: CrmReservation[],
  query: string,
  normalizedEmailQuery: string | null,
  normalizedPhoneQuery: string | null,
) {
  if (!query) return true;

  if (includesNormalized(item.customer.display_name, query)) return true;

  const contactMatches = item.contacts.some((contact) => {
    if (includesNormalized(contact.contact_value, query)) return true;
    if (includesNormalized(contact.normalized_value, query)) return true;
    if (normalizedEmailQuery && contact.normalized_value.includes(normalizedEmailQuery)) return true;
    if (normalizedPhoneQuery && contact.normalized_value.includes(normalizedPhoneQuery)) return true;
    return false;
  });

  if (contactMatches) return true;

  return reservations.some(
    (reservation) =>
      includesNormalized(reservation.name, query) ||
      includesNormalized(reservation.customer_name, query) ||
      includesNormalized(reservation.customer_email, query) ||
      includesNormalized(reservation.customer_phone, query),
  );
}

export async function getCrmListData(query: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: customers, error: customersError }, { data: contacts, error: contactsError }, { data: reservations, error: reservationsError }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('id, display_name, notes, source, created_at, updated_at')
        .order('display_name', { ascending: true }),
      supabase
        .from('customer_contacts')
        .select('id, customer_id, contact_type, contact_value, normalized_value, is_primary, created_at')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('group_events')
        .select('id, customer_id, name, event_date, entry_time, total_pax, adults, children, event_mode, status, customer_name, customer_phone, customer_email')
        .not('customer_id', 'is', null)
        .order('event_date', { ascending: false })
        .order('entry_time', { ascending: false }),
    ]);

  if (customersError) throw new Error(customersError.message);
  if (contactsError) throw new Error(contactsError.message);
  if (reservationsError) throw new Error(reservationsError.message);

  const contactsByCustomer = new Map<string, CrmContact[]>();
  for (const contact of (contacts ?? []) as CrmContact[]) {
    const list = contactsByCustomer.get(contact.customer_id) ?? [];
    list.push(contact);
    contactsByCustomer.set(contact.customer_id, list);
  }

  const reservationsByCustomer = new Map<string, CrmReservation[]>();
  for (const reservation of (reservations ?? []) as CrmReservation[]) {
    if (!reservation.customer_id) continue;
    const list = reservationsByCustomer.get(reservation.customer_id) ?? [];
    list.push(reservation);
    reservationsByCustomer.set(reservation.customer_id, list);
  }

  const items = ((customers ?? []) as CrmCustomer[]).map((customer) =>
    buildCustomerItem(
      customer,
      contactsByCustomer.get(customer.id) ?? [],
      reservationsByCustomer.get(customer.id) ?? [],
    ),
  );

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedEmailQuery = normalizeEmail(query);
  const normalizedPhoneQuery = normalizePhone(query);
  const filteredItems = items
    .filter((item) =>
      matchesSearch(
        item,
        reservationsByCustomer.get(item.customer.id) ?? [],
        normalizedQuery,
        normalizedEmailQuery,
        normalizedPhoneQuery,
      ),
    )
    .sort((a, b) => {
      const aDate = a.nextReservation?.event_date ?? a.lastReservation?.event_date ?? '';
      const bDate = b.nextReservation?.event_date ?? b.lastReservation?.event_date ?? '';
      return bDate.localeCompare(aDate) || a.customer.display_name.localeCompare(b.customer.display_name);
    });

  const metrics: CrmListMetrics = {
    totalCustomers: items.length,
    customersWithReservations: items.filter((item) => item.reservationCount > 0).length,
    linkedReservations: (reservations ?? []).length,
    customersMissingPhoneOrEmail: items.filter((item) => !item.primaryPhone || !item.primaryEmail).length,
  };

  return {
    metrics,
    items: filteredItems,
    query: normalizedQuery,
  };
}

export async function getCustomerDetailData(customerId: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: customer, error: customerError }, { data: contacts, error: contactsError }, { data: reservations, error: reservationsError }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('id, display_name, notes, source, created_at, updated_at')
        .eq('id', customerId)
        .maybeSingle<CrmCustomer>(),
      supabase
        .from('customer_contacts')
        .select('id, customer_id, contact_type, contact_value, normalized_value, is_primary, created_at')
        .eq('customer_id', customerId)
        .order('contact_type', { ascending: true })
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('group_events')
        .select('id, customer_id, name, event_date, entry_time, total_pax, adults, children, event_mode, status, customer_name, customer_phone, customer_email')
        .eq('customer_id', customerId)
        .order('event_date', { ascending: false })
        .order('entry_time', { ascending: false }),
    ]);

  if (customerError) throw new Error(customerError.message);
  if (contactsError) throw new Error(contactsError.message);
  if (reservationsError) throw new Error(reservationsError.message);

  if (!customer) {
    return null;
  }

  const typedContacts = (contacts ?? []) as CrmContact[];
  const typedReservations = (reservations ?? []) as CrmReservation[];
  const item = buildCustomerItem(customer, typedContacts, typedReservations);

  return {
    customer,
    contacts: typedContacts,
    reservations: typedReservations,
    item,
    historicalNames: Array.from(
      new Set(typedReservations.map((reservation) => reservation.customer_name?.trim()).filter(Boolean) as string[]),
    ),
    historicalPhones: Array.from(
      new Set(typedReservations.map((reservation) => reservation.customer_phone?.trim()).filter(Boolean) as string[]),
    ),
    historicalEmails: Array.from(
      new Set(typedReservations.map((reservation) => reservation.customer_email?.trim()).filter(Boolean) as string[]),
    ),
  };
}
