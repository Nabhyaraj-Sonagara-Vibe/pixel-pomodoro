// Minimal smoke test for the pure timer-logic functions. Run with: node tests/timer.test.js
const assert = require('assert');
const {
  SESSION,
  getNextSessionType,
  getDurationSeconds,
  formatTime,
  clampMinutes,
} = require('../assets/js/timer.js');

let passed = 0;
function check(desc, fn) {
  fn();
  passed++;
  console.log(`ok - ${desc}`);
}

check('work -> short break for sessions 1,2,3', () => {
  assert.strictEqual(getNextSessionType(SESSION.WORK, 0), SESSION.SHORT_BREAK);
  assert.strictEqual(getNextSessionType(SESSION.WORK, 1), SESSION.SHORT_BREAK);
  assert.strictEqual(getNextSessionType(SESSION.WORK, 2), SESSION.SHORT_BREAK);
});

check('work -> long break on 4th session', () => {
  assert.strictEqual(getNextSessionType(SESSION.WORK, 3), SESSION.LONG_BREAK);
  assert.strictEqual(getNextSessionType(SESSION.WORK, 7), SESSION.LONG_BREAK);
});

check('short/long break -> work', () => {
  assert.strictEqual(getNextSessionType(SESSION.SHORT_BREAK, 1), SESSION.WORK);
  assert.strictEqual(getNextSessionType(SESSION.LONG_BREAK, 4), SESSION.WORK);
});

check('custom long break interval', () => {
  assert.strictEqual(getNextSessionType(SESSION.WORK, 1, 2), SESSION.LONG_BREAK);
});

check('getDurationSeconds converts minutes to seconds', () => {
  const settings = { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 };
  assert.strictEqual(getDurationSeconds(SESSION.WORK, settings), 1500);
  assert.strictEqual(getDurationSeconds(SESSION.SHORT_BREAK, settings), 300);
  assert.strictEqual(getDurationSeconds(SESSION.LONG_BREAK, settings), 900);
});

check('formatTime formats seconds as M:SS', () => {
  assert.strictEqual(formatTime(0), '0:00');
  assert.strictEqual(formatTime(59), '0:59');
  assert.strictEqual(formatTime(60), '1:00');
  assert.strictEqual(formatTime(1500), '25:00');
  assert.strictEqual(formatTime(65), '1:05');
});

check('clampMinutes clamps to sane range and falls back on bad input', () => {
  assert.strictEqual(clampMinutes(25, 25), 25);
  assert.strictEqual(clampMinutes(0, 25), 25);
  assert.strictEqual(clampMinutes(-5, 25), 25);
  assert.strictEqual(clampMinutes('abc', 25), 25);
  assert.strictEqual(clampMinutes(999, 25), 180);
  assert.strictEqual(clampMinutes(1, 25), 1);
});

console.log(`\n${passed} checks passed.`);
