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
    timer.reset();
  });

  it('supports skipNext and prevSet navigation', () => {
    const timer = new TimerEngine(testPreset);
    timer.start();
    // In PREPARE, skipNext moves to WORK Set 1
    timer.skipNext();
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    assert.equal(timer.getStateSnapshot().currentSet, 1);
    assert.equal(timer.getStateSnapshot().currentRound, 1);

    // skipNext to REST
    timer.skipNext();
    assert.equal(timer.getStateSnapshot().state, TimerState.REST);

    // skipNext to WORK Set 2
    timer.skipNext();
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    assert.equal(timer.getStateSnapshot().currentSet, 2);

    // prevSet goes back to Set 1 WORK
    timer.prevSet();
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    assert.equal(timer.getStateSnapshot().currentSet, 1);
    assert.equal(timer.getStateSnapshot().currentRound, 1);

    // prevSet from Set 1 Round 1 resets to IDLE
    timer.prevSet();
    assert.equal(timer.getStateSnapshot().state, TimerState.IDLE);
    timer.reset();
  });

  it('prevSet navigates back across rounds', () => {
    const timer = new TimerEngine(testPreset);
    timer.start();
    // Fast forward to Round 2, Set 1
    timer.advancePhase(); // Round 1 Set 1 WORK
    timer.advancePhase(); // Round 1 Set 1 REST
    timer.advancePhase(); // Round 1 Set 2 WORK
    timer.advancePhase(); // Round 1 ROUND_REST
    timer.advancePhase(); // Round 2 Set 1 WORK
    assert.equal(timer.getStateSnapshot().currentRound, 2);
    assert.equal(timer.getStateSnapshot().currentSet, 1);

    // prevSet from Round 2 Set 1 should go to Round 1 Set 2
    timer.prevSet();
    assert.equal(timer.getStateSnapshot().currentRound, 1);
    assert.equal(timer.getStateSnapshot().currentSet, 2);
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    timer.reset();
  });

  it('starts directly in WORK if prepareTime is 0', () => {
    const noPrepPreset = { ...testPreset, prepareTime: 0 };
    const timer = new TimerEngine(noPrepPreset);
    timer.start();
    assert.equal(timer.getStateSnapshot().state, TimerState.WORK);
    timer.reset();
  });

  it('handles subscription and unsubscription properly', () => {
    const timer = new TimerEngine(testPreset);
    let count = 0;
    const unsub = timer.subscribe(() => { count++; });

    timer.start();
    assert.ok(count > 0);

    const prevCount = count;
    unsub();
    timer.pause();
    assert.equal(count, prevCount);
    timer.reset();
  });

  it('emits COUNTDOWN_BEEP during tick when 3, 2, 1 seconds remain', () => {
    const timer = new TimerEngine(testPreset);
    const beeps = [];
    timer.subscribe(evt => {
      if (evt.type === 'COUNTDOWN_BEEP') {
        beeps.push(evt.seconds);
      }
    });

    timer.start(); // PREPARE
    const now = Date.now();
    // Simulate crossing from >2.0s to 1.9s (crossing into 2 seconds remaining)
    timer.targetEndTime = now + 1900;
    timer.lastTickTime = now - 200; // 200ms delta -> prev was 2100ms (3s)
    timer.tick();

    // Simulate crossing into 1 second remaining (0.9s remaining)
    const now2 = Date.now();
    timer.targetEndTime = now2 + 900;
    timer.lastTickTime = now2 - 200; // 200ms delta -> prev was 1100ms (2s)
    timer.tick();

    assert.deepEqual(beeps, [2, 1]);
    timer.reset();
  });
});

