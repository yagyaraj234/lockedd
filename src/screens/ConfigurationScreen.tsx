import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  AppState,
} from 'react-native';
import { Colors } from '../colors';
import {
  getSettings,
  updateSettings,
  preventionDisableRemainingMs,
  isPreventionDisableReady,
} from '../store/storage';
import { PreventionMode } from '../../modules/prevention-mode/src';
import { PermissionsList } from '../components/PermissionsList';

// The Settings tab: unlock method + Prevention Mode. Blocked-app management
// lives in its own tab (BlockedAppsScreen).
export const ConfigurationScreen = () => {
  const [settings, setSettingsState] = useState(getSettings());

  // The stored preventionMode flag can drift from the real device-admin state
  // (e.g. the user grants/revokes admin in system settings, or cancels the grant
  // prompt). Device admin is the source of truth — reconcile on mount and every
  // time the app returns to the foreground (which is also when the grant prompt
  // launched by enable() resolves).
  useEffect(() => {
    reconcilePreventionMode();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcilePreventionMode();
    });
    return () => sub.remove();
  }, []);

  const reconcilePreventionMode = async () => {
    try {
      const active = await PreventionMode.isActive();
      setSettingsState((prev) => {
        if (prev.preventionMode === active) return prev;
        const next = {
          ...prev,
          preventionMode: active,
          // A successful grant clears any pending disable request.
          preventionModeOffRequestedAt: active
            ? prev.preventionModeOffRequestedAt
            : null,
        };
        updateSettings(next);
        return next;
      });
    } catch {
      // Native module unavailable (not yet rebuilt) — leave stored state as-is.
    }
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
      const cleared = { ...settings, preventionModeOffRequestedAt: null };
      setSettingsState(cleared);
      updateSettings(cleared);
      try {
        await PreventionMode.enable();
      } catch {
        Alert.alert('Unavailable', 'Prevention Mode needs a native rebuild to work.');
      }
      return;
    }

    // Turning OFF is gated by the 12-hour cooldown.
    const requestedAt = settings.preventionModeOffRequestedAt;
    if (requestedAt == null) {
      const next = { ...settings, preventionModeOffRequestedAt: Date.now() };
      setSettingsState(next);
      updateSettings(next);
      Alert.alert(
        'Disable requested',
        'Prevention Mode can be turned off in 12 hours. Come back and toggle it off again to confirm.'
      );
    } else if (isPreventionDisableReady()) {
      try {
        await PreventionMode.disable();
      } catch {
        // Even if the native call fails, clear the flag so the UI isn't stuck.
      }
      const next = {
        ...settings,
        preventionMode: false,
        preventionModeOffRequestedAt: null,
      };
      setSettingsState(next);
      updateSettings(next);
      Alert.alert('Prevention Mode off', 'Uninstall protection has been removed.');
    } else {
      const hours = Math.ceil(preventionDisableRemainingMs() / (60 * 60 * 1000));
      Alert.alert(
        'Still locked',
        `Prevention Mode can be turned off in about ${hours} hour${hours === 1 ? '' : 's'}.`
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Permissions Section — lets users grant anything they skipped during
          onboarding (blocking is dead without accessibility + overlay). */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PERMISSIONS</Text>
        <PermissionsList />
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
          <View
            style={[
              styles.radio,
              settings.unlockMode === 'temporary' && styles.radioSelected,
            ]}
          />
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
            <Text style={styles.modeDesc}>Walk 10,000 steps to unlock permanently for today.</Text>
          </View>
          <View
            style={[
              styles.radio,
              settings.unlockMode === 'physical' && styles.radioSelected,
            ]}
          />
        </TouchableOpacity>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SECURITY</Text>
        <View style={styles.securityRow}>
          <View style={styles.securityText}>
            <Text style={styles.securityLabel}>Prevention Mode</Text>
            <Text style={styles.securityDesc}>Prevents uninstalling the app during focus blocks.</Text>
          </View>
          <Switch
            value={settings.preventionMode}
            onValueChange={togglePreventionMode}
            trackColor={{ false: Colors.bgSecondary, true: Colors.accent }}
            thumbColor={settings.preventionMode ? Colors.accent : Colors.textTertiary}
          />
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
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
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modeCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  radioSelected: {
    borderColor: Colors.accent,
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
  },
  securityText: {
    flex: 1,
    paddingRight: 12,
  },
  securityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  securityDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 24,
  },
});
