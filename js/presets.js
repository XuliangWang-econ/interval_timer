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
