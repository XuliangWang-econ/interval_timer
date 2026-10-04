// js/wakelock.js
export class WakeLockManager {
  constructor() {
    this.wakeLock = null;
    this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    }
  }

  async requestLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request error:', err);
      return false;
    }
  }

  releaseLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  isActive() {
    return Boolean(this.wakeLock && !this.wakeLock.released);
  }

  async handleVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.wakeLock === null) {
      // Re-acquire lock if needed
    }
  }
}
