import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { Palette, ThemePreference } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { PressableScale } from '../components/PressableScale';
import { CheckIcon, ChevronRightIcon } from '../components/icons';
import { usePermissions } from '../hooks/usePermissions';
import { PreventionMode } from '../../modules/prevention-mode/src';
import {
  getSettings,
  isPreventionDisableReady,
  isPreventionLocked,
  PREVENTION_LOCK_MS,
  preventionDisableRemainingMs,
  preventionLockRemainingMs,
  updateSettings,
} from '../store/storage';
import { useTheme } from '../theme';

const appearanceOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const selectionHaptic = () => {
  if (Platform.OS === 'android') {
    return Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick);
  }
  return Haptics.selectionAsync();
};

export const ConfigurationScreen = ({ navigation }: any) => {
  const { colors, preference, setTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const permissions = usePermissions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [settings, setSettings] = useState(getSettings());

  const reconcilePreventionMode = async () => {
    try {
      const active = await PreventionMode.isActive();
      const previous = getSettings();
      if (previous.preventionMode === active) {
        setSettings(previous);
        return;
      }
      const turningOn = active && !previous.preventionMode;
      const next = {
        ...previous,
        preventionMode: active,
        preventionModeOffRequestedAt: active ? previous.preventionModeOffRequestedAt : null,
        preventionModeLockedUntil: turningOn
          ? Date.now() + PREVENTION_LOCK_MS
          : active ? previous.preventionModeLockedUntil : null,
      };
      updateSettings(next);
      setSettings(next);
    } catch {
      setSettings(getSettings());
    }
  };

  useEffect(() => {
    reconcilePreventionMode();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcilePreventionMode();
    });
    return () => subscription.remove();
  }, []);

  const togglePreventionMode = async () => {
    if (!settings.preventionMode) {
      const next = { ...getSettings(), preventionModeOffRequestedAt: null };
      updateSettings(next);
      setSettings(next);
      try {
        await PreventionMode.enable();
      } catch {
        Alert.alert('Unavailable', 'Prevention Mode needs a native build to work.');
      }
      return;
    }

    if (isPreventionLocked()) {
      const days = Math.ceil(preventionLockRemainingMs() / 86_400_000);
      Alert.alert('Prevention Mode is locked', `You can request removal in ${days} day${days === 1 ? '' : 's'}.`);
      return;
    }

    const current = getSettings();
    if (current.preventionModeOffRequestedAt == null) {
      const next = { ...current, preventionModeOffRequestedAt: Date.now() };
      updateSettings(next);
      setSettings(next);
      Alert.alert('Disable requested', 'Return in 12 hours and tap Prevention Mode again to confirm.');
      return;
    }

    if (!isPreventionDisableReady()) {
      const hours = Math.ceil(preventionDisableRemainingMs() / 3_600_000);
      Alert.alert('Cooldown in progress', `You can turn it off in about ${hours} hour${hours === 1 ? '' : 's'}.`);
      return;
    }

    try {
      await PreventionMode.disable();
      const next = { ...current, preventionMode: false, preventionModeOffRequestedAt: null, preventionModeLockedUntil: null };
      updateSettings(next);
      setSettings(next);
      Alert.alert('Prevention Mode off', 'Uninstall protection has been removed.');
    } catch {
      Alert.alert('Could not turn it off', 'Try again from Settings.');
    }
  };

  const preventionDetail = isPreventionLocked()
    ? `Removal locked for ${Math.ceil(preventionLockRemainingMs() / 86_400_000)} more day${Math.ceil(preventionLockRemainingMs() / 86_400_000) === 1 ? '' : 's'}. Tap for details.`
    : settings.preventionModeOffRequestedAt != null
      ? `Disable cooldown: about ${Math.ceil(preventionDisableRemainingMs() / 3_600_000)}h remaining.`
      : 'Prevents uninstalling Locked during committed blocks.';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.maxWidth}>
        <Text style={styles.largeTitle}>Settings</Text>

        <Text style={styles.sectionLabel}>PROTECTION</Text>
        <PressableScale
          containerStyle={styles.fullWidth}
          accessibilityRole="switch"
          accessibilityLabel="Prevention Mode"
          accessibilityHint={preventionDetail}
          accessibilityState={{ checked: settings.preventionMode }}
          onPress={togglePreventionMode}
          style={styles.row}
          pressedStyle={styles.pressed}
        >
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Prevention Mode</Text>
            <Text style={styles.rowDetail}>{preventionDetail}</Text>
          </View>
          <View pointerEvents="none">
            <Switch
              value={settings.preventionMode}
              trackColor={{ false: colors.switchTrackOff, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </PressableScale>

        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.segmented} accessibilityRole="radiogroup">
          {appearanceOptions.map((option) => {
            const active = preference === option.value;
            return (
              <PressableScale
                key={option.value}
                containerStyle={styles.segmentWrap}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  setTheme(option.value);
                  selectionHaptic().catch(() => {});
                }}
                style={[styles.segment, active && styles.segmentActive]}
                pressedStyle={styles.pressed}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
              </PressableScale>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>PERMISSIONS</Text>
        <PressableScale
          containerStyle={styles.fullWidth}
          accessibilityRole="button"
          accessibilityHint="Open permission details"
          onPress={() => navigation.navigate('Permissions')}
          style={styles.row}
          pressedStyle={styles.pressed}
        >
          <View style={styles.permissionStatus}>
            <View style={[styles.statusIcon, permissions.coreReady && styles.statusIconReady]}>
              {permissions.coreReady ? <CheckIcon size={16} color={colors.onAccent} /> : null}
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{permissions.coreReady ? 'Blocking ready' : 'Setup needed'}</Text>
              <Text style={styles.rowDetail}>Required access and optional battery settings</Text>
            </View>
          </View>
          <ChevronRightIcon size={20} color={colors.labelTertiary} />
        </PressableScale>
      </View>
    </ScrollView>
  );
};

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: 680 },
  largeTitle: { ...Type.largeTitle, color: colors.label },
  sectionLabel: { ...Type.footnoteStrong, color: colors.labelTertiary, letterSpacing: 0.9, marginTop: Spacing.xxl, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  fullWidth: { width: '100%' },
  row: { minHeight: 82, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.lg, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowCopy: { flex: 1 },
  rowTitle: { ...Type.bodyStrong, color: colors.label },
  rowDetail: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
  segmented: { padding: 4, borderRadius: Radius.md, backgroundColor: colors.surface, flexDirection: 'row' },
  segmentWrap: { flex: 1 },
  segment: { minHeight: 48, borderRadius: Radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  segmentText: { ...Type.footnoteStrong, color: colors.labelSecondary },
  segmentTextActive: { color: colors.label },
  permissionStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfacePressed },
  statusIconReady: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfacePressed },
});
