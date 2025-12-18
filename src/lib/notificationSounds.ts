// Notification sound utilities

type SoundType = 'message' | 'call' | 'notification';

const soundFrequencies: Record<SoundType, { freq: number; duration: number; pattern: number[] }> = {
  message: { freq: 880, duration: 0.15, pattern: [1] },
  call: { freq: 440, duration: 0.3, pattern: [1, 0.2, 1, 0.2, 1] },
  notification: { freq: 800, duration: 0.2, pattern: [1] },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Audio context not supported');
      return null;
    }
  }
  return audioContext;
}

export function playSound(type: SoundType): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const { freq, duration, pattern } = soundFrequencies[type];
  let timeOffset = 0;

  pattern.forEach((multiplier, index) => {
    if (index % 2 === 0) {
      // Sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq * multiplier;
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + timeOffset;
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);

      timeOffset += duration;
    } else {
      // Gap
      timeOffset += multiplier;
    }
  });
}

export function playMessageSound(): void {
  playSound('message');
}

export function playCallSound(): void {
  playSound('call');
}

export function playNotificationSound(): void {
  playSound('notification');
}

// Ringtone for incoming calls - plays repeatedly
let ringtoneInterval: NodeJS.Timeout | null = null;

export function startRingtone(): void {
  stopRingtone();
  playCallSound();
  ringtoneInterval = setInterval(() => {
    playCallSound();
  }, 2000);
}

export function stopRingtone(): void {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

// Desktop notification helper
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

export function showDesktopNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }
  
  return new Notification(title, {
    icon: '/pwa-192x192.svg',
    ...options,
  });
}

export function showMessageNotification(senderName: string, message: string): void {
  playMessageSound();
  showDesktopNotification(`New message from ${senderName}`, {
    body: message.length > 100 ? message.slice(0, 100) + '...' : message,
    tag: 'chat-message',
  });
}

export function showCallNotification(callerName: string, callType: 'video' | 'audio'): void {
  startRingtone();
  showDesktopNotification(`Incoming ${callType} call`, {
    body: `${callerName} is calling you`,
    tag: 'incoming-call',
    requireInteraction: true,
  });
}
