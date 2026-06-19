// Time-of-day-aware greeting bank used by GhostMode. Pure module so it
// is trivially unit-testable; pass `now` for deterministic tests.

const MORNING = [
  "Good morning! Ready to make today amazing?",
  "Rise and shine! What's on your mind?",
  "Morning! Let's tackle the day together.",
  "Hey there, early bird! How can I help?",
  "Good morning! What would you like to accomplish today?",
];

const AFTERNOON = [
  "Good afternoon! What can I do for you?",
  "Hey! Hope your day is going well. What's up?",
  "Afternoon! Ready when you are.",
  "Hi there! What's on your agenda?",
  "Good to see you! How can I assist?",
];

const EVENING = [
  "Good evening! How can I help you tonight?",
  "Hey! Winding down or just getting started?",
  "Evening! What's on your mind?",
  "Hi there! Ready to help with anything.",
  "Good evening! Let's make the most of it.",
];

const NIGHT = [
  "Hey, night owl! What's keeping you up?",
  "Burning the midnight oil? I'm here to help!",
  "Late night session? Let's get productive!",
  "Can't sleep? Let's chat about something.",
  "Night mode activated! What do you need?",
];

const MOTIVATIONAL_ADDONS = [
  " Remember, you've got this! 💪",
  " Every step forward counts.",
  " Let's make magic happen! ✨",
  " You're capable of amazing things.",
  "",
  "",
  "",
];

export function pickGreetingBank(hour: number): string[] {
  if (hour < 12) return MORNING;
  if (hour < 17) return AFTERNOON;
  if (hour < 21) return EVENING;
  return NIGHT;
}

export function getRandomGreeting(now: Date = new Date()): string {
  const bank = pickGreetingBank(now.getHours());
  const greeting = bank[Math.floor(Math.random() * bank.length)];
  const addon = MOTIVATIONAL_ADDONS[Math.floor(Math.random() * MOTIVATIONAL_ADDONS.length)];
  return greeting + addon;
}
