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

// Service Worker registration for push notifications
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    serviceWorkerRegistration = registration;
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Listen for messages from service worker
export function setupServiceWorkerListener(
  onAnswer: () => void,
  onDecline: () => void
): () => void {
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'NOTIFICATION_CLICK') {
      if (event.data.action === 'answer') {
        onAnswer();
      } else if (event.data.action === 'decline') {
        onDecline();
      }
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);
  
  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
}

// Desktop notification helper
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    // Also register service worker for push notifications
    await registerServiceWorker();
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerServiceWorker();
    }
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

export function showCallNotification(
  callerName: string, 
  callType: 'video' | 'audio',
  sessionId?: string
): void {
  startRingtone();
  
  // Try to use service worker for background notifications
  if (serviceWorkerRegistration?.active) {
    serviceWorkerRegistration.active.postMessage({
      type: 'SHOW_CALL_NOTIFICATION',
      callerName,
      callType,
      sessionId
    });
  } else {
    // Fallback to regular notification
    showDesktopNotification(`Incoming ${callType} call`, {
      body: `${callerName} is calling you`,
      tag: 'incoming-call',
      requireInteraction: true,
    });
  }
}
