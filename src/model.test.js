import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, clock, duration, parseRange, shift } from './model.js';
test('increments, decrements, and shifts following tasks', () => {
  const rows = [blank(), blank()]; shift(rows, 0, 70);
  assert.equal(rows[1].start, 70); assert.equal(duration(rows[0].minutes), '1h10m');
  shift(rows, 0, -80); assert.equal(rows[0].minutes, 0); assert.equal(rows[1].start, 0);
});
test('midnight and manually edited ranges', () => {
  assert.equal(clock(1450), '00:10');
  assert.deepEqual(parseRange('23:50-00:20'), { start: 1430, minutes: 30 });
  assert.equal(parseRange('24:00-25:00'), null);
  assert.equal(duration(0), '0m');
});
