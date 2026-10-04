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

    const { totalWorkTime, totalDuration, totalSets } = calculatePresetTotals(DEFAULT_PRESET);
    // 24 sets * 45s = 1080s (18 mins)
    assert.equal(totalSets, 24);
    assert.equal(totalWorkTime, 1080);
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

  it('can update existing custom preset', () => {
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
    savePreset({ ...custom, name: 'Tabata Updated' });
    const list = getPresets();
    assert.equal(list.length, 2);
    assert.equal(list.find(p => p.id === 'custom-tabata').name, 'Tabata Updated');
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

    const deletedNonExistent = deletePreset('non-existent');
    assert.equal(deletedNonExistent, false);

    const deletedCustom = deletePreset('test-del');
    assert.equal(deletedCustom, true);
    assert.equal(getPresets().length, 1);
  });

  it('can get and set active preset', () => {
    // When no active preset set, returns default preset
    assert.equal(getActivePreset().id, DEFAULT_PRESET.id);

    const custom = {
      id: 'custom-1',
      name: 'Custom 1',
      prepareTime: 5, workTime: 30, restTime: 15, exercises: 5, rounds: 2, roundRestTime: 30
    };
    savePreset(custom);
    setActivePresetId('custom-1');

    assert.equal(getActivePreset().id, 'custom-1');
    assert.equal(getActivePreset().name, 'Custom 1');

    // If active ID is unknown, fallback to first preset or DEFAULT_PRESET
    setActivePresetId('unknown-id');
    assert.equal(getActivePreset().id, DEFAULT_PRESET.id);
  });

  it('handles invalid or empty localStorage data gracefully', () => {
    localStorage.setItem('interval_timer_presets_v1', 'invalid JSON {{{');
    assert.deepEqual(getPresets(), [DEFAULT_PRESET]);

    localStorage.setItem('interval_timer_presets_v1', JSON.stringify([]));
    assert.deepEqual(getPresets(), [DEFAULT_PRESET]);
  });

  it('calculates totals correctly when prepareTime is omitted', () => {
    const presetNoPrep = {
      workTime: 20,
      restTime: 10,
      exercises: 4,
      rounds: 2,
      roundRestTime: 30
    };
    const totals = calculatePresetTotals(presetNoPrep);
    // exercises * (work + rest) = 4 * 30 = 120 per round
    // round 1 (120) + roundRest (30) + round 2 (120) = 270s
    // prepareTime = 0
    assert.equal(totals.totalDuration, 270);
    assert.equal(totals.totalWorkTime, 160);
    assert.equal(totals.totalSets, 8);
  });
});

