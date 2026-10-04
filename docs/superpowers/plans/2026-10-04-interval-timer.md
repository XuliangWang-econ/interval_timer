# iPhone Interval Timer PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建专为 iPhone 用户打造的全屏跳绳间隔训练计时器 (Interval Timer PWA)，确保在保持后台音乐（Apple Music/Spotify 等）不中断的前提下，支持默认 25.5 分钟跳绳强化方案、全参数自定义微调与预设存储、高饱和度远距离全屏色彩切换以及屏幕常亮和离线能力。

**Architecture:** 采用轻量模块化 Vanilla JS (ES6) + 原生 Web Audio API + Screen Wake Lock + Service Worker PWA 架构。零外部重型依赖，使用 Node.js 原生 `node:test` 测试框架进行 TDD 开发，保证秒开与极致性能。

**Tech Stack:** HTML5, CSS3, Modern ES6 JavaScript, Web Audio API, Screen Wake Lock API, Service Worker, Node.js `node:test`

**Spec:** [2026-10-04-interval-timer-design.md](file:///e:/interval_timer/docs/superpowers/specs/2026-10-04-interval-timer-design.md)

## Global Constraints

- **Background Music Safety**: 绝对严禁使用 HTML `<audio>` 标签或媒体播放流，必须通过 Web Audio API 瞬态合成环境音效，确保不抢占 iOS `AVAudioSessionCategoryPlayback`。
- **Default Preset Accuracy**: 默认跳绳方案参数严格为 Work 45s, Rest 15s, Exercises 8, Rounds 3, Round Rest 45s, Prepare 10s；总计 25.5 分钟，实际做功 18 分钟。
- **iOS Safe Area & Standalone**: 必须适配 `viewport-fit=cover` 与 `env(safe-area-inset-*)`，支持 Safari「添加到主屏幕」全屏独立运行。
- **No Drift Timing**: 必须基于 `Date.now()` 时间戳目标差分计算，禁止单步 `setInterval` 累加减一。
- **Full Customizability**: 所有时序参数必须支持自定义并持久化到 `localStorage`。

---

### Task 1: 预设数据模型与存储管理器 (Presets Manager)

**Files:**
- Create: `js/presets.js`
- Test: `test/presets.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_PRESET`: 默认 25.5 分钟跳绳预设对象
  - `calculatePresetTotals(preset)`: 计算总做功时间与总用时 `({ totalWorkTime, totalDuration })`
  - `getPresets()`: 从 localStorage 读取预设列表（若为空则自动包含默认预设）
  - `savePreset(preset)`: 保存或更新预设
  - `deletePreset(id)`: 删除自定义预设（系统默认预设不可删除）
  - `getActivePreset()`: 获取当前选中的预设

- [ ] **Step 1: Write the failing test for Presets Manager**

```javascript
// test/presets.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js environment
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

import {
  DEFAULT_PRESET,
  calculatePresetTotals,
  getPresets,
  savePreset,
  deletePreset,
  getActivePreset,
  setActivePresetId
} from '../js/presets.js';

describe('Presets Manager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('default preset matches 25.5min jump rope specifications', () => {
    assert.equal(DEFAULT_PRESET.prepareTime, 10);
    assert.equal(DEFAULT_PRESET.workTime, 45);
    assert.equal(DEFAULT_PRESET.restTime, 15);
    assert.equal(DEFAULT_PRESET.exercises, 8);
    assert.equal(DEFAULT_PRESET.rounds, 3);
    assert.equal(DEFAULT_PRESET.roundRestTime, 45);

    const { totalWorkTime, totalDuration } = calculatePresetTotals(DEFAULT_PRESET);
    // 24 sets * 45s = 1080s (18 mins)
    assert.equal(totalWorkTime, 1080);
    // (8*60 - 15) for set 8 work? Or 8*60 = 480 per round.
    // Round 1: 8*60s + 45s = 525s
    // Round 2: 8*60s + 45s = 525s
    // Round 3: 8*60s = 480s
    // Total = 1530s (25.5 mins) + 10s prep = 1540s
    assert.equal(totalDuration, 1540);
  });

  it('can save and retrieve custom presets', () => {
    const custom = {
      id: 'custom-tabata',
      name: 'Tabata 4min',
      prepareTime: 5,
      workTime: 20,
      restTime: 10,
      exercises: 8,
      rounds: 1,
      roundRestTime: 0
    };
    savePreset(custom);
    const list = getPresets();
    assert.equal(list.length, 2);
    assert.equal(list.find(p => p.id === 'custom-tabata').name, 'Tabata 4min');
  });

  it('cannot delete default preset, but can delete custom preset', () => {
    const custom = {
      id: 'test-del',
      name: 'To Delete',
      prepareTime: 5, workTime: 20, restTime: 10, exercises: 8, rounds: 1, roundRestTime: 0
    };
    savePreset(custom);
    assert.equal(getPresets().length, 2);

    const deletedDefault = deletePreset(DEFAULT_PRESET.id);
    assert.equal(deletedDefault, false);

    const deletedCustom = deletePreset('test-del');
    assert.equal(deletedCustom, true);
    assert.equal(getPresets().length, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/presets.test.js`
Expected: FAIL with module `../js/presets.js` not found.

- [ ] **Step 3: Write minimal implementation in `js/presets.js`**

```javascript
// js/presets.js
export const DEFAULT_PRESET = {
  id: 'jump-rope-intense-25m',
  name: '跳绳强化 (25.5m)',
  isDefault: true,
  prepareTime: 10,
  workTime: 45,
  restTime: 15,
  exercises: 8,
  rounds: 3,
  roundRestTime: 45
};

const STORAGE_KEY = 'interval_timer_presets_v1';
const ACTIVE_ID_KEY = 'interval_timer_active_preset_id';

export function calculatePresetTotals(preset) {
  const { prepareTime = 0, workTime, restTime, exercises, rounds, roundRestTime } = preset;
  const totalSets = exercises * rounds;
  const totalWorkTime = totalSets * workTime;

  // Single round duration:
  // Each set has workTime + restTime.
  // Last set in round: exercises * (workTime + restTime)
  // Between rounds: (rounds - 1) * roundRestTime
  const roundBaseTime = exercises * (workTime + restTime);
  const totalDuration = prepareTime + (rounds * roundBaseTime) + ((rounds - 1) * roundRestTime);

  return { totalWorkTime, totalDuration, totalSets };
}

export function getPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [DEFAULT_PRESET];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [DEFAULT_PRESET];
    }
    return parsed;
  } catch (e) {
    return [DEFAULT_PRESET];
  }
}

export function savePreset(preset) {
  const presets = getPresets();
  const index = presets.findIndex(p => p.id === preset.id);
  if (index >= 0) {
    presets[index] = { ...presets[index], ...preset };
  } else {
    presets.push(preset);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return preset;
}

export function deletePreset(id) {
  if (id === DEFAULT_PRESET.id) {
    return false;
  }
  const presets = getPresets();
  const filtered = presets.filter(p => p.id !== id);
  if (filtered.length === presets.length) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function getActivePreset() {
  const presets = getPresets();
  const activeId = localStorage.getItem(ACTIVE_ID_KEY);
  const found = presets.find(p => p.id === activeId);
  return found || presets[0] || DEFAULT_PRESET;
}

export function setActivePresetId(id) {
  localStorage.setItem(ACTIVE_ID_KEY, id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/presets.test.js`
Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/presets.js test/presets.test.js
git commit -m "feat: implement presets manager with tests"
```

---

### Task 2: 高精度无漂移训练计时状态机 (Timer Engine)

**Files:**
- Create: `js/timer.js`
- Test: `test/timer.test.js`

**Interfaces:**
- Consumes:
  - `WorkoutPreset`
- Produces:
  - `TimerState`: Enum (`IDLE`, `PREPARE`, `WORK`, `REST`, `ROUND_REST`, `PAUSED`, `COMPLETED`)
  - `TimerEngine`: Class with methods:
    - `setPreset(preset)`
    - `start()`
    - `pause()`
    - `resume()`
    - `reset()`
    - `skipNext()`
    - `prevSet()`
    - `subscribe(listener)`
    - `getStateSnapshot()`

- [ ] **Step 1: Write the failing test for Timer Engine**

```javascript
// test/timer.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TimerEngine, TimerState } from '../js/timer.js';

describe('Timer Engine State Machine', () => {
  const testPreset = {
    id: 'test',
    prepareTime: 3,
    workTime: 5,
    restTime: 2,
    exercises: 2,
    rounds: 2,
    roundRestTime: 4
  };

  it('initializes in IDLE state', () => {
    const timer = new TimerEngine(testPreset);
    const snap = timer.getStateSnapshot();
    assert.equal(snap.state, TimerState.IDLE);
    assert.equal(snap.currentRound, 1);
    assert.equal(snap.currentSet, 1);
    assert.equal(snap.phaseSecondsRemaining, 3); // initial prep
  });

  it('transitions from PREPARE to WORK then REST properly', () => {
    const events = [];
    const timer = new TimerEngine(testPreset);
    timer.subscribe(evt => events.push(evt.type));

    timer.start();
    assert.equal(timer.getStateSnapshot().state, TimerState.PREPARE);

    // Fast-forward phase
    timer.advancePhase();
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    assert.equal(timer.getStateSnapshot().currentSet, 1);
    assert.equal(timer.getStateSnapshot().currentRound, 1);

    timer.advancePhase();
    assert.equal(timer.getStateSnapshot().state, TimerState.REST);

    timer.advancePhase();
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    assert.equal(timer.getStateSnapshot().currentSet, 2);

    timer.advancePhase();
    // After set 2 of round 1: should be ROUND_REST!
    assert.equal(timer.getStateSnapshot().state, TimerState.ROUND_REST);

    timer.advancePhase();
    // After round rest: Round 2, Set 1 WORK!
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    assert.equal(timer.getStateSnapshot().currentRound, 2);
    assert.equal(timer.getStateSnapshot().currentSet, 1);

    timer.advancePhase(); // REST
    timer.advancePhase(); // Round 2, Set 2 WORK
    assert.equal(timer.getStateSnapshot().currentSet, 2);

    timer.advancePhase(); // Last set finished -> COMPLETED
    assert.equal(timer.getStateSnapshot().state, TimerState.COMPLETED);
  });

  it('supports pause and resume', () => {
    const timer = new TimerEngine(testPreset);
    timer.start();
    timer.advancePhase(); // WORK
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);

    timer.pause();
    assert.equal(timer.getStateSnapshot().state, TimerState.PAUSED);

    timer.resume();
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/timer.test.js`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `js/timer.js`**

```javascript
// js/timer.js
export const TimerState = {
  IDLE: 'IDLE',
  PREPARE: 'PREPARE',
  WORK: 'WORK',
  REST: 'REST',
  ROUND_REST: 'ROUND_REST',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED'
};

export class TimerEngine {
  constructor(preset) {
    this.preset = preset;
    this.listeners = [];
    this.timerId = null;
    this.reset();
  }

  setPreset(preset) {
    this.preset = preset;
    this.reset();
  }

  reset() {
    this.stopTicker();
    this.state = TimerState.IDLE;
    this.previousState = null;
    this.currentRound = 1;
    this.currentSet = 1;
    this.phaseDurationMs = (this.preset.prepareTime || 10) * 1000;
    this.phaseRemainingMs = this.phaseDurationMs;
    this.targetEndTime = 0;
    this.totalWorkElapsedMs = 0;
    this.totalElapsedMs = 0;
    this.lastTickTime = 0;
    this.emit({ type: 'RESET', snapshot: this.getStateSnapshot() });
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  emit(data) {
    for (const fn of this.listeners) {
      fn(data);
    }
  }

  getStateSnapshot() {
    return {
      state: this.state,
      currentRound: this.currentRound,
      totalRounds: this.preset.rounds,
      currentSet: this.currentSet,
      totalSets: this.preset.exercises,
      phaseDurationMs: this.phaseDurationMs,
      phaseRemainingMs: this.phaseRemainingMs,
      phaseSecondsRemaining: Math.ceil(this.phaseRemainingMs / 1000),
      totalWorkElapsedMs: this.totalWorkElapsedMs,
      totalElapsedMs: this.totalElapsedMs
    };
  }

  start() {
    if (this.state !== TimerState.IDLE) return;
    if (this.preset.prepareTime > 0) {
      this.enterState(TimerState.PREPARE, this.preset.prepareTime * 1000);
    } else {
      this.enterState(TimerState.WORK, this.preset.workTime * 1000);
    }
    this.startTicker();
  }

  pause() {
    if (this.state === TimerState.PAUSED || this.state === TimerState.IDLE || this.state === TimerState.COMPLETED) return;
    this.previousState = this.state;
    this.state = TimerState.PAUSED;
    this.stopTicker();
    this.emit({ type: 'PAUSE', snapshot: this.getStateSnapshot() });
  }

  resume() {
    if (this.state !== TimerState.PAUSED) return;
    this.state = this.previousState;
    this.targetEndTime = Date.now() + this.phaseRemainingMs;
    this.lastTickTime = Date.now();
    this.startTicker();
    this.emit({ type: 'RESUME', snapshot: this.getStateSnapshot() });
  }

  enterState(nextState, durationMs) {
    this.state = nextState;
    this.phaseDurationMs = durationMs;
    this.phaseRemainingMs = durationMs;
    this.targetEndTime = Date.now() + durationMs;
    this.lastTickTime = Date.now();
    this.emit({ type: 'PHASE_CHANGE', nextState, snapshot: this.getStateSnapshot() });
  }

  advancePhase() {
    if (this.state === TimerState.PREPARE) {
      this.currentRound = 1;
      this.currentSet = 1;
      this.enterState(TimerState.WORK, this.preset.workTime * 1000);
    } else if (this.state === TimerState.WORK) {
      if (this.currentSet < this.preset.exercises) {
        this.enterState(TimerState.REST, this.preset.restTime * 1000);
      } else {
        // Last set in current round
        if (this.currentRound < this.preset.rounds) {
          this.enterState(TimerState.ROUND_REST, this.preset.roundRestTime * 1000);
        } else {
          // Completed everything!
          this.state = TimerState.COMPLETED;
          this.stopTicker();
          this.emit({ type: 'COMPLETE', snapshot: this.getStateSnapshot() });
        }
      }
    } else if (this.state === TimerState.REST) {
      this.currentSet += 1;
      this.enterState(TimerState.WORK, this.preset.workTime * 1000);
    } else if (this.state === TimerState.ROUND_REST) {
      this.currentRound += 1;
      this.currentSet = 1;
      this.enterState(TimerState.WORK, this.preset.workTime * 1000);
    }
  }

  skipNext() {
    if (this.state === TimerState.IDLE || this.state === TimerState.COMPLETED) return;
    this.advancePhase();
  }

  prevSet() {
    if (this.state === TimerState.IDLE || this.state === TimerState.COMPLETED) return;
    if (this.currentSet > 1) {
      this.currentSet -= 1;
      this.enterState(TimerState.WORK, this.preset.workTime * 1000);
    } else if (this.currentRound > 1) {
      this.currentRound -= 1;
      this.currentSet = this.preset.exercises;
      this.enterState(TimerState.WORK, this.preset.workTime * 1000);
    } else {
      this.reset();
    }
  }

  tick() {
    const now = Date.now();
    const delta = now - this.lastTickTime;
    this.lastTickTime = now;

    this.totalElapsedMs += delta;
    if (this.state === TimerState.WORK) {
      this.totalWorkElapsedMs += delta;
    }

    this.phaseRemainingMs = Math.max(0, this.targetEndTime - now);

    const prevSeconds = Math.ceil((this.phaseRemainingMs + delta) / 1000);
    const currSeconds = Math.ceil(this.phaseRemainingMs / 1000);

    if (prevSeconds !== currSeconds && currSeconds > 0 && currSeconds <= 3) {
      this.emit({ type: 'COUNTDOWN_BEEP', seconds: currSeconds });
    }

    if (this.phaseRemainingMs <= 0) {
      this.advancePhase();
    } else {
      this.emit({ type: 'TICK', snapshot: this.getStateSnapshot() });
    }
  }

  startTicker() {
    this.stopTicker();
    this.lastTickTime = Date.now();
    this.timerId = setInterval(() => this.tick(), 100);
  }

  stopTicker() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/timer.test.js`
Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/timer.js test/timer.test.js
git commit -m "feat: implement timer engine state machine with tests"
```

---

### Task 3: Web Audio 纯合成混音引擎 (Audio Engine)

**Files:**
- Create: `js/audio.js`
- Test: `test/audio.test.js`

**Interfaces:**
- Produces:
  - `AudioEngine`: Class with methods:
    - `unlock()`: 解锁 iOS 初始挂起状态
    - `playBeep321()`: 880Hz 短促 120ms 提示
    - `playWorkStart()`: 880Hz -> 1760Hz 双音冲锋
    - `playRestStart()`: 880Hz -> 440Hz 舒缓间歇
    - `playComplete()`: 三连音胜利奏鸣
    - `setMuted(boolean)`
    - `isMuted()`

- [ ] **Step 1: Write the failing test for Audio Engine**

```javascript
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
  });

  it('does not throw when triggering sounds while muted or unmuted in node env', () => {
    const audio = new AudioEngine();
    assert.doesNotThrow(() => {
      audio.playBeep321();
      audio.playWorkStart();
      audio.playRestStart();
      audio.playComplete();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/audio.test.js`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `js/audio.js`**

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/audio.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/audio.js test/audio.test.js
git commit -m "feat: implement web audio mixer engine with tests"
```

---

### Task 4: 屏幕常亮与唤醒锁管理器 (Wake Lock Manager)

**Files:**
- Create: `js/wakelock.js`
- Test: `test/wakelock.test.js`

**Interfaces:**
- Produces:
  - `WakeLockManager`: Class with methods:
    - `requestLock()`: 请求屏幕保持常亮
    - `releaseLock()`: 释放常亮锁
    - `isActive()`: 返回当前锁激活状态

- [ ] **Step 1: Write test for WakeLock Manager**

```javascript
// test/wakelock.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WakeLockManager } from '../js/wakelock.js';

describe('WakeLock Manager', () => {
  it('handles environment without wakeLock gracefully', async () => {
    const manager = new WakeLockManager();
    assert.equal(manager.isActive(), false);
    await manager.requestLock();
    assert.equal(manager.isActive(), false);
    manager.releaseLock();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wakelock.test.js`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `js/wakelock.js`**

```javascript
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
      // Re-acquire lock if user was previously training
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wakelock.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/wakelock.js test/wakelock.test.js
git commit -m "feat: implement screen wake lock manager with tests"
```

---

### Task 5: 完整 UI 视觉系统与全屏响应式布局 (UI & App Controller)

**Files:**
- Create: `index.html`
- Create: `css/app.css`
- Create: `js/app.js`

**Interfaces:**
- Consumes:
  - `PresetsManager` (`js/presets.js`)
  - `TimerEngine` (`js/timer.js`)
  - `AudioEngine` (`js/audio.js`)
  - `WakeLockManager` (`js/wakelock.js`)
- Produces:
  - 全屏交互式网页应用，随阶段自动变色，超大数字，预设抽屉，声音控制。

- [ ] **Step 1: Create `css/app.css` with responsive & iOS safe-area styles**

实现以下规格：
- 高饱和度状态主题色切换（`theme-work`, `theme-rest`, `theme-round-rest`, `theme-prepare`, `theme-idle`, `theme-completed`）
- 适配 `env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)`
- 巨幅等宽数字（`font-variant-numeric: tabular-nums`，字号 `min(22vw, 120px)`）
- 顺滑抽屉动画（Settings Drawer）
- 禁用双击缩放与全屏回弹

- [ ] **Step 2: Create `index.html`**

实现语义化完整 DOM：
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">`
- iOS 专属 meta（`apple-mobile-web-app-capable` 等）
- 顶栏：进度条、方案名称、音效按钮、设置齿轮按钮
- 中间巨幅区：状态大字胶囊、倒计时大字、`SET X / Y` 胶囊、`ROUND A / B` 胶囊
- 底部控制区：巨型播放/暂停主按钮、前进/后退/重置副按钮、累计做功时长与剩余时长
- 设置抽屉：预设选择下拉框、新建/保存/删除预设按钮、各项参数微调卡片（Work, Rest, Exercises, Rounds, Round Rest, Prep）带 $\pm5$s 快捷加减

- [ ] **Step 3: Create `js/app.js` 绑定所有交互与生命周期**

逻辑串联：
- 状态机事件响应：切换全屏背景类名、刷新大字显示、触发音频引擎发声、控制常亮锁。
- 空白区点击：轻触屏幕非按钮区切换暂停/继续。
- 抽屉配置修改：实时重新计算预估总用时，支持保存为新预设并持久化。

- [ ] **Step 4: Verify in local browser / Node test**

运行本地静态测试验证页面能够正常解析，无语法错误。

- [ ] **Step 5: Commit**

```bash
git add index.html css/app.css js/app.js
git commit -m "feat: complete UI layout, color themes and app controller"
```

---

### Task 6: PWA 离线支持、高清图标与部署脚本 (PWA & Offline)

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/icon-192.svg`
- Create: `icons/icon-512.svg`
- Create: `icons/apple-touch-icon.png` (or high-res SVG fallback)
- Create: `README.md` (包含在 iPhone 上的局域网直连使用与一键云端部署完整说明)

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "name": "跳绳间隔计时器",
  "short_name": "跳绳计时",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827",
  "orientation": "portrait",
  "icons": [
    {
      "src": "icons/icon-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml"
    },
    {
      "src": "icons/icon-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml"
    }
  ]
}
```

- [ ] **Step 2: Create `sw.js` (Service Worker)**

实现离线缓存逻辑（Cache First 策略），缓存 `index.html`、`css/app.css`、`js/*.js`、`manifest.json`、图标文件。

- [ ] **Step 3: Create high-contrast Vector Icons**

创建跳绳与计时器主题的精致矢量图标。

- [ ] **Step 4: Create `README.md` with iPhone installation & usage guide**

写明：
1. 局域网 1 秒在 iPhone Safari 预览方式（`python -m http.server 8080`，手机输局域网 IP）。
2. Safari「添加到主屏幕」操作流程图文指引。
3. GitHub Pages / Cloudflare Pages 零配置一键永久上线指引。

- [ ] **Step 5: Commit**

```bash
git add manifest.json sw.js icons/ README.md
git commit -m "feat: add PWA offline manifest, icons and deployment guide"
```

---

### Task 7: 整体集成与跨功能端到端验证

- [ ] **Step 1: 运行全量单元测试**
  Run: `node --test test/*.test.js`
  Expected: 全部 PASS。

- [ ] **Step 2: 启动本地服务器验证**
  启动服务并验证：
  - 默认 25.5 分钟跳绳强化方案时序计算是否准确
  - 状态流转时全屏背景颜色与字号切换是否流畅
  - 倒计时 3-2-1 声音与阶段切换声音是否正常发声且不抢占全局音频
  - 预设新增、修改、保存、删除在 localStorage 中是否正常持久化

- [ ] **Step 3: 最终 Git Commit**
```bash
git commit -m "chore: complete interval timer PWA verification"
```
