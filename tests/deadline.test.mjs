import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeadline, matchesDeadline } from '../src/domain/deadline.ts';

test('8桁・ISO・閏日・年の範囲を検証し途中入力を補正しない', () => {
  for (const raw of ['20280229', '2028-02-29', ' 20280229 ']) assert.equal(parseDeadline(raw), '2028-02-29');
  for (const raw of ['', '20270229', '20281301', '20280431', '2028123', '202812311', '09991231', '10000-01-01', '2028/12/31']) assert.equal(parseDeadline(raw), null);
  assert.equal(parseDeadline('10000101'), '1000-01-01');
  assert.equal(parseDeadline('99991231'), '9999-12-31');
});

test('期限条件は-1/0/1/3/4/14/15/30/31日を正しく分割する', () => {
  const today = '2026-12-20';
  const cases = [
    ['2026-12-19', 'expired'], ['2026-12-20', 'fortnight'], ['2026-12-21', 'fortnight'],
    ['2026-12-23', 'fortnight'], ['2026-12-24', 'fortnight'], ['2027-01-03', 'fortnight'],
    ['2027-01-04', 'month'], ['2027-01-19', 'month'], ['2027-01-20', 'long'],
  ];
  for (const [date, expected] of cases) for (const filter of ['expired', 'fortnight', 'month', 'long']) {
    assert.equal(matchesDeadline(date, today, filter), filter === expected, `${date}: ${filter}`);
  }
  assert.equal(matchesDeadline('2026-12-19', today, 'today'), true);
  assert.equal(matchesDeadline(today, today, 'soon'), false);
  assert.equal(matchesDeadline('2026-12-23', today, 'soon'), true);
  assert.equal(matchesDeadline('2026-12-24', today, 'soon'), false);
});
