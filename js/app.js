// js/app.js
import {
  DEFAULT_PRESET,
  calculatePresetTotals,
  getPresets,
  savePreset,
  deletePreset,
  getActivePreset,
  setActivePresetId
} from './presets.js';
import { TimerEngine, TimerState } from './timer.js';
import { AudioEngine } from './audio.js';
import { WakeLockManager } from './wakelock.js';

// Instances
const audio = new AudioEngine();
const wakeLock = new WakeLockManager();
let currentPreset = getActivePreset();
let timer = new TimerEngine(currentPreset);

// DOM Elements
const bodyEl = document.body;
const progressBarFill = document.getElementById('progress-bar-fill');
const currentPresetNameEl = document.getElementById('current-preset-name');
const btnToggleSound = document.getElementById('btn-toggle-sound');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');
const btnOpenSettings = document.getElementById('btn-open-settings');
const heroDisplay = document.getElementById('hero-display');
const phaseBadge = document.getElementById('phase-badge');
const countdownText = document.getElementById('countdown-text');
const setBadge = document.getElementById('set-badge');
const roundBadge = document.getElementById('round-badge');
const metricWorkElapsed = document.getElementById('metric-work-elapsed');
const metricTotalRemaining = document.getElementById('metric-total-remaining');
const btnPrevSet = document.getElementById('btn-prev-set');
const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnReset = document.getElementById('btn-reset');
const btnSkipNext = document.getElementById('btn-skip-next');

// Drawer Elements
const drawerBackdrop = document.getElementById('drawer-backdrop');
const settingsDrawer = document.getElementById('settings-drawer');
const btnCloseSettings = document.getElementById('btn-close-settings');
const selectPreset = document.getElementById('select-preset');
const btnNewPreset = document.getElementById('btn-new-preset');
const btnSavePreset = document.getElementById('btn-save-preset');
const btnDelPreset = document.getElementById('btn-del-preset');
const inputPresetName = document.getElementById('input-preset-name');
const inputPrepareTime = document.getElementById('input-prepareTime');
const inputWorkTime = document.getElementById('input-workTime');
const inputRestTime = document.getElementById('input-restTime');
const inputExercises = document.getElementById('input-exercises');
const inputRounds = document.getElementById('input-rounds');
const inputRoundRestTime = document.getElementById('input-roundRestTime');
const drawerSummaryBadge = document.getElementById('drawer-summary-badge');

// Helper to format seconds as MM:SS
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// User first interaction unlock
let unlocked = false;
function ensureAudioUnlocked() {
  if (!unlocked) {
    audio.unlock();
    unlocked = true;
  }
}

// Update UI based on Timer Snapshot
function updateUI(snapshot) {
  const {
    state,
    currentRound,
    totalRounds,
    currentSet,
    totalSets,
    phaseSecondsRemaining,
    totalWorkElapsedMs,
    totalElapsedMs
  } = snapshot;

  // 1. Theme Class & Phase Badge
  bodyEl.className = '';
  switch (state) {
    case TimerState.PREPARE:
      bodyEl.classList.add('theme-prepare');
      phaseBadge.textContent = '准备';
      break;
    case TimerState.WORK:
      bodyEl.classList.add('theme-work');
      phaseBadge.textContent = '跳绳冲刺';
      break;
    case TimerState.REST:
      bodyEl.classList.add('theme-rest');
      phaseBadge.textContent = '组间休息';
      break;
    case TimerState.ROUND_REST:
      bodyEl.classList.add('theme-round-rest');
      phaseBadge.textContent = '大轮休息';
      break;
    case TimerState.PAUSED:
      bodyEl.classList.add('theme-idle', 'theme-paused');
      phaseBadge.textContent = '暂停中';
      break;
    case TimerState.COMPLETED:
      bodyEl.classList.add('theme-completed');
      phaseBadge.textContent = '训练完成';
      break;
    case TimerState.IDLE:
    default:
      bodyEl.classList.add('theme-idle');
      phaseBadge.textContent = '就绪';
      break;
  }

  // 2. Countdown display
  countdownText.textContent = formatTime(phaseSecondsRemaining);

  // 3. Set & Round badges
  setBadge.textContent = `SET ${currentSet} / ${totalSets}`;
  roundBadge.textContent = `ROUND ${currentRound} / ${totalRounds}`;

  // 4. Metrics
  const workSeconds = Math.floor(totalWorkElapsedMs / 1000);
  metricWorkElapsed.textContent = formatTime(workSeconds);

  const { totalDuration } = calculatePresetTotals(currentPreset);
  const remainingTotalSeconds = Math.max(0, totalDuration - Math.floor(totalElapsedMs / 1000));
  metricTotalRemaining.textContent = formatTime(remainingTotalSeconds);

  // 5. Progress bar
  const progressPercent = totalDuration > 0
    ? Math.min(100, ((totalElapsedMs / 1000) / totalDuration) * 100)
    : 0;
  progressBarFill.style.width = `${progressPercent.toFixed(1)}%`;

  // 6. Play / Pause Button Icons
  const isRunning = state !== TimerState.IDLE && state !== TimerState.PAUSED && state !== TimerState.COMPLETED;
  iconPlay.style.display = isRunning ? 'none' : 'block';
  iconPause.style.display = isRunning ? 'block' : 'none';
}

// Timer event listener
timer.subscribe((event) => {
  if (event.type === 'COUNTDOWN_BEEP') {
    audio.playBeep321();
  } else if (event.type === 'PHASE_CHANGE') {
    if (event.nextState === TimerState.WORK) {
      audio.playWorkStart();
    } else if (event.nextState === TimerState.REST || event.nextState === TimerState.ROUND_REST) {
      audio.playRestStart();
    }
    updateUI(event.snapshot);
  } else if (event.type === 'COMPLETE') {
    audio.playComplete();
    wakeLock.releaseLock();
    updateUI(event.snapshot);
  } else if (event.type === 'TICK' || event.type === 'RESET' || event.type === 'PAUSE' || event.type === 'RESUME') {
    updateUI(event.snapshot);
  }
});

// Control handlers
function togglePlayPause() {
  ensureAudioUnlocked();
  const snap = timer.getStateSnapshot();
  if (snap.state === TimerState.IDLE) {
    wakeLock.requestLock();
    timer.start();
  } else if (snap.state === TimerState.PAUSED) {
    wakeLock.requestLock();
    timer.resume();
  } else if (snap.state === TimerState.COMPLETED) {
    timer.reset();
  } else {
    wakeLock.releaseLock();
    timer.pause();
  }
}

btnPlayPause.addEventListener('click', togglePlayPause);
heroDisplay.addEventListener('click', (e) => {
  // If clicking on hero area, toggle pause/play
  togglePlayPause();
});

btnReset.addEventListener('click', () => {
  ensureAudioUnlocked();
  wakeLock.releaseLock();
  timer.reset();
});

btnPrevSet.addEventListener('click', () => {
  ensureAudioUnlocked();
  timer.prevSet();
});

btnSkipNext.addEventListener('click', () => {
  ensureAudioUnlocked();
  timer.skipNext();
});

// Sound Toggle
btnToggleSound.addEventListener('click', () => {
  ensureAudioUnlocked();
  const nextMuted = !audio.isMuted();
  audio.setMuted(nextMuted);
  iconSoundOn.style.display = nextMuted ? 'none' : 'block';
  iconSoundOff.style.display = nextMuted ? 'block' : 'none';
});

// Global tap unlock
document.addEventListener('touchstart', ensureAudioUnlocked, { once: true, passive: true });
document.addEventListener('click', ensureAudioUnlocked, { once: true });

// Keyboard shortcuts (Space = Play/Pause, Esc = Close Drawer)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.code === 'Escape') {
    closeDrawer();
  }
});

// Drawer Functions
function openDrawer() {
  renderPresetOptions();
  populateDrawerFields(currentPreset);
  drawerBackdrop.classList.add('open');
  settingsDrawer.classList.add('open');
}

function closeDrawer() {
  drawerBackdrop.classList.remove('open');
  settingsDrawer.classList.remove('open');
}

btnOpenSettings.addEventListener('click', openDrawer);
btnCloseSettings.addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);

function renderPresetOptions() {
  const presets = getPresets();
  selectPreset.innerHTML = '';
  for (const p of presets) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === currentPreset.id) {
      opt.selected = true;
    }
    selectPreset.appendChild(opt);
  }
  btnDelPreset.style.display = currentPreset.isDefault ? 'none' : 'block';
}

function populateDrawerFields(preset) {
  inputPresetName.value = preset.name || '';
  inputPrepareTime.value = preset.prepareTime ?? 10;
  inputWorkTime.value = preset.workTime ?? 45;
  inputRestTime.value = preset.restTime ?? 15;
  inputExercises.value = preset.exercises ?? 8;
  inputRounds.value = preset.rounds ?? 3;
  inputRoundRestTime.value = preset.roundRestTime ?? 45;
  updateDrawerSummary();
}

function readDrawerValues() {
  return {
    id: currentPreset.id,
    name: inputPresetName.value.trim() || '自定义方案',
    isDefault: Boolean(currentPreset.isDefault),
    prepareTime: Math.max(0, parseInt(inputPrepareTime.value, 10) || 0),
    workTime: Math.max(5, parseInt(inputWorkTime.value, 10) || 45),
    restTime: Math.max(0, parseInt(inputRestTime.value, 10) || 15),
    exercises: Math.max(1, parseInt(inputExercises.value, 10) || 8),
    rounds: Math.max(1, parseInt(inputRounds.value, 10) || 3),
    roundRestTime: Math.max(0, parseInt(inputRoundRestTime.value, 10) || 45)
  };
}

function updateDrawerSummary() {
  const temp = readDrawerValues();
  const totals = calculatePresetTotals(temp);
  drawerSummaryBadge.innerHTML = `预计总用时: ${formatTime(totals.totalDuration)}<br>累计跳绳做功: ${formatTime(totals.totalWorkTime)} (共 ${totals.totalSets} 组)`;
}

// Stepper buttons in drawer
document.querySelectorAll('.param-step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const field = btn.getAttribute('data-field');
    const step = parseInt(btn.getAttribute('data-step'), 10);
    const input = document.getElementById(`input-${field}`);
    if (input) {
      const min = parseInt(input.min, 10) || 0;
      const max = parseInt(input.max, 10) || 9999;
      let val = (parseInt(input.value, 10) || 0) + step;
      val = Math.max(min, Math.min(max, val));
      input.value = val;
      updateDrawerSummary();
    }
  });
});

// Input changes in drawer
[
  inputPresetName,
  inputPrepareTime,
  inputWorkTime,
  inputRestTime,
  inputExercises,
  inputRounds,
  inputRoundRestTime
].forEach(input => {
  input.addEventListener('input', updateDrawerSummary);
});

// Select preset dropdown change
selectPreset.addEventListener('change', () => {
  const presets = getPresets();
  const selected = presets.find(p => p.id === selectPreset.value);
  if (selected) {
    applyPreset(selected);
    populateDrawerFields(selected);
    renderPresetOptions();
  }
});

// Save preset button
btnSavePreset.addEventListener('click', () => {
  const updated = readDrawerValues();
  savePreset(updated);
  applyPreset(updated);
  renderPresetOptions();
  closeDrawer();
});

// New preset button
btnNewPreset.addEventListener('click', () => {
  const newId = 'custom-' + Date.now();
  const newPreset = {
    id: newId,
    name: '新建方案 ' + new Date().toLocaleTimeString(),
    isDefault: false,
    prepareTime: 10,
    workTime: 45,
    restTime: 15,
    exercises: 8,
    rounds: 3,
    roundRestTime: 45
  };
  savePreset(newPreset);
  applyPreset(newPreset);
  populateDrawerFields(newPreset);
  renderPresetOptions();
});

// Delete preset button
btnDelPreset.addEventListener('click', () => {
  if (currentPreset.isDefault) return;
  if (confirm(`确定删除方案 "${currentPreset.name}" 吗？`)) {
    deletePreset(currentPreset.id);
    const fallback = getActivePreset();
    applyPreset(fallback);
    populateDrawerFields(fallback);
    renderPresetOptions();
  }
});

function applyPreset(preset) {
  currentPreset = preset;
  setActivePresetId(preset.id);
  currentPresetNameEl.textContent = preset.name;
  timer.setPreset(preset);
  updateUI(timer.getStateSnapshot());
}

// Initial UI render
currentPresetNameEl.textContent = currentPreset.name;
updateUI(timer.getStateSnapshot());

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}
