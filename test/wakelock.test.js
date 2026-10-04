// test/wakelock.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WakeLockManager } from '../js/wakelock.js';

describe('WakeLock Manager', () => {
  it('handles environment without wakeLock gracefully', async () => {
    const manager = new WakeLockManager();
    assert.equal(manager.isActive(), false);
    const result = await manager.requestLock();
    assert.equal(result, false);
    assert.equal(manager.isActive(), false);
    manager.releaseLock();
  });

  it('interacts correctly when navigator.wakeLock is present', async () => {
    let released = false;
    const mockSentinel = {
      released: false,
      listeners: {},
      addEventListener(type, cb) {
        this.listeners[type] = cb;
      },
      release() {
        this.released = true;
        released = true;
        if (this.listeners['release']) {
          this.listeners['release']();
        }
        return Promise.resolve();
      }
    };

    const mockWakeLock = {
      request: async (type) => {
        assert.equal(type, 'screen');
        return mockSentinel;
      }
    };

    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: mockWakeLock,
      configurable: true,
      writable: true
    });

    try {
      const manager = new WakeLockManager();
      assert.equal(manager.isActive(), false);

      const success = await manager.requestLock();
      assert.equal(success, true);
      assert.equal(manager.isActive(), true);

      manager.releaseLock();
      assert.equal(released, true);
      assert.equal(manager.isActive(), false);
    } finally {
      delete globalThis.navigator.wakeLock;
    }
  });

  it('handles wake lock request rejection gracefully', async () => {
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: {
        request: async () => {
          throw new Error('NotAllowedError');
        }
      },
      configurable: true,
      writable: true
    });

    try {
      const manager = new WakeLockManager();
      const success = await manager.requestLock();
      assert.equal(success, false);
      assert.equal(manager.isActive(), false);
    } finally {
      delete globalThis.navigator.wakeLock;
    }
  });
});
