// Commits a previously-extracted vision_captures row into the right
// downstream table.
//
// Body: { capture_id: uuid, kind?: string, payload?: object }
//   - capture_id: the row to commit. Must be in status='extracted'.
//   - kind: optional override of the auto-detected kind (user can
//     correct a misclassification before committing).
//   - payload: edited fields. Only the keys that match the kind's
//     schema are honoured; unknown keys are ignored.
//
// Returns: { ok, created_entity_kind, created_entity_id, capture_id }
//
// Per-kind routing:
//   receipt        → financial_transactions + receipts
//   business_card  → user_contacts
//   medication     → personal_medications
//   whiteboard     → notes
//   document       → notes
//   label          → no-op; the translation is shown inline only
//   contract       → contracts
//   inventory      → inventory_items
//   unknown        → notes (fallback so the OCR text isn't lost)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { recordUndo } from '../_shared/dori-undo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_KINDS = [
  'receipt', 'business_card', 'medication', 'whiteboard',
  'label', 'document', 'contract', 'inventory', 'unknown',
] as const;
type Kind = typeof ALLOWED_KINDS[number];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const captureId = String(body.capture_id || '');
    if (!UUID_RE.test(captureId)) return json({ error: 'invalid capture_id' }, 400);

    const { data: cap, error: cErr } = await admin
      .from('vision_captures')
      .select('*')
      .eq('id', captureId)
      .eq('user_id', user.id)
      .single();
    if (cErr || !cap) return json({ error: 'capture not found' }, 404);
    if (cap.status === 'committed') return json({ error: 'already committed' }, 409);
    if (cap.status === 'discarded') return json({ error: 'already discarded' }, 409);
    if (cap.status !== 'extracted') return json({ error: `cannot commit while ${cap.status}` }, 409);

    const requestedKind = ALLOWED_KINDS.includes(body.kind) ? body.kind as Kind : null;
    const kind: Kind = requestedKind ?? cap.detected_kind as Kind ?? 'unknown';
    const userPayload = (body.payload && typeof body.payload === 'object')
      ? body.payload as Record<string, unknown>
      : {};
    // Merge: edited payload wins, fall back to extracted, then OCR text.
    const merged = { ...(cap.extracted as Record<string, unknown> ?? {}), ...userPayload };
    const ocrText = typeof cap.ocr_text === 'string' ? cap.ocr_text : '';

    let createdEntityKind: string | null = null;
    let createdEntityId: string | null = null;
    let undoId: string | null = null;
    let warning: string | null = null;

    // Helper: record a delete-by-id undo for the row we just created
    // so the caller can offer "Undo" within the 5-minute window.
    const recordCreateUndo = async (table: string, id: string, label: string, entity: string) => {
      undoId = await recordUndo(admin, {
        user_id: user.id,
        op: 'create',
        entity_type: entity,
        entity_id: id,
        label,
        inverse_tool_xml: null,
        snapshot: { kind: 'delete_by_id', table, id },
        source: 'vision_capture',
        source_ref: cap.id,
      });
    };

    try {
      switch (kind) {
        case 'receipt': {
          const merchant = strOrNull(merged.merchant);
          const total = numOrNull(merged.total);
          const date = strOrNull(merged.date) ?? new Date().toISOString().slice(0, 10);
          const currency = strOrNull(merged.currency) || 'USD';
          const category = strOrNull(merged.category);
          // Receipt always becomes BOTH a transaction (so it shows up
          // in the finance dashboard) AND a `receipts` row (linked
          // back to the storage path).
          const { data: tx, error: tErr } = await admin
            .from('financial_transactions')
            .insert({
              user_id: user.id,
              amount: total ?? 0,
              direction: 'expense',
              category,
              description: merchant || 'Receipt',
              merchant,
              occurred_on: date,
              source: 'vision_capture',
              metadata: { capture_id: cap.id, line_items: (merged as any).line_items ?? [] },
            })
            .select('id')
            .single();
          if (tErr || !tx) throw new Error(tErr?.message || 'transaction insert failed');
          await admin.from('receipts').insert({
            user_id: user.id,
            transaction_id: tx.id,
            file_path: cap.storage_path,
            ocr_text: ocrText,
            amount: total,
            merchant,
            receipt_date: date,
          });
          await recordCreateUndo('financial_transactions', tx.id,
            `${merchant ? `${merchant} · ` : ''}${total ?? '?'} ${currency}`, 'transaction');
          createdEntityKind = 'transaction';
          createdEntityId = tx.id;
          break;
        }
        case 'business_card': {
          const name = strOrNull(merged.name);
          if (!name) throw new Error('name is required for business_card');
          const { data: row, error: e } = await admin.from('user_contacts').insert({
            user_id: user.id,
            name,
            email: strOrNull(merged.email),
            phone: strOrNull(merged.phone),
            company: strOrNull(merged.company),
            role: strOrNull(merged.role),
            contact_type: 'business',
            tags: ['scanned-card'],
            notes: ocrText.slice(0, 2000),
          }).select('id').single();
          if (e || !row) throw new Error(e?.message || 'contact insert failed');
          await recordCreateUndo('user_contacts', row.id, name, 'contact');
          createdEntityKind = 'contact';
          createdEntityId = row.id;
          break;
        }
        case 'medication': {
          const name = strOrNull(merged.name);
          if (!name) throw new Error('name is required for medication');
          const { data: row, error: e } = await admin.from('personal_medications').insert({
            user_id: user.id,
            name,
            dose: strOrNull(merged.dose),
            frequency: strOrNull(merged.frequency),
            schedule: strOrNull(merged.schedule),
            prescriber: strOrNull(merged.prescriber),
            refill_date: strOrNull(merged.refill_date),
            notes: ocrText.slice(0, 2000),
            is_active: true,
          }).select('id').single();
          if (e || !row) throw new Error(e?.message || 'medication insert failed');
          await recordCreateUndo('personal_medications', row.id, name, 'medication');
          createdEntityKind = 'medication';
          createdEntityId = row.id;
          break;
        }
        case 'whiteboard':
        case 'document':
        case 'unknown': {
          const title = strOrNull(merged.title) || (kind === 'whiteboard' ? 'Whiteboard scan' : 'Scanned text');
          const bulletsBlock = Array.isArray((merged as any).bullets)
            ? '\n\n' + ((merged as any).bullets as string[]).map((b) => `- ${b}`).join('\n')
            : '';
          const summary = strOrNull(merged.summary) || '';
          const content = [summary, bulletsBlock, ocrText ? `\n\n---\nVerbatim:\n${ocrText}` : ''].join('').trim();
          const { data: row, error: e } = await admin.from('notes').insert({
            user_id: user.id,
            title,
            content,
            tags: ['vision-capture', kind],
          }).select('id').single();
          if (e || !row) throw new Error(e?.message || 'note insert failed');
          await recordCreateUndo('notes', row.id, title, 'note');
          createdEntityKind = 'note';
          createdEntityId = row.id;
          break;
        }
        case 'label': {
          // No downstream entity — translation is shown inline. Mark
          // committed so the row leaves the active list.
          warning = 'Label captures do not create a row; translation is shown inline.';
          break;
        }
        case 'contract': {
          const name = strOrNull(merged.name);
          if (!name) throw new Error('name is required for contract');
          const { data: row, error: e } = await admin.from('contracts').insert({
            user_id: user.id,
            name,
            provider: strOrNull(merged.provider),
            cost_amount: numOrNull(merged.cost_amount),
            cost_frequency: strOrNull(merged.cost_frequency),
            renewal_date: strOrNull(merged.renewal_date),
            notes: ocrText.slice(0, 2000),
            is_active: true,
          }).select('id').single();
          if (e || !row) throw new Error(e?.message || 'contract insert failed');
          await recordCreateUndo('contracts', row.id, name, 'contract');
          createdEntityKind = 'contract';
          createdEntityId = row.id;
          break;
        }
        case 'inventory': {
          // The inventory_items table requires property_id which we don't
          // have here. Fall back to a note so the OCR isn't lost; the
          // user can promote it later from the property page.
          const title = strOrNull(merged.name) || 'Inventory item';
          const lines = [
            strOrNull(merged.brand) ? `Brand: ${merged.brand}` : null,
            strOrNull(merged.model) ? `Model: ${merged.model}` : null,
            strOrNull(merged.serial) ? `Serial: ${merged.serial}` : null,
            strOrNull(merged.warranty_until) ? `Warranty until: ${merged.warranty_until}` : null,
          ].filter(Boolean).join('\n');
          const content = [lines, ocrText && `\n\nVerbatim:\n${ocrText}`].filter(Boolean).join('');
          const { data: row, error: e } = await admin.from('notes').insert({
            user_id: user.id,
            title,
            content,
            tags: ['vision-capture', 'inventory'],
          }).select('id').single();
          if (e || !row) throw new Error(e?.message || 'note insert failed');
          await recordCreateUndo('notes', row.id, title, 'note');
          createdEntityKind = 'note';
          createdEntityId = row.id;
          warning = 'Inventory items need a property to attach to; saved as a note for now.';
          break;
        }
      }
    } catch (e) {
      await admin.from('vision_captures').update({
        status: 'error',
        error_message: (e as Error).message.slice(0, 1000),
      }).eq('id', cap.id);
      return json({ error: (e as Error).message }, 500);
    }

    await admin.from('vision_captures').update({
      status: 'committed',
      detected_kind: kind,
      extracted: merged,
      created_entity_kind: createdEntityKind,
      created_entity_id: createdEntityId,
    }).eq('id', cap.id);

    return json({
      ok: true,
      capture_id: cap.id,
      created_entity_kind: createdEntityKind,
      created_entity_id: createdEntityId,
      undo_id: undoId,
      warning,
    });
  } catch (err) {
    console.error('[vision-commit] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}
function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
