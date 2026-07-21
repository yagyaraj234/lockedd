import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areCorePermissionsReady,
  filterEligibleApps,
  formatPhoneLockDuration,
  formatPhoneLockCountdown,
  isPhoneLockDuration,
  migrateThemePreference,
  phoneLockDurationFromParts,
  phoneLockRemainingMs,
} from './domain.ts';

test('migrates theme preference without changing stored dark or light choices', () => {
  assert.equal(migrateThemePreference('dark'), 'dark');
  assert.equal(migrateThemePreference('light'), 'light');
  assert.equal(migrateThemePreference('system'), 'system');
  assert.equal(migrateThemePreference(undefined), 'system');
});

test('requires both blocking permissions', () => {
  assert.equal(areCorePermissionsReady({ accessibility: true, overlay: true }), true);
  assert.equal(areCorePermissionsReady({ accessibility: true, overlay: false }), false);
  assert.equal(areCorePermissionsReady({ accessibility: false, overlay: true }), false);
});

test('filters every already-blocked package from the picker', () => {
  const installed = [
    { packageName: 'one', appName: 'One' },
    { packageName: 'two', appName: 'Two' },
  ];
  assert.deepEqual(filterEligibleApps(installed, [{ packageName: 'one' }]), [installed[1]]);
});

test('derives phone-lock expiry and countdown from absolute time', () => {
  const now = 1_000_000;
  assert.equal(phoneLockRemainingMs(null, now), 0);
  assert.equal(phoneLockRemainingMs(now - 1, now), 0);
  assert.equal(phoneLockRemainingMs(now + 18_000_000, now), 18_000_000);
  assert.equal(formatPhoneLockCountdown(now + 18_000_000, now), '05:00:00');
  assert.equal(formatPhoneLockCountdown(now + 36_000_000, now), '10:00:00');
  assert.equal(formatPhoneLockCountdown(now + 1_001, now), '00:00:02');
  assert.equal(formatPhoneLockCountdown(now, now), '00:00:00');
});

test('allows 5-minute phone-lock increments from 5 minutes through 24 hours', () => {
  assert.equal(phoneLockDurationFromParts(0, 5), 300_000);
  assert.equal(phoneLockDurationFromParts(24, 0), 86_400_000);
  assert.equal(isPhoneLockDuration(300_000), true);
  assert.equal(isPhoneLockDuration(86_400_000), true);
  assert.equal(isPhoneLockDuration(86_700_000), false);
  assert.equal(isPhoneLockDuration(18_120_000), false);
  assert.equal(isPhoneLockDuration(0), false);
});

test('formats phone-lock duration for the confirmation prompt', () => {
  assert.equal(formatPhoneLockDuration(300_000), '5 minutes');
  assert.equal(formatPhoneLockDuration(3_900_000), '1 hour 5 minutes');
  assert.equal(formatPhoneLockDuration(86_400_000), '24 hours');
});
