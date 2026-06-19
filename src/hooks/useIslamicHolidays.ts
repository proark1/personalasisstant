import { useMemo } from "react";
import { format } from "date-fns";

export interface IslamicHoliday {
  id: string;
  name: string;
  local_name: string;
  date: string;
  description: string;
  type: "major" | "fasting" | "sunnah" | "remembrance" | "historical";
  actions: string[];
  dua?: { arabic: string; transliteration: string; translation: string };
  specialPrayer?: string;
}

// Get Islamic events for the calendar (approximate dates - real dates depend on moon sighting)
function getIslamicEventsForYear(year: number): IslamicHoliday[] {
  // Note: These dates shift approximately 10-11 days earlier each Gregorian year
  // The dates here are approximations for display purposes

  const events: IslamicHoliday[] = [
    // Muharram events
    {
      id: `islamic-new-year-${year}`,
      name: "Islamic New Year",
      local_name: "رأس السنة الهجرية",
      date: format(new Date(year, 6, 7), "yyyy-MM-dd"), // Approximate
      description:
        "First day of Muharram, marking the beginning of the Islamic lunar calendar and commemorating the Hijra (migration) of Prophet Muhammad ﷺ from Makkah to Madinah.",
      type: "major",
      actions: [
        "Reflect on the Hijra and its lessons",
        "Make intentions for the new year",
        "Increase in dhikr and dua",
        "Fast during Muharram (optional)",
      ],
      dua: {
        arabic:
          "اللَّهُمَّ أَدْخِلْهُ عَلَيْنَا بِالأَمْنِ وَالإِيمَانِ، وَالسَّلامَةِ وَالإِسْلامِ",
        transliteration: "Allahumma adkhilhu alayna bil-amni wal-iman, was-salamati wal-Islam",
        translation: "O Allah, bring it upon us with security, faith, safety and Islam.",
      },
    },
    {
      id: `ashura-${year}`,
      name: "Day of Ashura",
      local_name: "يوم عاشوراء",
      date: format(new Date(year, 6, 16), "yyyy-MM-dd"), // 10th Muharram
      description:
        "The 10th of Muharram. Prophet Musa (Moses) and his people were saved from Pharaoh on this day. Fasting is highly recommended.",
      type: "fasting",
      actions: [
        "Fast on this day (Sunnah)",
        "Also fast the 9th or 11th of Muharram",
        "Reflect on the story of Musa (AS)",
        "Give extra charity",
        "Make dua for the Ummah",
      ],
      specialPrayer: "Fast the 9th and 10th, or 10th and 11th of Muharram",
    },

    // Rabi al-Awwal events
    {
      id: `mawlid-${year}`,
      name: "Mawlid an-Nabi (Birth of Prophet ﷺ)",
      local_name: "المولد النبوي",
      date: format(new Date(year, 8, 15), "yyyy-MM-dd"), // 12th Rabi al-Awwal
      description:
        "Birth anniversary of Prophet Muhammad ﷺ. A day to remember his life, teachings, and character.",
      type: "major",
      actions: [
        "Send salawat upon the Prophet ﷺ",
        "Read his biography (Seerah)",
        "Share stories of his life",
        "Follow his Sunnah",
        "Gather for dhikr and nasheeds",
      ],
      dua: {
        arabic: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
        transliteration: "Allahumma salli ala Muhammad wa ala aali Muhammad",
        translation: "O Allah, send blessings upon Muhammad and upon the family of Muhammad.",
      },
    },

    // Rajab events
    {
      id: `isra-miraj-${year}`,
      name: "Isra and Mi'raj",
      local_name: "الإسراء والمعراج",
      date: format(new Date(year, 1, 7), "yyyy-MM-dd"), // 27th Rajab
      description:
        "The miraculous Night Journey from Makkah to Jerusalem and Ascension to the heavens where the five daily prayers were prescribed.",
      type: "major",
      actions: [
        "Pray extra night prayers (Tahajjud)",
        "Read about the journey in Surah Al-Isra",
        "Reflect on the gift of Salah",
        "Make sincere dua",
        "Appreciate the importance of prayer",
      ],
      specialPrayer: "Pray extra voluntary prayers throughout the night",
    },

    // Sha'ban events
    {
      id: `shab-e-barat-${year}`,
      name: "Shab-e-Barat (Mid-Sha'ban)",
      local_name: "ليلة النصف من شعبان",
      date: format(new Date(year, 1, 24), "yyyy-MM-dd"), // 15th Sha'ban
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

    // Ramadan events
    {
      id: `ramadan-start-${year}`,
      name: "Ramadan Begins",
      local_name: "بداية رمضان",
      date: format(new Date(year, 2, 10), "yyyy-MM-dd"), // 1st Ramadan
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
      id: `laylatul-qadr-${year}`,
      name: "Laylat al-Qadr (Night of Power)",
      local_name: "ليلة القدر",
      date: format(new Date(year, 3, 5), "yyyy-MM-dd"), // 27th Ramadan (approximate)
      description:
        "The most blessed night of the year, better than a thousand months. The Quran was revealed on this night.",
      type: "major",
      actions: [
        "Stay up in prayer and worship",
        "Recite Quran extensively",
        "Make abundant dua",
        "Seek forgiveness",
        "Give charity",
        "Perform I'tikaf if possible",
      ],
      dua: {
        arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
        transliteration: "Allahumma innaka afuwwun tuhibbul afwa fa'fu anni",
        translation: "O Allah, You are Forgiving and love forgiveness, so forgive me.",
      },
      specialPrayer: "Pray as many voluntary prayers as possible throughout the night",
    },

    // Shawwal events
    {
      id: `eid-al-fitr-${year}`,
      name: "Eid al-Fitr",
      local_name: "عيد الفطر",
      date: format(new Date(year, 3, 9), "yyyy-MM-dd"), // 1st Shawwal
      description:
        "Festival of Breaking the Fast, celebrating the completion of Ramadan. A day of joy, gratitude, and community.",
      type: "major",
      actions: [
        "Perform Ghusl (ritual bath)",
        "Wear best clothes",
        "Pay Zakat al-Fitr before prayer",
        "Attend Eid prayer",
        "Say Takbeer",
        "Visit family and friends",
        "Give gifts to children",
        "Spread joy and happiness",
      ],
      dua: {
        arabic: "تَقَبَّلَ اللهُ مِنَّا وَمِنْكُم",
        transliteration: "Taqabbal Allahu minna wa minkum",
        translation: "May Allah accept from us and from you.",
      },
      specialPrayer: "Eid prayer (2 rakaat) with extra takbeerat",
    },
    {
      id: `six-shawwal-${year}`,
      name: "Six Days of Shawwal",
      local_name: "صيام ستة أيام من شوال",
      date: format(new Date(year, 3, 10), "yyyy-MM-dd"), // 2nd Shawwal onwards
      description: "Fasting six days in Shawwal after Eid is like fasting the entire year.",
      type: "sunnah",
      actions: [
        "Fast any 6 days during Shawwal",
        "Can be consecutive or spread out",
        "Combine with making up missed fasts",
        "Continue the spirit of Ramadan",
      ],
    },

    // Dhul Hijjah events
    {
      id: `first-ten-dhul-hijjah-${year}`,
      name: "First 10 Days of Dhul Hijjah",
      local_name: "العشر الأوائل من ذي الحجة",
      date: format(new Date(year, 5, 7), "yyyy-MM-dd"), // 1st Dhul Hijjah
      description:
        "The most blessed days of the year. Good deeds are more beloved to Allah in these days than any other days.",
      type: "major",
      actions: [
        "Increase in dhikr and worship",
        "Fast especially on the 9th (Arafah)",
        "Give charity",
        "Make takbeer often",
        "Avoid cutting hair/nails if doing Qurbani",
        "Read Quran",
      ],
      dua: {
        arabic:
          "اللهُ أَكْبَرُ، اللهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللهُ، وَاللهُ أَكْبَرُ، اللهُ أَكْبَرُ، وَلِلَّهِ الْحَمْدُ",
        transliteration:
          "Allahu Akbar, Allahu Akbar, La ilaha illallah, Wallahu Akbar, Allahu Akbar, wa lillahil hamd",
        translation:
          "Allah is the Greatest, Allah is the Greatest, there is no god but Allah, Allah is the Greatest, Allah is the Greatest, and to Allah belongs all praise.",
      },
    },
    {
      id: `day-of-arafah-${year}`,
      name: "Day of Arafah",
      local_name: "يوم عرفة",
      date: format(new Date(year, 5, 15), "yyyy-MM-dd"), // 9th Dhul Hijjah
      description:
        "The best day of the year. Pilgrims stand at Arafah. Fasting on this day expiates sins of two years.",
      type: "fasting",
      actions: [
        "Fast this day (for non-pilgrims)",
        "Make abundant dua",
        "Seek forgiveness",
        "Recite takbeer",
        "Reflect on the Day of Judgment",
      ],
      dua: {
        arabic:
          "لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
        transliteration:
          "La ilaha illallahu wahdahu la shareeka lahu, lahul mulku wa lahul hamdu wa huwa ala kulli shayin qadeer",
        translation:
          "There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He is Able to do all things.",
      },
      specialPrayer: "Fast and make dua throughout the day, especially after Asr",
    },
    {
      id: `eid-al-adha-${year}`,
      name: "Eid al-Adha",
      local_name: "عيد الأضحى",
      date: format(new Date(year, 5, 16), "yyyy-MM-dd"), // 10th Dhul Hijjah
      description:
        "Festival of Sacrifice commemorating Prophet Ibrahim's willingness to sacrifice his son. Muslims worldwide perform Qurbani.",
      type: "major",
      actions: [
        "Perform Ghusl",
        "Wear best clothes",
        "Attend Eid prayer",
        "Perform Qurbani (sacrifice)",
        "Distribute meat to poor, neighbors, and family",
        "Visit family and friends",
        "Say Takbeer",
      ],
      dua: {
        arabic: "تَقَبَّلَ اللهُ مِنَّا وَمِنْكُم",
        transliteration: "Taqabbal Allahu minna wa minkum",
        translation: "May Allah accept from us and from you.",
      },
      specialPrayer: "Eid prayer (2 rakaat) - Do not eat before the prayer",
    },
    {
      id: `days-of-tashreeq-${year}`,
      name: "Days of Tashreeq",
      local_name: "أيام التشريق",
      date: format(new Date(year, 5, 17), "yyyy-MM-dd"), // 11-13th Dhul Hijjah
      description:
        "The three days following Eid al-Adha. Days of eating, drinking, and remembering Allah. Fasting is prohibited.",
      type: "major",
      actions: [
        "Continue takbeer after prayers",
        "Complete Qurbani distribution",
        "Celebrate with family",
        "Remember Allah abundantly",
        "Do NOT fast these days",
      ],
      dua: {
        arabic: "اللهُ أَكْبَرُ، اللهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللهُ",
        transliteration: "Allahu Akbar, Allahu Akbar, La ilaha illallah",
        translation: "Allah is the Greatest, Allah is the Greatest, there is no god but Allah.",
      },
    },

    // Regular Sunnah fasts
    {
      id: `monday-fast-${year}-1`,
      name: "White Days (Ayyam al-Beed)",
      local_name: "أيام البيض",
      date: format(new Date(year, 0, 13), "yyyy-MM-dd"), // Example - 13th of month
      description:
        "Fasting the 13th, 14th, and 15th of each lunar month. The Prophet ﷺ recommended these fasts.",
      type: "sunnah",
      actions: [
        "Fast on the 13th, 14th, and 15th of each lunar month",
        "These are the days when the moon is fullest",
        "Equals fasting the entire month in reward",
      ],
    },

    // Historical events
    {
      id: `battle-of-badr-${year}`,
      name: "Battle of Badr Anniversary",
      local_name: "ذكرى غزوة بدر",
      date: format(new Date(year, 2, 27), "yyyy-MM-dd"), // 17th Ramadan
      description:
        "The first major battle in Islamic history where 313 Muslims defeated over 1000 Quraysh. Known as Yawm al-Furqan (Day of Criterion).",
      type: "historical",
      actions: [
        "Read about the battle and its lessons",
        "Reflect on the sacrifices of the Companions",
        "Make dua for the Ummah",
        "Learn about the participants",
      ],
    },
    {
      id: `conquest-of-makkah-${year}`,
      name: "Conquest of Makkah",
      local_name: "فتح مكة",
      date: format(new Date(year, 3, 1), "yyyy-MM-dd"), // 20th Ramadan
      description:
        "The peaceful conquest of Makkah in 8 AH when the Prophet ﷺ entered with 10,000 companions and forgave his enemies.",
      type: "historical",
      actions: [
        "Reflect on forgiveness and mercy",
        "Study the Prophet's magnanimity",
        "Learn about breaking idols in the Kaaba",
        "Appreciate the triumph of Islam",
      ],
    },
  ];

  return events;
}

export function useIslamicHolidays() {
  const currentYear = new Date().getFullYear();

  const holidays = useMemo(() => {
    // Get events for current year and next year to cover full calendar range
    const thisYearEvents = getIslamicEventsForYear(currentYear);
    const nextYearEvents = getIslamicEventsForYear(currentYear + 1);

    return [...thisYearEvents, ...nextYearEvents];
  }, [currentYear]);

  return { holidays, loading: false };
}
