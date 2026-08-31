/**
 * src/lib/audio-notifications.ts
 *
 * WhatsApp-style audio cues & haptic feedback for incoming messages and calls.
 * Built using the Web Audio API + navigator.vibrate so it works instantly
 * across Web, PWA, and Capacitor Android WebViews without depending on external asset downloads.
 */

let audioCtx: AudioContext | null = null;
let ringtoneIntervalId: ReturnType<typeof setInterval> | null = null;
let vibrationIntervalId: ReturnType<typeof setInterval> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a crisp, pleasant WhatsApp-style two-tone message chime and triggers a short vibration.
 */
export function playMessageNotificationSound(): void {
  try {
    // 1. Haptic vibration (short double pulse)
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([100, 60, 100]);
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First tone (F5 - 698.46 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(698.46, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // slide to A5

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.18);

    // Second tone (C6 - 1046.50 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046.5, now + 0.1);

    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.warn("[Audio] Could not play message chime:", err);
  }
}

/**
 * Plays a single cycle of the incoming call melody.
 */
function playRingtoneCycle(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [
    { freq: 440.0, time: 0, dur: 0.18 }, // A4
    { freq: 554.37, time: 0.2, dur: 0.18 }, // C#5
    { freq: 659.25, time: 0.4, dur: 0.25 }, // E5
    { freq: 880.0, time: 0.7, dur: 0.45 }, // A5
    { freq: 659.25, time: 1.25, dur: 0.2 }, // E5
    { freq: 880.0, time: 1.5, dur: 0.5 }, // A5
  ];

  const startTime = ctx.currentTime + 0.05;

  notes.forEach((n) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, startTime + n.time);

      gain.gain.setValueAtTime(0, startTime + n.time);
      gain.gain.linearRampToValueAtTime(0.3, startTime + n.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.time + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + n.time);
      osc.stop(startTime + n.time + n.dur);
    } catch {
      // Ignore oscillator errors if context state changes
    }
  });
}

/**
 * Starts continuous incoming call ringtone and repeating haptic vibration.
 */
export function startIncomingCallRingtone(): void {
  stopIncomingCallRingtone();

  // Trigger first cycle immediately
  playRingtoneCycle();

  // Repeat melody every 2.4 seconds
  ringtoneIntervalId = setInterval(() => {
    playRingtoneCycle();
  }, 2400);

  // Pulsing vibration
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate([500, 300, 500, 300]);
    vibrationIntervalId = setInterval(() => {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([500, 300, 500, 300]);
      }
    }, 2000);
  }
}

/**
 * Stops the incoming call ringtone and resets vibration.
 */
export function stopIncomingCallRingtone(): void {
  if (ringtoneIntervalId) {
    clearInterval(ringtoneIntervalId);
    ringtoneIntervalId = null;
  }
  if (vibrationIntervalId) {
    clearInterval(vibrationIntervalId);
    vibrationIntervalId = null;
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(0);
  }
}
