// timer.js — pure timer-logic functions, no DOM. Kept separate so they're testable.
// Exposed on window for the browser build (no bundler), and via module.exports for Node tests.

const SESSION = {
  WORK: 'work',
  SHORT_BREAK: 'short_break',
  LONG_BREAK: 'long_break',
};

/**
 * Given the current session type and how many work sessions have been
 * completed so far (before this transition), decide the next session type.
 * Standard pattern: work -> short break, repeated 4x, then work -> long break,
 * and the cycle repeats.
 * @param {string} currentType - one of SESSION.*
 * @param {number} completedWorkSessions - total work sessions completed BEFORE this one ends
 * @param {number} longBreakInterval - how many work sessions before a long break (default 4)
 * @returns {string} next session type
 */
function getNextSessionType(currentType, completedWorkSessions, longBreakInterval = 4) {
  if (currentType === SESSION.WORK) {
    const justCompleted = completedWorkSessions + 1;
    if (justCompleted % longBreakInterval === 0) {
      return SESSION.LONG_BREAK;
    }
    return SESSION.SHORT_BREAK;
  }
  // After any break, go back to work.
  return SESSION.WORK;
}

/**
 * Returns duration in seconds for a given session type given settings (in minutes).
 */
function getDurationSeconds(sessionType, settings) {
  switch (sessionType) {
    case SESSION.WORK:
      return Math.max(1, Math.round(settings.workMinutes * 60));
    case SESSION.SHORT_BREAK:
      return Math.max(1, Math.round(settings.shortBreakMinutes * 60));
    case SESSION.LONG_BREAK:
      return Math.max(1, Math.round(settings.longBreakMinutes * 60));
    default:
      throw new Error('Unknown session type: ' + sessionType);
  }
}

/** Formats seconds as M:SS or MM:SS */
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Clamp a minutes value from settings input to a sane range (1-180). */
function clampMinutes(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(180, Math.max(1, n));
}

const api = { SESSION, getNextSessionType, getDurationSeconds, formatTime, clampMinutes };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.PomodoroTimerLogic = api;
}
