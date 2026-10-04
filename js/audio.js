// js/audio.js
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  getContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    return this.ctx;
  }

  async unlock() {
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn('Audio resume failed', e);
      }
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  isMuted() {
    return this.muted;
  }

  playTone(frequency, durationMs, type = 'sine', rampFrequency = null) {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (rampFrequency) {
        osc.frequency.exponentialRampToValueAtTime(rampFrequency, now + durationMs / 1000);
      }

      // Smooth attack and decay envelope to prevent popping sounds
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationMs / 1000);
    } catch (e) {
      console.warn('Tone playback failed', e);
    }
  }

  playBeep321() {
    // 880Hz (A5) clear short beep
    this.playTone(880, 120, 'sine');
  }

  playWorkStart() {
    // 880Hz leaping to 1760Hz
    this.playTone(880, 300, 'triangle', 1760);
  }

  playRestStart() {
    // 880Hz falling to 440Hz
    this.playTone(880, 350, 'sine', 440);
  }

  playComplete() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Victory chime chords: 587Hz (D5), 880Hz (A5), 1174Hz (D6)
    [587, 880, 1174].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 250, 'triangle');
      }, idx * 160);
    });
  }
}
