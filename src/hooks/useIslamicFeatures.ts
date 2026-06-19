import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface RamadanDay {
  id: string;
  year: number;
  day_number: number;
  fasting_completed: boolean;
  taraweeh_completed: boolean;
  suhoor_time: string | null;
  iftar_time: string | null;
  notes: string | null;
}

interface DhikrLog {
  id: string;
  dhikr_type: string;
  target_count: number;
  completed_count: number;
  log_date: string;
}

export interface IslamicEvent {
  name: string;
  date: Date;
  hijriDate: string;
  description?: string;
  type?: "major" | "fasting" | "sunnah" | "remembrance" | "historical";
  actions?: string[];
  dua?: { arabic: string; transliteration: string; translation: string };
  specialPrayer?: string;
}

const DHIKR_TYPES = [
  { id: "subhanallah", arabic: "سبحان الله", english: "SubhanAllah", defaultTarget: 33 },
  { id: "alhamdulillah", arabic: "الحمد لله", english: "Alhamdulillah", defaultTarget: 33 },
  { id: "allahuakbar", arabic: "الله أكبر", english: "Allahu Akbar", defaultTarget: 34 },
  {
    id: "lailahaillallah",
    arabic: "لا إله إلا الله",
    english: "La ilaha illallah",
    defaultTarget: 100,
  },
  { id: "astaghfirullah", arabic: "أستغفر الله", english: "Astaghfirullah", defaultTarget: 100 },
];

// Calculate Hijri date (approximate - for display purposes)
function getHijriDate(date: Date): { year: number; month: number; day: number; monthName: string } {
  const HIJRI_EPOCH = 1948439.5;
  const jd = Math.floor(date.getTime() / 86400000 + 2440587.5);

  const l = jd - Math.floor(HIJRI_EPOCH) + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 =
    l2 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  const monthNames = [
    "Muharram",
    "Safar",
    "Rabi' al-Awwal",
    "Rabi' al-Thani",
    "Jumada al-Awwal",
    "Jumada al-Thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ];

  return { year, month, day, monthName: monthNames[month - 1] || "" };
}

// Get Islamic events for a given year (approximate dates)
function getIslamicEvents(year: number): IslamicEvent[] {
  // These are approximate - real dates depend on moon sighting
  const events: IslamicEvent[] = [
    // Major Events
    {
      name: "Isra and Mi'raj",
      date: new Date(year, 1, 7),
      hijriDate: "27 Rajab",
      description:
        "The miraculous Night Journey from Makkah to Jerusalem and Ascension to the heavens where the five daily prayers were prescribed.",
      type: "major",
      actions: [
        "Pray extra night prayers (Tahajjud)",
        "Read about the journey in Surah Al-Isra",
        "Reflect on the gift of Salah",
        "Make sincere dua",
      ],
      specialPrayer: "Pray 12 rakaat of voluntary prayer throughout the night",
    },
    {
      name: "Shab-e-Barat (Mid-Sha'ban)",
      date: new Date(year, 1, 24),
      hijriDate: "15 Sha'ban",
      description:
        "Night of Forgiveness when Allah descends to the lowest heaven and forgives those who seek repentance.",
      type: "remembrance",
      actions: [
        "Seek forgiveness for sins",
        "Visit graves of loved ones",
        "Fast the following day",
        "Pray Tahajjud",
        "Reconcile with those you have disputes with",
      ],
      dua: {
        arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
        transliteration: "Allahumma innaka afuwwun tuhibbul afwa fa'fu anni",
        translation: "O Allah, You are Forgiving and love forgiveness, so forgive me.",
      },
    },
    {
      name: "Ramadan Begins",
      date: new Date(year, 2, 10),
      hijriDate: "1 Ramadan",
      description:
        "The blessed month of fasting, revelation of Quran, and spiritual renewal. Gates of Paradise are opened, gates of Hell are closed.",
      type: "major",
      actions: [
        "Begin daily fasting from Fajr to Maghrib",
        "Pray Taraweeh every night",
        "Read and complete the Quran",
        "Give charity generously",
        "Make dua at iftar time",
        "Avoid bad speech and actions",
      ],
      dua: {
        arabic:
          "اللَّهُمَّ أَهِلَّهُ عَلَيْنَا بِالْيُمْنِ وَالْإِيمَانِ وَالسَّلَامَةِ وَالْإِسْلَامِ",
        transliteration: "Allahumma ahillahu alayna bil-yumni wal-iman was-salamati wal-Islam",
        translation:
          "O Allah, let this moon appear on us with blessings, faith, safety, and Islam.",
      },
      specialPrayer: "Taraweeh prayer (8-20 rakaat) after Isha",
    },
    {
      name: "Last 10 Nights Begin",
      date: new Date(year, 2, 30),
      hijriDate: "21 Ramadan",
      description:
        "The most blessed nights of the year. Laylat al-Qadr falls on one of the odd nights.",
      type: "major",
      actions: [
        "Perform I'tikaf (seclusion in mosque)",
        "Stay awake for worship every night",
        "Increase Quran recitation",
        "Make abundant dua",
        "Give extra charity",
      ],
      specialPrayer: "Pray throughout the night, especially on odd nights (21, 23, 25, 27, 29)",
    },
    {
      name: "Laylat al-Qadr (27th Night)",
      date: new Date(year, 3, 6),
      hijriDate: "27 Ramadan",
      description:
        "The Night of Power - better than 1000 months. Angels descend, and worship on this night equals 83+ years of worship.",
      type: "major",
      actions: [
        "Stay awake the entire night in worship",
        "Recite Quran extensively",
        "Make dua repeatedly",
        "Pray as many rakaat as possible",
        "Seek forgiveness sincerely",
      ],
      dua: {
        arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
        transliteration: "Allahumma innaka afuwwun tuhibbul afwa fa'fu anni",
        translation: "O Allah, You are Forgiving and love forgiveness, so forgive me.",
      },
      specialPrayer: "Pray Tahajjud, make long sujood, and recite this dua abundantly",
    },
    {
      name: "Eid al-Fitr",
      date: new Date(year, 3, 9),
      hijriDate: "1 Shawwal",
      description:
        "Festival of Breaking the Fast - celebrating completion of Ramadan. A day of joy, gratitude, and community.",
      type: "major",
      actions: [
        "Pay Zakat al-Fitr before Eid prayer",
        "Take a bath and wear best clothes",
        "Eat dates before going to prayer",
        "Take different routes to and from prayer",
        "Visit family and give gifts",
        "Spread joy to children",
      ],
      dua: {
        arabic: "تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُم",
        transliteration: "Taqabbal Allahu minna wa minkum",
        translation: "May Allah accept from us and from you.",
      },
      specialPrayer: "Eid prayer (2 rakaat) in congregation, preferably outdoors",
    },
    {
      name: "6 Days of Shawwal",
      date: new Date(year, 3, 10),
      hijriDate: "2-7 Shawwal",
      description:
        "Fasting 6 days in Shawwal after Ramadan equals the reward of fasting the entire year.",
      type: "fasting",
      actions: [
        "Fast any 6 days in Shawwal (consecutive or separate)",
        "Maintain the spiritual momentum from Ramadan",
        "Continue Quran reading habits",
      ],
    },
    {
      name: "First 10 Days of Dhul Hijjah",
      date: new Date(year, 5, 6),
      hijriDate: "1-10 Dhu al-Hijjah",
      description:
        "The most virtuous days of the year. Good deeds are more beloved to Allah than any other time.",
      type: "remembrance",
      actions: [
        "Fast the first 9 days (especially Day of Arafah)",
        "Increase dhikr (SubhanAllah, Alhamdulillah, Allahu Akbar)",
        "Recite Takbeer frequently",
        "Give charity",
        "Do not cut hair/nails if planning to sacrifice",
      ],
      dua: {
        arabic:
          "اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ لَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ",
        transliteration:
          "Allahu Akbar, Allahu Akbar, La ilaha illallah, Allahu Akbar, Allahu Akbar, wa lillahil hamd",
        translation:
          "Allah is the Greatest, Allah is the Greatest, there is no god but Allah, Allah is the Greatest, Allah is the Greatest, and to Allah belongs all praise.",
      },
    },
    {
      name: "Day of Arafah",
      date: new Date(year, 5, 15),
      hijriDate: "9 Dhu al-Hijjah",
      description:
        "The best day of the year. Fasting expiates sins of the previous and coming year. Pilgrims stand on Arafah.",
      type: "fasting",
      actions: [
        "Fast this day (non-pilgrims)",
        "Make abundant dua, especially after Asr",
        "Seek forgiveness sincerely",
        "Free slaves/help those in bondage",
        "Recite Takbeer",
      ],
      dua: {
        arabic:
          "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
        transliteration:
          "La ilaha illallahu wahdahu la sharika lah, lahul mulku wa lahul hamdu wa huwa ala kulli shayin qadir",
        translation:
          "There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He is Able to do all things.",
      },
    },
    {
      name: "Eid al-Adha",
      date: new Date(year, 5, 16),
      hijriDate: "10 Dhu al-Hijjah",
      description:
        "Festival of Sacrifice commemorating Prophet Ibrahim's willingness to sacrifice his son. The greatest Eid.",
      type: "major",
      actions: [
        "Perform Eid prayer",
        "Sacrifice an animal (Qurbani/Udhiya)",
        "Distribute meat: 1/3 family, 1/3 friends, 1/3 poor",
        "Recite Takbeer after every prayer",
        "Visit family and celebrate",
      ],
      dua: {
        arabic: "تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُم",
        transliteration: "Taqabbal Allahu minna wa minkum",
        translation: "May Allah accept from us and from you.",
      },
      specialPrayer: "Eid prayer (2 rakaat) in congregation",
    },
    {
      name: "Days of Tashreeq",
      date: new Date(year, 5, 17),
      hijriDate: "11-13 Dhu al-Hijjah",
      description:
        "Days of eating, drinking, and remembering Allah. Fasting is prohibited. Continue Takbeer after prayers.",
      type: "remembrance",
      actions: [
        "Do NOT fast these days",
        "Recite Takbeer after every obligatory prayer",
        "Enjoy food and drink with gratitude",
        "Complete Qurbani distribution if not done",
      ],
      dua: {
        arabic: "اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ لَا إِلَهَ إِلَّا اللَّهُ",
        transliteration: "Allahu Akbar, Allahu Akbar, La ilaha illallah",
        translation: "Allah is the Greatest, Allah is the Greatest, there is no god but Allah.",
      },
    },
    {
      name: "Islamic New Year",
      date: new Date(year, 6, 7),
      hijriDate: "1 Muharram",
      description:
        "Beginning of the sacred month of Muharram and new Hijri year. Time for reflection and new spiritual goals.",
      type: "major",
      actions: [
        "Reflect on the past year",
        "Set spiritual goals for the new year",
        "Fast voluntarily in Muharram",
        "Learn about the Hijra (migration)",
      ],
      dua: {
        arabic:
          "اللَّهُمَّ أَدْخِلْهُ عَلَيْنَا بِالأَمْنِ وَالإِيمَانِ وَالسَّلامَةِ وَالإِسْلامِ",
        transliteration: "Allahumma adkhilhu alayna bil-amni wal-iman was-salamati wal-Islam",
        translation: "O Allah, let it enter upon us with security, faith, safety, and Islam.",
      },
    },
    {
      name: "Day of Ashura",
      date: new Date(year, 6, 16),
      hijriDate: "10 Muharram",
      description:
        "Day Allah saved Musa (Moses) and the Israelites from Pharaoh. Fasting expiates sins of the previous year.",
      type: "fasting",
      actions: [
        "Fast on 9th AND 10th (or 10th AND 11th) to differ from Jews",
        "Reflect on the story of Musa",
        "Be generous to family",
        "Give charity",
      ],
      dua: {
        arabic: "اللَّهُمَّ اغْفِرْ لِي ذَنْبِي كُلَّهُ",
        transliteration: "Allahumma ighfir li dhanbi kullahu",
        translation: "O Allah, forgive all my sins.",
      },
    },
    {
      name: "Mawlid al-Nabi",
      date: new Date(year, 8, 15),
      hijriDate: "12 Rabi' al-Awwal",
      description:
        "Birth of Prophet Muhammad ﷺ. A time to learn about his life, follow his Sunnah, and send blessings upon him.",
      type: "major",
      actions: [
        "Send abundant salawat (blessings) upon the Prophet ﷺ",
        "Read his Seerah (biography)",
        "Implement a new Sunnah in your life",
        "Share stories of the Prophet with children",
      ],
      dua: {
        arabic: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
        transliteration: "Allahumma salli ala Muhammadin wa ala aali Muhammad",
        translation: "O Allah, send blessings upon Muhammad and upon the family of Muhammad.",
      },
    },

    // Historical Events
    {
      name: "Battle of Badr",
      date: new Date(year, 2, 27),
      hijriDate: "17 Ramadan",
      description:
        "First major battle in Islam where 313 Muslims defeated 1000 Quraysh. Angels descended to help the believers.",
      type: "historical",
      actions: [
        "Read about the battle in Surah Al-Anfal",
        "Reflect on the sacrifices of the Sahabah",
        "Make dua for victory of truth over falsehood",
      ],
    },
    {
      name: "Conquest of Makkah",
      date: new Date(year, 3, 1),
      hijriDate: "20 Ramadan",
      description:
        "The Prophet ﷺ entered Makkah peacefully with 10,000 Muslims in 8 AH, forgiving his former enemies.",
      type: "historical",
      actions: [
        "Reflect on the Prophet's mercy and forgiveness",
        "Learn about the cleansing of the Kaaba from idols",
        "Practice forgiveness in your own life",
      ],
    },
    {
      name: "Wafat (Death) of Prophet ﷺ",
      date: new Date(year, 8, 17),
      hijriDate: "12 Rabi' al-Awwal",
      description:
        "The Prophet ﷺ passed away in Madinah at age 63, leaving behind the Quran and his Sunnah.",
      type: "historical",
      actions: [
        "Send abundant salawat",
        "Read his final sermon",
        "Reflect on following his teachings",
        "Visit his grave if able (Madinah)",
      ],
    },
    {
      name: "Hijra Anniversary",
      date: new Date(year, 8, 1),
      hijriDate: "1 Rabi' al-Awwal",
      description:
        "The Prophet's migration from Makkah to Madinah - the event that marks the start of the Islamic calendar.",
      type: "historical",
      actions: [
        "Learn about the journey and its hardships",
        "Reflect on sacrifice for faith",
        "Make dua for guidance on your path",
      ],
    },
    {
      name: "Battle of Uhud",
      date: new Date(year, 8, 22),
      hijriDate: "7 Shawwal",
      description:
        "Second major battle where Muslims faced setback due to disobeying the Prophet. 70 Sahabah were martyred.",
      type: "historical",
      actions: [
        "Read Surah Al-Imran (verses 121-175)",
        "Learn the lesson of following leadership",
        "Reflect on patience in adversity",
      ],
    },
    {
      name: "Battle of the Trench (Khandaq)",
      date: new Date(year, 11, 1),
      hijriDate: "Shawwal/Dhul Qa'dah 5 AH",
      description:
        "Muslims dug a trench to defend Madinah against 10,000 enemy soldiers. Victory came through divine intervention.",
      type: "historical",
      actions: [
        "Learn about Salman al-Farisi's strategy",
        "Reflect on unity and teamwork",
        "Trust in Allah during difficult times",
      ],
    },

    // Sunnah Fasting Days
    {
      name: "White Days (Ayyam al-Beed)",
      date: new Date(year, 0, 15),
      hijriDate: "13-15 Monthly",
      description:
        "Fasting the 13th, 14th, and 15th of each lunar month when the moon is full. Equivalent to fasting entire month.",
      type: "sunnah",
      actions: [
        "Mark these days on your calendar each month",
        "Fast all three days for full reward",
        "Combine with other acts of worship",
      ],
    },
    {
      name: "Monday & Thursday Fasting",
      date: new Date(year, 0, 1),
      hijriDate: "Every Week",
      description:
        "The Prophet ﷺ fasted Mondays and Thursdays. Deeds are presented to Allah on these days.",
      type: "sunnah",
      actions: [
        "Fast every Monday and Thursday if able",
        "Make dua at iftar time",
        'The Prophet ﷺ said: "I like my deeds to be presented while I am fasting"',
      ],
    },
    {
      name: "Fasting in Sha'ban",
      date: new Date(year, 1, 15),
      hijriDate: "Sha'ban",
      description:
        "Prophet ﷺ fasted most of Sha'ban to prepare for Ramadan. A neglected month between Rajab and Ramadan.",
      type: "sunnah",
      actions: [
        "Fast as many days as possible",
        "Begin Ramadan preparation",
        "Increase Quran recitation",
        "Complete any missed Ramadan fasts from last year",
      ],
    },
    {
      name: "Day of Jumu'ah (Friday)",
      date: new Date(year, 0, 3),
      hijriDate: "Every Friday",
      description:
        "Best day of the week. Adam was created and entered Paradise on Friday. Contains an hour when dua is accepted.",
      type: "remembrance",
      actions: [
        "Take a bath (Ghusl)",
        "Wear best clothes",
        "Use perfume",
        "Go early to Jumu'ah prayer",
        "Read Surah Al-Kahf",
        "Send salawat on the Prophet ﷺ abundantly",
        "Make dua, especially in the last hour before Maghrib",
      ],
      dua: {
        arabic: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
        transliteration: "Allahumma salli ala Muhammadin wa ala aali Muhammad",
        translation: "O Allah, send blessings upon Muhammad and the family of Muhammad.",
      },
      specialPrayer: "Jumu'ah prayer (2 rakaat fard) replaces Dhuhr on Fridays",
    },

    // Sacred Months
    {
      name: "Rajab Begins",
      date: new Date(year, 0, 15),
      hijriDate: "1 Rajab",
      description:
        "One of the four sacred months. Fighting was prohibited. A time to increase worship before Ramadan.",
      type: "remembrance",
      actions: [
        "Increase voluntary prayers",
        "Fast some days",
        "Avoid sins and conflicts",
        "Begin preparing heart for Ramadan",
      ],
      dua: {
        arabic: "اللَّهُمَّ بَارِكْ لَنَا فِي رَجَبٍ وَشَعْبَانَ وَبَلِّغْنَا رَمَضَانَ",
        transliteration: "Allahumma barik lana fi Rajab wa Sha'ban wa ballighna Ramadan",
        translation: "O Allah, bless us in Rajab and Sha'ban, and let us reach Ramadan.",
      },
    },
    {
      name: "Dhul Qa'dah Begins",
      date: new Date(year, 4, 15),
      hijriDate: "1 Dhu al-Qi'dah",
      description:
        "Sacred month before Dhul Hijjah. Pilgrims begin preparing for Hajj. Fighting was prohibited.",
      type: "remembrance",
      actions: [
        "Avoid disputes and conflicts",
        "Prepare spiritually for Dhul Hijjah",
        "Plan for Qurbani if intending to sacrifice",
      ],
    },
    {
      name: "Dhul Hijjah Begins",
      date: new Date(year, 5, 5),
      hijriDate: "1 Dhu al-Hijjah",
      description:
        "Month of Hajj pilgrimage. Most sacred month. First 10 days are the best days of the year.",
      type: "remembrance",
      actions: [
        "Begin fasting the first 9 days",
        "Recite Takbeer abundantly",
        "If sacrificing, do not cut hair/nails from now",
      ],
    },
    {
      name: "Muharram - Sacred Month",
      date: new Date(year, 6, 8),
      hijriDate: "1-30 Muharram",
      description:
        "First month of Islamic calendar. One of four sacred months. Best month for voluntary fasting after Ramadan.",
      type: "remembrance",
      actions: [
        "Fast as many days as possible",
        "Especially fast 9th and 10th (Ashura)",
        "Increase good deeds",
        "Avoid sins and conflicts",
      ],
    },

    // Additional Important Nights
    {
      name: "Laylat al-Qadr (21st Night)",
      date: new Date(year, 2, 31),
      hijriDate: "21 Ramadan",
      description: "Possible Night of Power in the last 10 nights. Worship equals 1000 months.",
      type: "major",
      actions: ["Pray Tahajjud", "Recite Quran", "Make abundant dua", "Give charity"],
      dua: {
        arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
        transliteration: "Allahumma innaka afuwwun tuhibbul afwa fa'fu anni",
        translation: "O Allah, You are Forgiving and love forgiveness, so forgive me.",
      },
    },
    {
      name: "Laylat al-Qadr (23rd Night)",
      date: new Date(year, 3, 2),
      hijriDate: "23 Ramadan",
      description: "Possible Night of Power. Stay awake in worship.",
      type: "major",
      actions: [
        "Pray throughout the night",
        "Make sincere tawbah (repentance)",
        "Recite the special dua repeatedly",
      ],
    },
    {
      name: "Laylat al-Qadr (25th Night)",
      date: new Date(year, 3, 4),
      hijriDate: "25 Ramadan",
      description: "Possible Night of Power. Continue seeking it in odd nights.",
      type: "major",
      actions: [
        "Worship with full devotion",
        "Make dua for yourself and the Ummah",
        "Give charity",
      ],
    },
    {
      name: "Laylat al-Qadr (29th Night)",
      date: new Date(year, 3, 8),
      hijriDate: "29 Ramadan",
      description: "Last possible odd night for Laylat al-Qadr. Final chance this Ramadan.",
      type: "major",
      actions: [
        "Give your best effort in worship",
        "Make heartfelt dua",
        "Seek forgiveness for all sins",
      ],
    },

    // Deaths/Commemorations of Righteous
    {
      name: "Death of Khadijah (RA)",
      date: new Date(year, 2, 1),
      hijriDate: "10 Ramadan",
      description: "The Prophet's first and most beloved wife passed away. Year of Sorrow.",
      type: "historical",
      actions: [
        "Learn about her life and sacrifices",
        "Appreciate the role of supportive spouses",
        "Make dua for her",
      ],
    },
    {
      name: "Death of Abu Talib",
      date: new Date(year, 2, 1),
      hijriDate: "10 Ramadan",
      description: "The Prophet's uncle and protector died in the Year of Sorrow.",
      type: "historical",
      actions: ["Learn about his protection of the Prophet ﷺ", "Reflect on family support"],
    },

    // Fasting Days
    {
      name: "Fasting 9th Muharram",
      date: new Date(year, 6, 15),
      hijriDate: "9 Muharram",
      description: "Fast with Ashura to differ from the practice of Jews who only fasted the 10th.",
      type: "fasting",
      actions: ["Fast this day along with the 10th", "Make intention for reward"],
    },
    {
      name: "Fasting 11th Muharram",
      date: new Date(year, 6, 17),
      hijriDate: "11 Muharram",
      description: "Alternative: Fast 10th and 11th if you missed the 9th.",
      type: "fasting",
      actions: ["Fast with Ashura if you missed the 9th"],
    },
  ];

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Get upcoming Islamic events for the next 365 days
function getUpcomingIslamicEvents(): IslamicEvent[] {
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const currentYear = today.getFullYear();
  const nextYearValue = currentYear + 1;

  // Get events from current year and next year
  const allEvents = [...getIslamicEvents(currentYear), ...getIslamicEvents(nextYearValue)];

  // Filter to only show events within the next 365 days
  return allEvents
    .filter((event) => event.date >= today && event.date <= nextYear)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function useIslamicFeatures() {
  const { user } = useAuth();
  const [ramadanDays, setRamadanDays] = useState<RamadanDay[]>([]);
  const [dhikrLogs, setDhikrLogs] = useState<DhikrLog[]>([]);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split("T")[0];
  const hijriToday = getHijriDate(new Date());
  const islamicEvents = getUpcomingIslamicEvents();

  // Fetch Ramadan data
  const fetchRamadanData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("ramadan_tracker")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", currentYear)
        .order("day_number", { ascending: true });

      if (error) throw error;
      setRamadanDays((data || []) as RamadanDay[]);
    } catch (error) {
      console.error("Error fetching Ramadan data:", error);
    }
  }, [user?.id, currentYear]);

  // Fetch Dhikr logs for today
  const fetchDhikrLogs = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("dhikr_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("log_date", today);

      if (error) throw error;
      setDhikrLogs((data || []) as DhikrLog[]);
    } catch (error) {
      console.error("Error fetching dhikr logs:", error);
    }
  }, [user?.id, today]);

  // Toggle fasting for a Ramadan day
  const toggleFasting = async (dayNumber: number) => {
    if (!user?.id) return;

    const existing = ramadanDays.find((d) => d.day_number === dayNumber);

    try {
      if (existing) {
        const { error } = await supabase
          .from("ramadan_tracker")
          .update({ fasting_completed: !existing.fasting_completed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ramadan_tracker").insert({
          user_id: user.id,
          year: currentYear,
          day_number: dayNumber,
          fasting_completed: true,
        });
        if (error) throw error;
      }
      await fetchRamadanData();
    } catch (error) {
      console.error("Error toggling fasting:", error);
      toast.error("Failed to update fasting status");
    }
  };

  // Toggle Taraweeh for a Ramadan day
  const toggleTaraweeh = async (dayNumber: number) => {
    if (!user?.id) return;

    const existing = ramadanDays.find((d) => d.day_number === dayNumber);

    try {
      if (existing) {
        const { error } = await supabase
          .from("ramadan_tracker")
          .update({ taraweeh_completed: !existing.taraweeh_completed })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ramadan_tracker").insert({
          user_id: user.id,
          year: currentYear,
          day_number: dayNumber,
          taraweeh_completed: true,
        });
        if (error) throw error;
      }
      await fetchRamadanData();
    } catch (error) {
      console.error("Error toggling Taraweeh:", error);
      toast.error("Failed to update Taraweeh status");
    }
  };

  // Increment dhikr count
  const incrementDhikr = async (dhikrType: string) => {
    if (!user?.id) return;

    const existing = dhikrLogs.find((d) => d.dhikr_type === dhikrType);
    const dhikrConfig = DHIKR_TYPES.find((d) => d.id === dhikrType);

    try {
      if (existing) {
        const newCount = existing.completed_count + 1;
        const { error } = await supabase
          .from("dhikr_logs")
          .update({ completed_count: newCount })
          .eq("id", existing.id);
        if (error) throw error;

        if (newCount === existing.target_count) {
          toast.success(`${dhikrConfig?.english || dhikrType} completed! 🤲`);
        }
      } else {
        const { error } = await supabase.from("dhikr_logs").insert({
          user_id: user.id,
          dhikr_type: dhikrType,
          target_count: dhikrConfig?.defaultTarget || 33,
          completed_count: 1,
          log_date: today,
        });
        if (error) throw error;
      }
      await fetchDhikrLogs();
    } catch (error) {
      console.error("Error incrementing dhikr:", error);
      toast.error("Failed to update dhikr count");
    }
  };

  // Reset dhikr count
  const resetDhikr = async (dhikrType: string) => {
    if (!user?.id) return;

    const existing = dhikrLogs.find((d) => d.dhikr_type === dhikrType);

    try {
      if (existing) {
        const { error } = await supabase
          .from("dhikr_logs")
          .update({ completed_count: 0 })
          .eq("id", existing.id);
        if (error) throw error;
        await fetchDhikrLogs();
      }
    } catch (error) {
      console.error("Error resetting dhikr:", error);
      toast.error("Failed to reset dhikr count");
    }
  };

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      Promise.all([fetchRamadanData(), fetchDhikrLogs()]).finally(() => setLoading(false));
    }
  }, [user?.id, fetchRamadanData, fetchDhikrLogs]);

  return {
    // Ramadan
    ramadanDays,
    toggleFasting,
    toggleTaraweeh,

    // Dhikr
    dhikrLogs,
    dhikrTypes: DHIKR_TYPES,
    incrementDhikr,
    resetDhikr,

    // Islamic Calendar
    hijriToday,
    islamicEvents,
    getHijriDate,

    // General
    loading,
    refetch: () => Promise.all([fetchRamadanData(), fetchDhikrLogs()]),
  };
}
