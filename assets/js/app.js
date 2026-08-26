// app.js — DOM wiring, audio chimes, notifications, persistence, pixel sprite rendering.
// Depends on assets/js/timer.js being loaded first (window.PomodoroTimerLogic).
(function () {
  'use strict';

  const {
    SESSION,
    getNextSessionType,
    getDurationSeconds,
    formatTime,
    clampMinutes,
  } = window.PomodoroTimerLogic;

  const STORAGE_KEY = 'pixelPomodoro.v1';

  // ---------- State ----------
  const defaultSettings = { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 };

  let state = {
    settings: { ...defaultSettings },
    sessionType: SESSION.WORK,
    secondsRemaining: getDurationSeconds(SESSION.WORK, defaultSettings),
    isRunning: false,
    completedWorkSessions: 0, // total across all time (persisted tally)
    cycleWorkCount: 0, // work sessions completed within current 4-cycle (for long break logic)
    taskLabel: '',
  };

  let tickHandle = null;
  let endAt = null; // timestamp when current session should end, used for drift-free countdown

  // ---------- Persistence ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.settings) state.settings = { ...defaultSettings, ...saved.settings };
      if (typeof saved.completedWorkSessions === 'number') {
        state.completedWorkSessions = saved.completedWorkSessions;
      }
      if (typeof saved.taskLabel === 'string') state.taskLabel = saved.taskLabel;
    } catch (e) {
      console.warn('Failed to load saved state', e);
    }
  }

  function persistState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          settings: state.settings,
          completedWorkSessions: state.completedWorkSessions,
          taskLabel: state.taskLabel,
        })
      );
    } catch (e) {
      console.warn('Failed to persist state', e);
    }
  }

  // ---------- DOM refs ----------
  const el = {
    time: document.getElementById('time-display'),
    badge: document.getElementById('session-badge'),
    startPause: document.getElementById('btn-start-pause'),
    reset: document.getElementById('btn-reset'),
    skip: document.getElementById('btn-skip'),
    progressTrack: document.getElementById('progress-track'),
    task: document.getElementById('task-input'),
    tally: document.getElementById('tally-value'),
    cycle: document.getElementById('cycle-value'),
    scene: document.getElementById('scene'),
    settingsToggle: document.getElementById('settings-toggle'),
    settingsPanel: document.getElementById('settings-panel'),
    workInput: document.getElementById('setting-work'),
    shortInput: document.getElementById('setting-short'),
    longInput: document.getElementById('setting-long'),
    settingsSave: document.getElementById('settings-save'),
    settingsCancel: document.getElementById('settings-cancel'),
    notice: document.getElementById('notice'),
    title: document.title,
  };

  // ---------- Progress bar (pixel segments) ----------
  const SEGMENT_COUNT = 20;
  function buildProgressSegments() {
    el.progressTrack.innerHTML = '';
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      el.progressTrack.appendChild(seg);
    }
  }
  function updateProgress() {
    const total = getDurationSeconds(state.sessionType, state.settings);
    const elapsed = total - state.secondsRemaining;
    const filledCount = Math.round((elapsed / total) * SEGMENT_COUNT);
    const segs = el.progressTrack.children;
    for (let i = 0; i < segs.length; i++) {
      const filled = i < filledCount;
      segs[i].classList.toggle('filled', filled);
      segs[i].classList.toggle('work', filled && state.sessionType === SESSION.WORK);
      segs[i].classList.toggle('short_break', filled && state.sessionType === SESSION.SHORT_BREAK);
      segs[i].classList.toggle('long_break', filled && state.sessionType === SESSION.LONG_BREAK);
    }
  }

  // ---------- Pixel sprite scene ----------
  // Two tiny 16x16 sprites drawn via absolutely-positioned divs: a "working" figure
  // at a desk, and a "resting/break" figure. Coordinates are [x, y] grid cells.
  const PALETTE = {
    skin: '#f0b088',
    hair: '#3a2a1a',
    shirtWork: '#e0533d',
    shirtBreak: '#4fc3a1',
    desk: '#8b5a2b',
    screen: '#9bbc0f',
    bg: '#0f380f',
    zzz: '#4f9de0',
  };

  function px(x, y, color) {
    return { x, y, color };
  }

  function workSprite() {
    // Person sitting at a desk, screen glowing
    const p = [];
    // hair
    [[5,1],[6,1],[7,1],[8,1],[5,2],[8,2]].forEach(([x,y]) => p.push(px(x,y,PALETTE.hair)));
    // head
    [[5,2],[6,2],[7,2],[8,2],[5,3],[6,3],[7,3],[8,3]].forEach(([x,y]) => p.push(px(x,y,PALETTE.skin)));
    // body/shirt
    for (let y = 4; y <= 7; y++) for (let x = 4; x <= 9; x++) p.push(px(x, y, PALETTE.shirtWork));
    // arms typing
    p.push(px(3,6,PALETTE.skin), px(10,6,PALETTE.skin));
    // desk
    for (let x = 1; x <= 13; x++) p.push(px(x, 9, PALETTE.desk));
    for (let x = 1; x <= 13; x++) p.push(px(x, 10, PALETTE.desk));
    // desk legs
    p.push(px(2,11,PALETTE.desk), px(2,12,PALETTE.desk), px(12,11,PALETTE.desk), px(12,12,PALETTE.desk));
    // monitor
    for (let y = 5; y <= 8; y++) for (let x = 10; x <= 13; x++) p.push(px(x, y, PALETTE.hair));
    for (let y = 6; y <= 7; y++) for (let x = 11; x <= 12; x++) p.push(px(x, y, PALETTE.screen));
    return p;
  }

  function breakSprite() {
    // Person lounging/resting with "Zzz" style rest bubbles and a drink
    const p = [];
    // hair
    [[5,2],[6,2],[7,2],[8,2]].forEach(([x,y]) => p.push(px(x,y,PALETTE.hair)));
    // head tilted
    [[5,3],[6,3],[7,3],[8,3],[6,4],[7,4]].forEach(([x,y]) => p.push(px(x,y,PALETTE.skin)));
    // reclined body
    for (let y = 5; y <= 7; y++) for (let x = 3; x <= 10; x++) p.push(px(x, y, PALETTE.shirtBreak));
    // lounge chair
    for (let x = 2; x <= 11; x++) p.push(px(x, 8, PALETTE.desk));
    for (let x = 2; x <= 11; x++) p.push(px(x, 9, PALETTE.desk));
    p.push(px(2,10,PALETTE.desk), px(2,11,PALETTE.desk), px(11,10,PALETTE.desk), px(11,11,PALETTE.desk));
    // cup
    p.push(px(12,7,PALETTE.screen), px(12,8,PALETTE.screen));
    // zzz bubbles (blink via CSS animation class toggled externally if desired)
    p.push(px(10,1,PALETTE.zzz), px(11,0,PALETTE.zzz), px(12,0,PALETTE.zzz));
    return p;
  }

  function renderScene() {
    const sprite = document.createElement('div');
    sprite.className = 'pixel-sprite';
    const pixels = state.sessionType === SESSION.WORK ? workSprite() : breakSprite();
    pixels.forEach(({ x, y, color }) => {
      const d = document.createElement('div');
      d.style.left = `calc(var(--s) * ${x})`;
      d.style.top = `calc(var(--s) * ${y})`;
      d.style.background = color;
      sprite.appendChild(d);
    });
    el.scene.innerHTML = '';
    el.scene.appendChild(sprite);
  }

  // ---------- Web Audio chimes ----------
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    return audioCtx;
  }

  function playTone(freq, startTime, duration, type = 'square', gainPeak = 0.15) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // Distinct chime per session type: work-end (descending, ready-for-break),
  // short-break-end (rising cheerful), long-break-end (rising, longer/grander)
  function playChime(sessionTypeJustEnded) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (sessionTypeJustEnded === SESSION.WORK) {
      // Work done -> descending two-note "time for a break"
      playTone(880, now, 0.18, 'square');
      playTone(660, now + 0.16, 0.25, 'square');
    } else if (sessionTypeJustEnded === SESSION.SHORT_BREAK) {
      // Short break done -> quick rising three-note "back to work"
      playTone(523.25, now, 0.12, 'triangle');
      playTone(659.25, now + 0.12, 0.12, 'triangle');
      playTone(783.99, now + 0.24, 0.2, 'triangle');
    } else {
      // Long break done -> grander rising fanfare
      playTone(392, now, 0.15, 'sawtooth', 0.1);
      playTone(523.25, now + 0.15, 0.15, 'sawtooth', 0.1);
      playTone(659.25, now + 0.3, 0.15, 'sawtooth', 0.1);
      playTone(783.99, now + 0.45, 0.3, 'sawtooth', 0.1);
    }
  }

  // ---------- Notifications ----------
  function requestNotificationPermissionIfNeeded() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  function notify(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, icon: undefined });
    } catch (e) {
      // Some environments (e.g. insecure context) throw; degrade silently.
      console.warn('Notification failed', e);
    }
  }

  // ---------- Labels ----------
  const SESSION_LABELS = {
    [SESSION.WORK]: 'WORK',
    [SESSION.SHORT_BREAK]: 'SHORT BREAK',
    [SESSION.LONG_BREAK]: 'LONG BREAK',
  };

  function setNotice(msg) {
    el.notice.textContent = msg || '';
  }

  // ---------- Render ----------
  function render() {
    el.time.textContent = formatTime(state.secondsRemaining);
    el.badge.textContent = SESSION_LABELS[state.sessionType];
    el.badge.className = 'session-badge ' + state.sessionType;
    el.startPause.textContent = state.isRunning ? 'PAUSE [SPACE]' : 'START [SPACE]';
    el.tally.textContent = state.completedWorkSessions;
    el.cycle.textContent = `${state.cycleWorkCount % 4 === 0 && state.cycleWorkCount > 0 ? 4 : state.cycleWorkCount % 4} / 4`;
    updateProgress();
    renderScene();
    document.title = `${formatTime(state.secondsRemaining)} · ${SESSION_LABELS[state.sessionType]} — Pixel Pomodoro`;
  }

  // ---------- Timer engine ----------
  function tick() {
    if (!state.isRunning || endAt == null) return;
    const remainingMs = endAt - Date.now();
    state.secondsRemaining = Math.max(0, Math.round(remainingMs / 1000));
    if (remainingMs <= 0) {
      completeSession();
      return;
    }
    render();
  }

  function startTicking() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(tick, 250);
  }

  function stopTicking() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
  }

  function completeSession() {
    const endedType = state.sessionType;
    playChime(endedType);

    if (endedType === SESSION.WORK) {
      state.completedWorkSessions += 1;
      state.cycleWorkCount += 1;
    }

    const next = getNextSessionType(endedType, state.cycleWorkCount - (endedType === SESSION.WORK ? 1 : 0));
    // Reset cycle counter after a long break so pattern repeats cleanly
    if (next === SESSION.WORK && endedType === SESSION.LONG_BREAK) {
      state.cycleWorkCount = 0;
    }

    state.sessionType = next;
    state.secondsRemaining = getDurationSeconds(next, state.settings);
    state.isRunning = false;
    endAt = null;
    stopTicking();
    persistState();
    render();

    notify(
      `${SESSION_LABELS[endedType]} done!`,
      next === SESSION.WORK ? 'Break is over — back to work.' : 'Nice work — time for a break.'
    );
    setNotice(`${SESSION_LABELS[endedType]} finished. Next up: ${SESSION_LABELS[next]}.`);
  }

  function start() {
    if (state.isRunning) return;
    state.isRunning = true;
    endAt = Date.now() + state.secondsRemaining * 1000;
    startTicking();
    requestNotificationPermissionIfNeeded();
    // Resume/create audio context on user gesture (autoplay policy)
    getAudioCtx();
    render();
  }

  function pause() {
    if (!state.isRunning) return;
    state.isRunning = false;
    stopTicking();
    endAt = null;
    render();
  }

  function togglePause() {
    if (state.isRunning) pause();
    else start();
  }

  function reset() {
    pause();
    state.secondsRemaining = getDurationSeconds(state.sessionType, state.settings);
    setNotice('Timer reset.');
    render();
  }

  function skip() {
    // Jump straight to completion logic without waiting, but don't double count
    // if not running — still counts as "completed" per standard pomodoro skip UX.
    stopTicking();
    endAt = null;
    state.isRunning = false;
    completeSession();
  }

  // ---------- Settings panel ----------
  function openSettings() {
    el.workInput.value = state.settings.workMinutes;
    el.shortInput.value = state.settings.shortBreakMinutes;
    el.longInput.value = state.settings.longBreakMinutes;
    el.settingsPanel.classList.add('open');
  }
  function closeSettings() {
    el.settingsPanel.classList.remove('open');
  }
  function saveSettings() {
    const wasRunning = state.isRunning;
    if (wasRunning) pause();

    const newSettings = {
      workMinutes: clampMinutes(el.workInput.value, state.settings.workMinutes),
      shortBreakMinutes: clampMinutes(el.shortInput.value, state.settings.shortBreakMinutes),
      longBreakMinutes: clampMinutes(el.longInput.value, state.settings.longBreakMinutes),
    };
    state.settings = newSettings;

    // Only reset the remaining time for the CURRENT session type to match new
    // duration if the timer isn't mid-flight in a way that would be confusing;
    // simplest safe rule: re-derive remaining time for current session type,
    // clamped so we never show negative/huge jumps unexpectedly.
    state.secondsRemaining = getDurationSeconds(state.sessionType, state.settings);

    persistState();
    closeSettings();
    setNotice('Settings saved.');
    render();
  }

  // ---------- Task label ----------
  function onTaskInput() {
    state.taskLabel = el.task.value;
    persistState();
  }

  // ---------- Keyboard shortcuts ----------
  function onKeydown(e) {
    // Don't hijack shortcuts while typing in text fields
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';

    if (e.code === 'Space' && !typing) {
      e.preventDefault();
      togglePause();
    } else if (!typing && (e.key === 'r' || e.key === 'R')) {
      reset();
    } else if (!typing && (e.key === 's' || e.key === 'S')) {
      skip();
    } else if (!typing && e.key === 'Escape') {
      closeSettings();
    }
  }

  // ---------- Init ----------
  function init() {
    loadState();
    buildProgressSegments();
    el.task.value = state.taskLabel || '';
    state.secondsRemaining = getDurationSeconds(state.sessionType, state.settings);

    el.startPause.addEventListener('click', togglePause);
    el.reset.addEventListener('click', reset);
    el.skip.addEventListener('click', skip);
    el.task.addEventListener('input', onTaskInput);
    el.settingsToggle.addEventListener('click', () => {
      if (el.settingsPanel.classList.contains('open')) closeSettings();
      else openSettings();
    });
    el.settingsSave.addEventListener('click', saveSettings);
    el.settingsCancel.addEventListener('click', closeSettings);
    document.addEventListener('keydown', onKeydown);

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
