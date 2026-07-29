import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areCorePermissionsReady,
  filterEligibleApps,
  formatPhoneLockDuration,
  formatPhoneLockCountdown,
  getActivePhoneLockSchedule,
  getManualPhoneLockConflict,
  getPhoneLockScheduleValidationError,
  isPhoneLockDuration,
  migrateThemePreference,
  phoneLockDurationFromParts,
  phoneLockRemainingMs,
  requestPhoneLockPass,
  resolvePhoneLockAccessState,
  type PhoneLockAccessState,
  type PhoneLockSchedule,
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
  assert.equal(isPhoneLockDuration(300_000.5), false);
  assert.equal(isPhoneLockDuration(0), false);
});

test('formats phone-lock duration for the confirmation prompt', () => {
  assert.equal(formatPhoneLockDuration(0), '');
  assert.equal(formatPhoneLockDuration(60_000), '1 minute');
  assert.equal(formatPhoneLockDuration(300_000), '5 minutes');
  assert.equal(formatPhoneLockDuration(3_900_000), '1 hour 5 minutes');
  assert.equal(formatPhoneLockDuration(86_400_000), '24 hours');
});

test('rejects overlapping enabled schedules but permits touching windows', () => {
  const morning: PhoneLockSchedule = {
    id: 'morning',
    name: 'Morning focus',
    enabled: true,
    days: [1],
    startMinute: 8 * 60,
    endMinute: 10 * 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };
  const overlapping = {
    ...morning,
    id: 'overlapping',
    startMinute: 9 * 60,
    endMinute: 11 * 60,
  };
  const touching = {
    ...morning,
    id: 'touching',
    startMinute: 10 * 60,
    endMinute: 11 * 60,
  };

  assert.equal(
    getPhoneLockScheduleValidationError(overlapping, [morning]),
    'Schedule overlaps Morning focus'
  );
  assert.equal(getPhoneLockScheduleValidationError(touching, [morning]), null);
});

test('requires at least one repeat day', () => {
  const schedule: PhoneLockSchedule = {
    id: 'study',
    name: 'Study',
    enabled: true,
    days: [],
    startMinute: 8 * 60,
    endMinute: 10 * 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };

  assert.equal(
    getPhoneLockScheduleValidationError(schedule, []),
    'Choose at least one day'
  );
});

test('rejects equal schedule times and more than five allowed apps', () => {
  const schedule: PhoneLockSchedule = {
    id: 'study',
    name: 'Study',
    enabled: true,
    days: [1],
    startMinute: 8 * 60,
    endMinute: 8 * 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };

  assert.equal(
    getPhoneLockScheduleValidationError(schedule, []),
    'Start and end times must differ'
  );
  assert.equal(
    getPhoneLockScheduleValidationError(
      {
        ...schedule,
        endMinute: 10 * 60,
        allowedPackageNames: ['1', '2', '3', '4', '5', '6'],
      },
      []
    ),
    'Choose up to 5 allowed apps'
  );
});

test('validates disabled, overnight, and week-wrapping schedules', () => {
  const saturdayNight: PhoneLockSchedule = {
    id: 'weekend',
    name: '',
    enabled: true,
    days: [6],
    startMinute: 23 * 60,
    endMinute: 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };
  const sundayMorning: PhoneLockSchedule = {
    ...saturdayNight,
    id: 'sunday',
    days: [0],
    startMinute: 30,
    endMinute: 45,
  };

  assert.equal(
    getPhoneLockScheduleValidationError(saturdayNight, [sundayMorning]),
    'Schedule overlaps another schedule'
  );
  assert.equal(
    getPhoneLockScheduleValidationError({ ...saturdayNight, enabled: false }, [sundayMorning]),
    null
  );
  assert.equal(
    getPhoneLockScheduleValidationError(saturdayNight, [saturdayNight]),
    null
  );
  assert.equal(
    getPhoneLockScheduleValidationError({ ...saturdayNight, startMinute: -1 }, []),
    'Enter valid start and end times'
  );
});

test('restores two one-minute passes after the five-minute cooldown', () => {
  const now = 1_000_000;
  const initial: PhoneLockAccessState = {
    endsAt: now + 60 * 60_000,
    passEndsAt: null,
    passesRemaining: 2,
    cooldownEndsAt: null,
  };
  const first = requestPhoneLockPass(initial, now);
  assert.deepEqual(first, {
    ...initial,
    passEndsAt: now + 60_000,
    passesRemaining: 1,
  });

  const afterFirst = resolvePhoneLockAccessState(first!, now + 60_000);
  const second = requestPhoneLockPass(afterFirst, now + 60_000);
  assert.deepEqual(second, {
    ...initial,
    passEndsAt: now + 2 * 60_000,
    passesRemaining: 0,
  });

  const coolingDown = resolvePhoneLockAccessState(second!, now + 2 * 60_000);
  assert.deepEqual(coolingDown, {
    ...initial,
    passEndsAt: null,
    passesRemaining: 0,
    cooldownEndsAt: now + 7 * 60_000,
  });
  assert.equal(requestPhoneLockPass(coolingDown, now + 3 * 60_000), null);
  assert.deepEqual(resolvePhoneLockAccessState(coolingDown, now + 7 * 60_000), initial);
});

test('expires the access cycle at the lock boundary', () => {
  const state: PhoneLockAccessState = {
    endsAt: 1_000,
    passEndsAt: 2_000,
    passesRemaining: 1,
    cooldownEndsAt: 3_000,
  };

  assert.deepEqual(resolvePhoneLockAccessState(state, 1_000), {
    ...state,
    passEndsAt: null,
    passesRemaining: 0,
    cooldownEndsAt: null,
  });
});

test('finds the active weekly schedule and honors activation-not-before', () => {
  const mondayMorning = new Date(2026, 6, 27, 9, 0, 0, 0);
  const schedule: PhoneLockSchedule = {
    id: 'morning',
    name: 'Morning focus',
    enabled: true,
    days: [1],
    startMinute: 8 * 60,
    endMinute: 10 * 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };

  const occurrence = getActivePhoneLockSchedule([schedule], mondayMorning);
  assert.equal(occurrence?.schedule.id, 'morning');
  assert.equal(occurrence?.startsAt.getHours(), 8);
  assert.equal(occurrence?.endsAt.getHours(), 10);

  assert.equal(
    getActivePhoneLockSchedule(
      [{ ...schedule, activationNotBefore: occurrence!.endsAt.getTime() }],
      mondayMorning
    ),
    null
  );
});

test('finds an overnight schedule that started the previous day', () => {
  const schedule: PhoneLockSchedule = {
    id: 'night',
    name: 'Night',
    enabled: true,
    days: [1],
    startMinute: 22 * 60,
    endMinute: 2 * 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };
  const tuesdayAfterMidnight = new Date(2026, 6, 28, 1, 0, 0, 0);

  assert.equal(
    getActivePhoneLockSchedule(
      [{ ...schedule, enabled: false }, schedule],
      tuesdayAfterMidnight
    )?.schedule.id,
    'night'
  );
});

test('rejects a manual lock only when it crosses an enabled schedule', () => {
  const schedule: PhoneLockSchedule = {
    id: 'morning',
    name: 'Morning focus',
    enabled: true,
    days: [1],
    startMinute: 8 * 60,
    endMinute: 10 * 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };
  const monday = new Date(2026, 6, 27, 7, 0, 0, 0);

  assert.equal(
    getManualPhoneLockConflict(
      [schedule],
      monday,
      new Date(2026, 6, 27, 8, 0, 0, 0)
    ),
    null
  );
  assert.equal(
    getManualPhoneLockConflict(
      [schedule],
      monday,
      new Date(2026, 6, 27, 8, 1, 0, 0)
    )?.schedule.id,
    'morning'
  );
});

test('finds the earliest eligible manual-lock conflict', () => {
  const monday = new Date(2026, 6, 27, 7, 0, 0, 0);
  const base: PhoneLockSchedule = {
    id: 'later',
    name: 'Later',
    enabled: true,
    days: [1],
    startMinute: 10 * 60,
    endMinute: 11 * 60,
    allowedPackageNames: [],
    activationNotBefore: null,
  };
  const ignored = {
    ...base,
    id: 'ignored',
    startMinute: 9 * 60,
    activationNotBefore: new Date(2026, 6, 28, 0, 0, 0, 0).getTime(),
  };
  const earlier = {
    ...base,
    id: 'earlier',
    startMinute: 8 * 60,
    endMinute: 9 * 60,
  };

  assert.equal(
    getManualPhoneLockConflict(
      [{ ...base, enabled: false }, ignored, base, earlier],
      monday,
      new Date(2026, 6, 27, 12, 0, 0, 0)
    )?.schedule.id,
    'earlier'
  );
});
