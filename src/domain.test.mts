import assert from 'node:assert/strict';
import test from 'node:test';
import { areCorePermissionsReady, filterEligibleApps, migrateThemePreference } from './domain.ts';

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
