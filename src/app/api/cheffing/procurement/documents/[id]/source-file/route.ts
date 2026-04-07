import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import {
  PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES,
  PROCUREMENT_SOURCE_FILE_BUCKET,
  procurementMimeToExtension,
} from '@/lib/cheffing/procurement';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mergeResponseCookies } from '@/lib/supabase/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess({ allowMantenimiento: true });
  if (access.response) return access.response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');

  if (!(file instanceof File)) {
    const response = NextResponse.json({ error: 'Missing file' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (file.size <= 0) {
    const response = NextResponse.json({ error: 'Empty file' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (!PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES.includes(file.type as (typeof PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES)[number])) {
    const response = NextResponse.json({ error: 'Unsupported file type. Use PDF, JPG, PNG or WEBP.' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const extension = procurementMimeToExtension(file.type);
  if (!extension) {
    const response = NextResponse.json({ error: 'Could not infer file extension' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const { data: document, error: documentError } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, status, storage_bucket, storage_path')
    .eq('id', params.id)
    .maybeSingle();

  if (documentError || !document) {
    const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (document.status !== 'draft') {
    const response = NextResponse.json({ error: 'Only draft documents allow upload or replacement' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const bucket = document.storage_bucket || PROCUREMENT_SOURCE_FILE_BUCKET;
  const newPath = `documents/${document.id}/original-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(bucket).upload(newPath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    const response = NextResponse.json({ error: uploadError.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const { error: updateError } = await supabase
    .from('cheffing_purchase_documents')
    .update({
      storage_bucket: bucket,
      storage_path: newPath,
      storage_delete_after: null,
    })
    .eq('id', document.id);

  if (updateError) {
    await supabase.storage.from(bucket).remove([newPath]);

    const mapped = mapCheffingPostgresError(updateError);
    const response = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (document.storage_path) {
    await supabase.storage.from(bucket).remove([document.storage_path]);
  }

  const { data: signedData, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(newPath, 60 * 60);
  if (signedError) {
    const response = NextResponse.json({ ok: true, storage_path: newPath, sourceFileUrl: null });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true, storage_path: newPath, sourceFileUrl: signedData.signedUrl });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
