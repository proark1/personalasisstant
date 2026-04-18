import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date();
    const findings: Record<string, number> = { docs: 0, insurance: 0, vaccinations: 0, medications: 0 };

    // 1. Important documents expiring within their reminder window
    const { data: docs } = await supabase
      .from('family_important_documents')
      .select('id, user_id, document_type, expiry_date, reminder_days_before, family_member_id, last_reminded_at');

    for (const d of docs || []) {
      if (!d.expiry_date) continue;
      const expiry = new Date(d.expiry_date);
      const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
      const window = d.reminder_days_before ?? 180;
      if (daysLeft > window || daysLeft < -7) continue;
      // Throttle: don't re-notify within 7 days
      if (d.last_reminded_at && (today.getTime() - new Date(d.last_reminded_at).getTime()) < 7 * 86400000) continue;

      let memberName = 'family member';
      if (d.family_member_id) {
        const { data: m } = await supabase.from('family_members').select('name').eq('id', d.family_member_id).maybeSingle();
        if (m?.name) memberName = m.name;
      }

      const title = daysLeft < 0
        ? `${d.document_type} for ${memberName} EXPIRED`
        : `${d.document_type} for ${memberName} expires in ${daysLeft} days`;

      await supabase.from('user_notifications').insert({
        user_id: d.user_id,
        type: 'family_expiry',
        title,
        message: `Renew before ${d.expiry_date}`,
        data: { kind: 'document', document_id: d.id, days_left: daysLeft },
        read: false,
      });

      await supabase.from('family_important_documents').update({ last_reminded_at: today.toISOString() }).eq('id', d.id);
      findings.docs++;
    }

    // 2. Insurance ending within 30 days
    const { data: insurance } = await supabase
      .from('family_insurance')
      .select('id, user_id, insurance_type, provider, end_date, family_member_id')
      .eq('is_active', true)
      .not('end_date', 'is', null);

    for (const ins of insurance || []) {
      const end = new Date(ins.end_date!);
      const daysLeft = Math.floor((end.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0 || daysLeft > 30) continue;

      await supabase.from('user_notifications').insert({
        user_id: ins.user_id,
        type: 'family_expiry',
        title: `${ins.insurance_type} insurance (${ins.provider}) expires in ${daysLeft}d`,
        message: `Ends ${ins.end_date}`,
        data: { kind: 'insurance', insurance_id: ins.id, days_left: daysLeft },
        read: false,
      });
      findings.insurance++;
    }

    // 3. Vaccinations: next dose due within 14 days
    const { data: vacc } = await supabase
      .from('family_vaccinations')
      .select('id, user_id, vaccine_name, next_dose_date, family_member_id')
      .not('next_dose_date', 'is', null);

    for (const v of vacc || []) {
      const due = new Date(v.next_dose_date!);
      const daysLeft = Math.floor((due.getTime() - today.getTime()) / 86400000);
      if (daysLeft < -7 || daysLeft > 14) continue;

      let memberName = 'family member';
      if (v.family_member_id) {
        const { data: m } = await supabase.from('family_members').select('name').eq('id', v.family_member_id).maybeSingle();
        if (m?.name) memberName = m.name;
      }

      await supabase.from('user_notifications').insert({
        user_id: v.user_id,
        type: 'family_expiry',
        title: daysLeft < 0
          ? `${memberName}: ${v.vaccine_name} dose OVERDUE`
          : `${memberName}: ${v.vaccine_name} dose due in ${daysLeft}d`,
        message: `Schedule appointment`,
        data: { kind: 'vaccination', vaccination_id: v.id, days_left: daysLeft },
        read: false,
      });
      findings.vaccinations++;
    }

    // 4. Medications: refill date within 7 days
    const { data: meds } = await supabase
      .from('family_medications')
      .select('id, user_id, name, refill_date, family_member_id')
      .eq('is_active', true)
      .not('refill_date', 'is', null);

    for (const m of meds || []) {
      const refill = new Date(m.refill_date!);
      const daysLeft = Math.floor((refill.getTime() - today.getTime()) / 86400000);
      if (daysLeft < -3 || daysLeft > 7) continue;

      await supabase.from('user_notifications').insert({
        user_id: m.user_id,
        type: 'family_expiry',
        title: `Refill ${m.name} ${daysLeft <= 0 ? 'now' : `in ${daysLeft}d`}`,
        message: `Pharmacy reminder`,
        data: { kind: 'medication', medication_id: m.id, days_left: daysLeft },
        read: false,
      });
      findings.medications++;
    }

    return new Response(JSON.stringify({ ok: true, findings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('expiry-scanner error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
