// Sends Islamic event reminders via Telegram (Eid, Ramadan, Day of Arafah, etc.)
// Scheduled: runs daily to check for upcoming events.
//
// Each event is keyed by its real Hijri (lunar) date. The Gregorian date for
// any given year is resolved at runtime using the Umm al-Qura calendar via
// Intl.DateTimeFormat — this fixes the previous bug where a static Gregorian
// table drifted ~11 days each year because the Hijri year is shorter.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface IslamicEvent {
  name: string;
  hijriMonth: number;   // 1 = Muharram, 9 = Ramadan, 12 = Dhu al-Hijjah
  hijriDay: number;
  hijriDate: string;    // human-readable, used in the message
  description: string;
  type: 'major' | 'fasting' | 'remembrance';
}

const ISLAMIC_EVENTS: IslamicEvent[] = [
  { name: 'Islamic New Year',           hijriMonth: 1,  hijriDay: 1,  hijriDate: '1 Muharram',          description: 'Beginning of the sacred month of Muharram and new Hijri year.', type: 'major' },
  { name: 'Day of Ashura',              hijriMonth: 1,  hijriDay: 10, hijriDate: '10 Muharram',         description: 'Day Allah saved Musa (Moses) and the Israelites from Pharaoh.', type: 'fasting' },
  { name: 'Mawlid al-Nabi',             hijriMonth: 3,  hijriDay: 12, hijriDate: '12 Rabi\' al-Awwal',  description: 'Birth of Prophet Muhammad ﷺ - time to send blessings upon him.', type: 'major' },
  { name: 'Isra and Mi\'raj',           hijriMonth: 7,  hijriDay: 27, hijriDate: '27 Rajab',            description: 'The miraculous Night Journey from Makkah to Jerusalem and ascension to the heavens.', type: 'major' },
  { name: 'Shab-e-Barat (Mid-Sha\'ban)',hijriMonth: 8,  hijriDay: 15, hijriDate: '15 Sha\'ban',         description: 'Night of Forgiveness - a blessed night to seek Allah\'s forgiveness.', type: 'remembrance' },
  { name: 'Ramadan Begins',             hijriMonth: 9,  hijriDay: 1,  hijriDate: '1 Ramadan',           description: 'The blessed month of fasting, revelation of Quran, and spiritual renewal.', type: 'major' },
  { name: 'Laylat al-Qadr (27th Night)',hijriMonth: 9,  hijriDay: 27, hijriDate: '27 Ramadan',          description: 'The Night of Power - better than 1000 months. Worship this night equals 83+ years of worship.', type: 'major' },
  { name: 'Eid al-Fitr',                hijriMonth: 10, hijriDay: 1,  hijriDate: '1 Shawwal',           description: 'Festival of Breaking the Fast - celebrating completion of Ramadan.', type: 'major' },
  { name: 'Day of Arafah',              hijriMonth: 12, hijriDay: 9,  hijriDate: '9 Dhu al-Hijjah',     description: 'The best day of the year. Fasting expiates sins of the previous and coming year.', type: 'fasting' },
  { name: 'Eid al-Adha',                hijriMonth: 12, hijriDay: 10, hijriDate: '10 Dhu al-Hijjah',    description: 'Festival of Sacrifice commemorating Prophet Ibrahim\'s willingness to sacrifice his son.', type: 'major' },
];

// Returns YYYY-MM-DD (UTC) for the next Gregorian occurrence of a given
// Hijri month/day, searching forward up to ~2 lunar years from `from`.
// Uses the Umm al-Qura Islamic calendar through Intl, which is the standard
// implementation used by Saudi Arabia and most reminder apps.
const HIJRI_PARTS_FMT = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric', month: 'numeric', timeZone: 'UTC',
});
function hijriPartsOf(d: Date): { day: number; month: number } {
  const parts = HIJRI_PARTS_FMT.formatToParts(d);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { day, month };
}
function nextGregorianFor(hijriMonth: number, hijriDay: number, from: Date): Date | null {
  // Walk one Gregorian day at a time; bounded by 2 * 354 days = max 2 Hijri
  // years so we always find the next occurrence even right after one passed.
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let i = 0; i < 720; i++) {
    const cursor = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const h = hijriPartsOf(cursor);
    if (h.month === hijriMonth && h.day === hijriDay) return cursor;
  }
  return null;
}

async function sendTelegramMessage(chatId: number, text: string, lovableKey: string, telegramKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://connector-gateway.lovable.dev/telegram/sendMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': telegramKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    return response.ok;
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
    return false;
  }
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;
    const telegramKey = Deno.env.get('TELEGRAM_API_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();

    // Helper to check if event is within user's notification window
    const isEventInReminderWindow = (eventDate: Date, hoursBefore: number): boolean => {
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilEvent > 0 && hoursUntilEvent <= hoursBefore;
    };

    // Resolve each Hijri event's NEXT Gregorian occurrence relative to now
    // and pick out the ones falling within the next 48 hours (the widest
    // reminder window we support). Anything beyond that is left for a
    // future cron tick.
    const upcomingEvents: { event: IslamicEvent; date: Date }[] = [];
    for (const event of ISLAMIC_EVENTS) {
      const eventDate = nextGregorianFor(event.hijriMonth, event.hijriDay, now);
      if (!eventDate) continue;
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilEvent > 0 && hoursUntilEvent <= 48) {
        upcomingEvents.push({ event, date: eventDate });
      }
    }

    if (upcomingEvents.length === 0) {
      return new Response(JSON.stringify({ message: 'No events within reminder window' }), { status: 200 });
    }

    // Get all users with event reminders enabled
    const { data: users, error: usersErr } = await admin
      .from('islamic_notification_settings')
      .select('user_id, events_enabled, events_hours_before, notification_language')
      .eq('events_enabled', true);

    if (usersErr) {
      console.error('Failed to fetch users:', usersErr);
      return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'No users with event reminders enabled' }), { status: 200 });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Process users in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
      const batch = users.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(batch.map(async (userSettings) => {
        try {
          for (const { event: upcomingEvent, date: eventDate } of upcomingEvents) {
            const eventDateStr = eventDate.toISOString().split('T')[0];

            // Check if event is in user's reminder window
            if (!isEventInReminderWindow(eventDate, userSettings.events_hours_before)) {
              continue;
            }

            // Check if notification was already sent for this event and user
            const { data: alreadySent } = await admin
              .from('islamic_event_notifications_sent')
              .select('id')
              .eq('user_id', userSettings.user_id)
              .eq('event_name', upcomingEvent.name)
              .eq('event_date', eventDateStr)
              .limit(1);

            if (alreadySent && alreadySent.length > 0) {
              continue; // Already sent
            }

            // Get user's Telegram link
            const { data: telegramLink } = await admin
              .from('telegram_links')
              .select('chat_id, is_active')
              .eq('user_id', userSettings.user_id)
              .eq('is_active', true)
              .maybeSingle();

            if (!telegramLink || !telegramLink.chat_id) {
              continue; // No active Telegram link
            }

            // Format message with emoji based on type
            const emoji = upcomingEvent.type === 'major' ? '⭐' : upcomingEvent.type === 'fasting' ? '🌙' : '✨';

            const message = `
${emoji} <b>${upcomingEvent.name}</b>

<b>${upcomingEvent.hijriDate}</b>

${upcomingEvent.description}

Prepare your heart and increase your worship on this blessed day.
`.trim();

            // Send message
            const sent = await sendTelegramMessage(
              telegramLink.chat_id as number,
              message,
              lovableKey,
              telegramKey
            );

            if (sent) {
              // Record that notification was sent
              await admin.from('islamic_event_notifications_sent').insert({
                user_id: userSettings.user_id,
                event_name: upcomingEvent.name,
                event_date: eventDateStr,
              });
              sentCount++;
            } else {
              failedCount++;
            }
          }
        } catch (e) {
          console.error(`Error processing user ${userSettings.user_id}:`, e);
          failedCount++;
        }
      }));
    }

    console.log(`Event reminders processed: ${sentCount} sent, ${failedCount} failed for ${upcomingEvents.length} events`);
    return new Response(
      JSON.stringify({ success: true, events: upcomingEvents.length, sent: sentCount, failed: failedCount }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in islamic-event-reminders:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
