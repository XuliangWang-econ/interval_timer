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
    if (this.timerId && typeof this.timerId.unref === 'function') {
      this.timerId.unref();
    }
  }

  stopTicker() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
