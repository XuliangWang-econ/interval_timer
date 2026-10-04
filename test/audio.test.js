// test/audio.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../js/audio.js';

describe('Audio Engine Synthetic Mixer', () => {
  it('instantiates and respects mute toggle', () => {
    const audio = new AudioEngine();
    assert.equal(audio.isMuted(), false);
    audio.setMuted(true);
    assert.equal(audio.isMuted(), true);
    audio.setMuted(false);
    assert.equal(audio.isMuted(), false);
  });

  it('does not throw when triggering sounds while muted or unmuted in node env without window', () => {
    const audio = new AudioEngine();
    assert.doesNotThrow(() => {
      audio.playBeep321();
      audio.playWorkStart();
      audio.playRestStart();
      audio.playComplete();
    });
  });

  it('interacts correctly with Web Audio API mock when window.AudioContext is present', async () => {
    const createdOscillators = [];
    const createdGains = [];
    let resumed = false;

    class MockGainNode {
      constructor() {
        this.gain = {
          setValueAtTime: (val, time) => { this.gainVal = val; },
          linearRampToValueAtTime: (val, time) => {},
          exponentialRampToValueAtTime: (val, time) => {}
        };
        createdGains.push(this);
      }
      connect(target) {}
    }

    class MockOscillatorNode {
      constructor() {
        this.type = 'sine';
        this.frequency = {
          freqVal: null,
          rampFreqVal: null,
          setValueAtTime: (val, time) => { this.frequency.freqVal = val; },
          exponentialRampToValueAtTime: (val, time) => { this.frequency.rampFreqVal = val; }
        };
        this.started = false;
        this.stopped = false;
        createdOscillators.push(this);
      }
      connect(target) {}
      start(time) { this.started = true; }
      stop(time) { this.stopped = true; }
    }

    class MockAudioContext {
      constructor() {
        this.state = 'suspended';
        this.currentTime = 10;
        this.destination = {};
      }
      resume() {
        this.state = 'running';
        resumed = true;
        return Promise.resolve();
      }
      createOscillator() {
        return new MockOscillatorNode();
      }
      createGain() {
        return new MockGainNode();
      }
    }

    // Set mock window with AudioContext
    global.window = {
      AudioContext: MockAudioContext
    };

    try {
      const audio = new AudioEngine();
      await audio.unlock();
      assert.equal(resumed, true);

      // Play Beep 3-2-1
      audio.playBeep321();
      assert.equal(createdOscillators.length, 1);
      assert.equal(createdOscillators[0].frequency.freqVal, 880);
      assert.equal(createdOscillators[0].type, 'sine');
      assert.equal(createdOscillators[0].started, true);

      // Play Work Start
      audio.playWorkStart();
      assert.equal(createdOscillators.length, 2);
      assert.equal(createdOscillators[1].frequency.freqVal, 880);
      assert.equal(createdOscillators[1].frequency.rampFreqVal, 1760);
      assert.equal(createdOscillators[1].type, 'triangle');

      // Play Rest Start
      audio.playRestStart();
      assert.equal(createdOscillators.length, 3);
      assert.equal(createdOscillators[2].frequency.freqVal, 880);
      assert.equal(createdOscillators[2].frequency.rampFreqVal, 440);

      // When muted, no sounds should be created
      audio.setMuted(true);
      const countBefore = createdOscillators.length;
      audio.playBeep321();
      audio.playWorkStart();
      audio.playRestStart();
      audio.playComplete();
      assert.equal(createdOscillators.length, countBefore);
    } finally {
      delete global.window;
    }
  });
});
