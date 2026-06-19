// Sends daily Sunni hadith to users via Telegram
// Scheduled: runs daily at various times based on user's preferred time zone
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HADITHS = [
  {
    id: 1,
    arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
    english: "Actions are judged by intentions, and everyone will get what was intended.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 2,
    arabic: "الإِيمَانُ بِضْعٌ وَسِتُّونَ شُعْبَةً",
    english: "Faith has over sixty branches.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 3,
    arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    english: "None of you truly believes until he loves for his brother what he loves for himself.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 4,
    arabic: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ",
    english: "A Muslim is one from whose tongue and hand other Muslims are safe.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 5,
    arabic: "أَفْضَلُ الأَعْمَالِ الصَّلاَةُ عَلَى وَقْتِهَا",
    english: "The best deed is prayer performed on time.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 6,
    arabic: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ",
    english: "Whoever believes in Allah and the Last Day should speak good or remain silent.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 7,
    arabic: "اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ",
    english: "Fear Allah wherever you are.",
    source: "Sunan at-Tirmidhi",
  },
  {
    id: 8,
    arabic: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ",
    english: "Your smile for your brother is charity.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 9,
    arabic: "مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ",
    english: "Charity does not decrease wealth.",
    source: "Sahih al-Bukhari",
  },
  {
    id: 10,
    arabic: "خَيْرُكُمْ خَيْرُكُمْ لأَهْلِهِ وَأَنَا خَيْرُكُمْ لأَهْلِي",
    english: "The best of you are those who are best to their families.",
    source: "Sunan at-Tirmidhi",
  },
];

async function sendTelegramMessage(
  chatId: number,
  text: string,
  telegramKey: string,
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramKey}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    return response.ok;
  } catch (e) {
    console.error("Failed to send Telegram message:", e);
    return false;
  }
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const telegramKey = Deno.env.get("TELEGRAM_API_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];

    // Get all users with daily hadith enabled
    const { data: users, error: usersErr } = await admin
      .from("islamic_notification_settings")
      .select(
        "user_id, daily_hadith_time, hadith_source_preference, notification_language, timezone",
      )
      .eq("daily_hadith_enabled", true);

    if (usersErr) {
      console.error("Failed to fetch users:", usersErr);
      return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users with daily hadith enabled" }), {
        status: 200,
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Helper to check if user's local time matches their preferred delivery time
    const isTimeToSendForUser = (userTime: string, userTimezone: string): boolean => {
      try {
        // Parse user's preferred time (HH:MM format)
        const [prefHour] = userTime.split(":").map(Number);

        // Get current time in user's timezone
        const formatter = new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: userTimezone,
        });
        const timeParts = formatter.formatToParts(now);
        const currentHour = parseInt(timeParts.find((p) => p.type === "hour")?.value || "0", 10);
        // Check if current hour matches preferred hour (within 1-hour window for cron reliability)
        return currentHour === prefHour;
      } catch (e) {
        console.error(`Error parsing timezone ${userTimezone}:`, e);
        return false;
      }
    };

    // Process users in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
      const batch = users.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(
        batch.map(async (userSettings) => {
          try {
            // Only process if it's time for this user
            if (!isTimeToSendForUser(userSettings.daily_hadith_time, userSettings.timezone)) {
              return;
            }

            // Check if hadith was already sent today
            const { data: alreadySent } = await admin
              .from("islamic_daily_hadith_sent")
              .select("id")
              .eq("user_id", userSettings.user_id)
              .eq("sent_date", todayDate)
              .limit(1);

            if (alreadySent && alreadySent.length > 0) {
              console.log(`Hadith already sent today for user ${userSettings.user_id}`);
              return;
            }

            // Get user's Telegram link
            const { data: telegramLink } = await admin
              .from("telegram_links")
              .select("chat_id, is_active")
              .eq("user_id", userSettings.user_id)
              .eq("is_active", true)
              .maybeSingle();

            if (!telegramLink || !telegramLink.chat_id) {
              console.log(`No active Telegram link for user ${userSettings.user_id}`);
              return;
            }

            // Select hadith (use day of year for deterministic daily selection)
            const dayOfYear = Math.floor(
              (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
            );
            const hadith = HADITHS[dayOfYear % HADITHS.length];

            // Format message
            const message = `
<b>📖 Daily Hadith</b>

<i>"${hadith.english}"</i>

<b>العربية:</b>
${hadith.arabic}

<b>Source:</b> ${hadith.source}

رضي الله عنهم
`.trim();

            // Send message
            const sent = await sendTelegramMessage(
              telegramLink.chat_id as number,
              message,
              telegramKey,
            );

            if (sent) {
              // Record that hadith was sent
              await admin.from("islamic_daily_hadith_sent").insert({
                user_id: userSettings.user_id,
                hadith_id: hadith.id,
                sent_date: todayDate,
              });
              sentCount++;
            } else {
              failedCount++;
            }
          } catch (e) {
            console.error(`Error processing user ${userSettings.user_id}:`, e);
            failedCount++;
          }
        }),
      );
    }

    console.log(`Daily hadith sent: ${sentCount}, failed: ${failedCount}`);
    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error in islamic-daily-hadith:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
