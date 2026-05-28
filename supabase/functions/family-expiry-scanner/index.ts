import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Internal/cron-only: require service role key
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date();
    const findings: Record<string, number> = { docs: 0, insurance: 0, vaccinations: 0, medications: 0, pets: 0, maintenance: 0, vehicles: 0, traditions: 0 };

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

    // 5. Pets: vaccination or vet checkup within 14 days
    const { data: pets } = await supabase
      .from('pets')
      .select('id, user_id, name, next_vaccination_date, next_vet_checkup, last_reminded_at');
    for (const p of pets || []) {
      if (p.last_reminded_at && (today.getTime() - new Date(p.last_reminded_at).getTime()) < 7 * 86400000) continue;
      const candidates = [
        { date: p.next_vaccination_date, label: 'vaccination' },
        { date: p.next_vet_checkup, label: 'vet checkup' },
      ].filter(c => c.date);
      for (const c of candidates) {
        const daysLeft = Math.floor((new Date(c.date!).getTime() - today.getTime()) / 86400000);
        if (daysLeft < -7 || daysLeft > 14) continue;
        await supabase.from('user_notifications').insert({
          user_id: p.user_id,
          type: 'family_expiry',
          title: daysLeft < 0
            ? `${p.name}: ${c.label} OVERDUE`
            : `${p.name}: ${c.label} in ${daysLeft}d`,
          message: `Book at the vet`,
          data: { kind: 'pet', pet_id: p.id, days_left: daysLeft },
          read: false,
        });
        await supabase.from('pets').update({ last_reminded_at: today.toISOString() }).eq('id', p.id);
        findings.pets++;
      }
    }

    // 6. Household maintenance due
    const { data: maint } = await supabase
      .from('household_maintenance')
      .select('id, user_id, task_name, next_due_date, reminder_days_before, last_reminded_at')
      .eq('is_active', true)
      .not('next_due_date', 'is', null);
    for (const m of maint || []) {
      const due = new Date(m.next_due_date!);
      const daysLeft = Math.floor((due.getTime() - today.getTime()) / 86400000);
      const window = m.reminder_days_before ?? 30;
      if (daysLeft > window || daysLeft < -14) continue;
      if (m.last_reminded_at && (today.getTime() - new Date(m.last_reminded_at).getTime()) < 7 * 86400000) continue;
      await supabase.from('user_notifications').insert({
        user_id: m.user_id,
        type: 'family_expiry',
        title: daysLeft < 0
          ? `${m.task_name} is OVERDUE`
          : `${m.task_name} due in ${daysLeft}d`,
        message: `Schedule maintenance`,
        data: { kind: 'maintenance', maintenance_id: m.id, days_left: daysLeft },
        read: false,
      });
      await supabase.from('household_maintenance').update({ last_reminded_at: today.toISOString() }).eq('id', m.id);
      findings.maintenance++;
    }

    // 7. Vehicles: inspection / insurance / service within 30 days
    const { data: vehicles } = await supabase
      .from('vehicle_records')
      .select('id, user_id, nickname, next_inspection_date, insurance_renewal_date, next_service_date, next_tire_change_date, last_reminded_at');
    for (const v of vehicles || []) {
      if (v.last_reminded_at && (today.getTime() - new Date(v.last_reminded_at).getTime()) < 7 * 86400000) continue;
      const items = [
        { date: v.next_inspection_date, label: 'inspection' },
        { date: v.insurance_renewal_date, label: 'insurance renewal' },
        { date: v.next_service_date, label: 'service' },
        { date: v.next_tire_change_date, label: 'tire change' },
      ].filter(i => i.date);
      let notified = false;
      for (const i of items) {
        const daysLeft = Math.floor((new Date(i.date!).getTime() - today.getTime()) / 86400000);
        if (daysLeft < -7 || daysLeft > 30) continue;
        await supabase.from('user_notifications').insert({
          user_id: v.user_id,
          type: 'family_expiry',
          title: daysLeft < 0
            ? `${v.nickname}: ${i.label} OVERDUE`
            : `${v.nickname}: ${i.label} in ${daysLeft}d`,
          message: `Vehicle reminder`,
          data: { kind: 'vehicle', vehicle_id: v.id, days_left: daysLeft },
          read: false,
        });
        notified = true;
        findings.vehicles++;
      }
      if (notified) await supabase.from('vehicle_records').update({ last_reminded_at: today.toISOString() }).eq('id', v.id);
    }

    // 8. Family traditions: upcoming within 3 days
    const { data: trads } = await supabase
      .from('family_traditions')
      .select('id, user_id, title, next_occurrence, last_reminded_at')
      .eq('is_active', true)
      .not('next_occurrence', 'is', null);
    for (const t of trads || []) {
      const daysLeft = Math.floor((new Date(t.next_occurrence!).getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0 || daysLeft > 3) continue;
      if (t.last_reminded_at && (today.getTime() - new Date(t.last_reminded_at).getTime()) < 2 * 86400000) continue;
      await supabase.from('user_notifications').insert({
        user_id: t.user_id,
        type: 'family_tradition',
        title: daysLeft === 0 ? `Today: ${t.title}` : `In ${daysLeft}d: ${t.title}`,
        message: `Family tradition reminder`,
        data: { kind: 'tradition', tradition_id: t.id, days_left: daysLeft },
        read: false,
      });
      await supabase.from('family_traditions').update({ last_reminded_at: today.toISOString() }).eq('id', t.id);
      findings.traditions++;
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
