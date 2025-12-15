import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type CreateGroupEventPayload = {
  name?: string;
  event_date?: string;
  entry_time?: string | null;
  adults?: number;
  children?: number;
  allergens_and_diets?: string | null;
  setup_notes?: string | null;
  extras?: string | null;
  menu_text?: string | null;
  second_course_type?: string | null;
  room_id?: string;
  override_capacity?: boolean;
  notes?: string | null;
  status?: string | null;
};

export async function POST(req: NextRequest) {
  const supabaseResponse = NextResponse.next();

  const supabaseAuth = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  try {
    const payload = (await req.json()) as CreateGroupEventPayload;

    if (!payload) {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400, headers: noStoreHeaders });
    }

    const {
      name,
      event_date,
      entry_time,
      adults,
      children = 0,
      allergens_and_diets = null,
      setup_notes = null,
      extras = null,
      menu_text = null,
      second_course_type = null,
      room_id,
      override_capacity = false,
      notes = null,
      status = 'confirmed',
    } = payload;

    if (!name || !event_date || typeof adults !== 'number' || !room_id) {
      return NextResponse.json(
        { error: 'Missing required fields (name, event_date, adults, room_id)' },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: groupEventData, error: groupEventError } = await supabase
      .from('group_events')
      .insert({
        name,
        event_date,
        entry_time: entry_time ?? null,
        adults,
        children,
        has_private_dining_room: false,
        has_private_party: false,
        second_course_type,
        menu_text,
        allergens_and_diets,
        extras,
        setup_notes,
        deposit_amount: null,
        deposit_status: null,
        invoice_data: null,
        status,
      })
      .select('id')
      .single();

    if (groupEventError || !groupEventData) {
      const message = groupEventError?.message ?? 'Unable to create group event';
      return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders });
    }

    const { error: allocationError } = await supabase
      .from('group_room_allocations')
      .insert({
        group_event_id: groupEventData.id,
        room_id,
        adults,
        children,
        override_capacity,
        notes,
      });

    if (allocationError) {
      return NextResponse.json(
        {
          error:
            'Reservation created but room allocation failed. Please try assigning the room again from the reservation detail.',
        },
        { status: 500, headers: noStoreHeaders },
      );
    }

    const response = NextResponse.json({ groupEventId: groupEventData.id }, { headers: noStoreHeaders });
    mergeResponseCookies(supabaseResponse, response);

    return response;
  } catch (error) {
    console.error('[API] group-events/create', error);
    const response = NextResponse.json(
      { error: 'Unexpected error while creating the reservation' },
      { status: 500, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, response);

    return response;
  }
}
