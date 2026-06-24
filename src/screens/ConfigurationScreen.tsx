import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  AppState,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { Palette } from '../colors';
import {
  getSettings,
  updateSettings,
  preventionDisableRemainingMs,
  isPreventionDisableReady,
  PREVENTION_LOCK_MS,
  preventionLockRemainingMs,
  isPreventionLocked,
} from '../store/storage';
import { PreventionMode } from '../../modules/prevention-mode/src';
import { StepCounter } from '../../modules/step-counter/src';
import { PermissionsList } from '../components/PermissionsList';
import { AppBlocker } from '../../modules/app-blocker/src';

const STEP_GOAL_OPTIONS = [5000, 8000, 10000, 15000, 20000];

// The Settings tab: unlock method + Prevention Mode. Blocked-app management
// lives in its own tab (BlockedAppsScreen).
type DnsStatus = 'ok' | 'wrong' | 'no_perm' | 'unknown';

// Status colors are mid-tone so they stay legible on both the near-black dark
// bg and the off-white light bg (neon/pastel variants wash out on white).
const DNS_STATUS_CONFIG: Record<Exclude<DnsStatus, 'unknown'>, { bg: string; color: string; label: string }> = {
  ok:      { bg: 'rgba(22,163,74,0.14)',  color: '#16a34a', label: 'Cloudflare DNS active' },
  wrong:   { bg: 'rgba(217,119,6,0.14)',  color: '#d97706', label: 'DNS not set' },
  no_perm: { bg: 'rgba(220,38,38,0.14)',  color: '#dc2626', label: 'No permission' },
};

export const ConfigurationScreen = () => {
  const { colors: Colors, name: themeName, setTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [settings, setSettingsState] = useState(getSettings());
  const [stepGoal, setStepGoalState] = useState(10000);
  const [showStepGoalModal, setShowStepGoalModal] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<DnsStatus>('unknown');

  // The stored preventionMode flag can drift from the real device-admin state
  // (e.g. the user grants/revokes admin in system settings, or cancels the grant
  // prompt). Device admin is the source of truth — reconcile on mount and every
  // time the app returns to the foreground (which is also when the grant prompt
  // launched by enable() resolves).
  const refreshDnsStatus = () => {
    try {
      const hasPerm = AppBlocker.hasWriteSecureSettings();
      if (!hasPerm) { setDnsStatus('no_perm'); return; }
      const dns = AppBlocker.getPrivateDns();
      setDnsStatus(
        dns.mode === 'hostname' && dns.specifier === 'family.cloudflare-dns.com'
          ? 'ok'
          : 'wrong'
      );
    } catch {
      setDnsStatus('unknown');
    }
  };

  useEffect(() => {
    reconcilePreventionMode();
    refreshDnsStatus();
    StepCounter.getStepGoal().then(setStepGoalState).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { reconcilePreventionMode(); refreshDnsStatus(); }
    });
    return () => sub.remove();
  }, []);

  const reconcilePreventionMode = async () => {
    try {
      const active = await PreventionMode.isActive();
      const prev = getSettings();
      if (prev.preventionMode === active) return;
      const turningOn = active === true && prev.preventionMode === false;
      const next = {
        ...prev,
        preventionMode: active,
        preventionModeOffRequestedAt: active ? prev.preventionModeOffRequestedAt : null,
        preventionModeLockedUntil: turningOn
          ? Date.now() + PREVENTION_LOCK_MS
          : active ? prev.preventionModeLockedUntil : null,
      };
      updateSettings(next);
      setSettingsState(next);
    } catch {
      // Native module unavailable (not yet rebuilt) — leave stored state as-is.
    }
  };

  const selectStepGoal = async (goal: number) => {
    try {
      await StepCounter.setStepGoal(goal);
      setStepGoalState(goal);
    } catch {
      Alert.alert('Error', 'Could not update step goal.');
    }
    setShowStepGoalModal(false);
  };

  const toggleMode = (mode: 'temporary' | 'physical') => {
    const newSettings = { ...settings, unlockMode: mode };
    setSettingsState(newSettings);
    updateSettings(newSettings);
  };

  const togglePreventionMode = async (value: boolean) => {
    if (value) {
      // Turning ON: cancel any pending disable request, then launch the system
      // device-admin grant. The switch only flips ON once the grant is confirmed
      // by reconcilePreventionMode() when the app returns to the foreground.
      const cleared = { ...getSettings(), preventionModeOffRequestedAt: null };
      setSettingsState(cleared);
      updateSettings(cleared);
      try {
        await PreventionMode.enable();
      } catch {
        Alert.alert('Unavailable', 'Prevention Mode needs a native rebuild to work.');
      }
      return;
    }

    // 14-day lock gate: must expire before the 12-hour cooldown can start.
    if (isPreventionLocked()) {
      const days = Math.ceil(preventionLockRemainingMs() / 86_400_000);
      Alert.alert('Locked', `Prevention Mode is locked for ${days} more day${days === 1 ? '' : 's'}.`);
      return;
    }

    // Turning OFF is gated by the 12-hour cooldown.
    const current = getSettings();
    if (current.preventionModeOffRequestedAt == null) {
      const next = { ...current, preventionModeOffRequestedAt: Date.now() };
      setSettingsState(next);
      updateSettings(next);
      Alert.alert(
        'Disable requested',
        'Prevention Mode can be turned off in 12 hours. Come back and toggle it off again to confirm.'
      );
    } else if (isPreventionDisableReady()) {
      try {
        await PreventionMode.disable();
        const next = {
          ...current,
          preventionMode: false,
          preventionModeOffRequestedAt: null,
          preventionModeLockedUntil: null,
        };
        setSettingsState(next);
        updateSettings(next);
        Alert.alert('Prevention Mode off', 'Uninstall protection has been removed.');
      } catch {
        Alert.alert('Error', 'Could not disable Prevention Mode. Try again.');
      }
    } else {
      const hours = Math.ceil(preventionDisableRemainingMs() / (60 * 60 * 1000));
      Alert.alert(
        'Still locked',
        `Prevention Mode can be turned off in about ${hours} hour${hours === 1 ? '' : 's'}.`
      );
    }
  };

  return (
    <>
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Permissions Section — lets users grant anything they skipped during
          onboarding (blocking is dead without accessibility + overlay). */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PERMISSIONS</Text>
        <PermissionsList />
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>APPEARANCE</Text>
        <View style={styles.securityRow}>
          <View style={styles.securityText}>
            <View style={styles.securityLabelRow}>
              <Text style={styles.securityLabel}>Light Mode</Text>
            </View>
            <Text style={styles.securityDesc}>Switch between the dark and light theme.</Text>
          </View>
          <Switch
            value={themeName === 'light'}
            onValueChange={(value) => setTheme(value ? 'light' : 'dark')}
            trackColor={{ false: Colors.switchTrackOff, true: Colors.accent }}
            thumbColor={themeName === 'light' ? '#FFFFFF' : Colors.textTertiary}
          />
        </View>
      </View>

      {/* Unlock Methods Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>UNLOCK METHODS</Text>
        <TouchableOpacity
          style={[
            styles.modeCard,
            settings.unlockMode === 'temporary' && styles.modeCardActive,
          ]}
          onPress={() => toggleMode('temporary')}
        >
          <View style={styles.modeText}>
            <Text style={styles.modeName}>Temporary Mode</Text>
            <Text style={styles.modeDesc}>5-minute breathing delay before app access.</Text>
          </View>
          <View style={[styles.radio, settings.unlockMode === 'temporary' && styles.radioSelected]}>
            {settings.unlockMode === 'temporary' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeCard,
            settings.unlockMode === 'physical' && styles.modeCardActive,
          ]}
          onPress={() => toggleMode('physical')}
        >
          <View style={styles.modeText}>
            <Text style={styles.modeName}>Physical Mode</Text>
            <Text style={styles.modeDesc}>Walk your step goal to unlock permanently for today.</Text>
          </View>
          <View style={[styles.radio, settings.unlockMode === 'physical' && styles.radioSelected]}>
            {settings.unlockMode === 'physical' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        {settings.unlockMode === 'physical' && (
          <TouchableOpacity
            style={styles.stepGoalRow}
            onPress={() => setShowStepGoalModal(true)}
          >
            <View style={styles.stepGoalText}>
              <Text style={styles.stepGoalLabel}>Daily Step Goal</Text>
              <Text style={styles.stepGoalDesc}>Tap to change</Text>
            </View>
            <Text style={styles.stepGoalValue}>{stepGoal.toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SECURITY</Text>
        <View style={styles.securityRow}>
          <View style={styles.securityText}>
            <View style={styles.securityLabelRow}>
              <Text style={styles.securityLabel}>Prevention Mode</Text>
            </View>
            <Text style={styles.securityDesc}>
              {isPreventionLocked()
                ? `Locked for ${Math.ceil(preventionLockRemainingMs() / 86_400_000)} more day(s).`
                : 'Prevents uninstalling the app during focus blocks.'}
            </Text>
          </View>
          <Switch
            value={settings.preventionMode}
            onValueChange={togglePreventionMode}
            disabled={isPreventionLocked()}
            trackColor={{ false: Colors.switchTrackOff, true: Colors.accent }}
            thumbColor={settings.preventionMode ? '#FFFFFF' : Colors.textTertiary}
          />
        </View>
        {/* DNS protection is always on (the accessibility service blocks the
            Private DNS chooser unconditionally). No toggle — this row is a
            read-only status indicator. */}
        <View style={[styles.securityRow, { marginTop: 12 }]}>
          <View style={styles.securityText}>
            <View style={styles.securityLabelRow}>
              <Text style={styles.securityLabel}>Private DNS Lock</Text>
              {dnsStatus !== 'unknown' && (
                <View style={[styles.dnsChip, { backgroundColor: DNS_STATUS_CONFIG[dnsStatus].bg }]}>
                  <Text style={[styles.dnsChipText, { color: DNS_STATUS_CONFIG[dnsStatus].color }]}>
                    {DNS_STATUS_CONFIG[dnsStatus].label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.securityDesc}>Private DNS is locked to Cloudflare and can't be changed.</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>

    <Modal
      visible={showStepGoalModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowStepGoalModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Daily Step Goal</Text>
          <Text style={styles.modalSubtitle}>Choose how many steps unlock apps for today.</Text>
          {STEP_GOAL_OPTIONS.map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[styles.modalOption, goal === stepGoal && styles.modalOptionActive]}
              onPress={() => selectStepGoal(goal)}
            >
              <Text style={[styles.modalOptionText, goal === stepGoal && styles.modalOptionTextActive]}>
                {goal.toLocaleString()} steps
              </Text>
              {goal === stepGoal && <Text style={styles.modalCheckmark}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalCancel} onPress={() => setShowStepGoalModal(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginBottom: 14,
    letterSpacing: 1.2,
  },
  modeCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeCardActive: {
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  modeText: {
    flex: 1,
    paddingRight: 12,
  },
  modeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'transparent',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  securityText: {
    flex: 1,
    paddingRight: 12,
  },
  securityLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  securityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  securityDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dnsChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dnsChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 24,
  },
  stepGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  stepGoalText: {
    flex: 1,
  },
  stepGoalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  stepGoalDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  stepGoalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.bgSecondary,
  },
  modalOptionActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bg,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  modalOptionTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  modalCheckmark: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: 'bold',
  },
  modalCancel: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
