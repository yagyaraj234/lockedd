import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme';
import type { Palette } from '../colors';
import { Permissions } from '../../modules/permissions/src';
import { PermissionsSkeleton } from './Skeleton';

interface PermissionState {
  accessibility: boolean;
  overlay: boolean;
  usageStats: boolean;
  activityRecognition: boolean;
  batteryOptimization: boolean;
  notifications: boolean;
}

const PERMISSION_ROWS = [
  { key: 'accessibility', label: 'Accessibility', desc: 'Required for app interception' },
  { key: 'overlay', label: 'Draw Over Apps', desc: 'Required for overlay' },
  { key: 'usageStats', label: 'Usage Access', desc: 'Required for installed app list' },
  { key: 'activityRecognition', label: 'Activity Recognition', desc: 'Required for step tracking' },
  { key: 'batteryOptimization', label: 'Battery Optimization', desc: 'Keeps blocking active in background' },
  { key: 'notifications', label: 'Notifications', desc: 'Required on Android 13+' },
] as const;

// Android 13+ blocks the accessibility toggle for sideloaded installs behind
// "Restricted settings". Can't be lifted programmatically — the user has to
// allow it from App Info, and that menu entry only appears after they've hit
// the restriction dialog once.
const showRestrictedHint = (perms: PermissionState) =>
  Platform.OS === 'android' &&
  Number(Platform.Version) >= 33 &&
  !perms.accessibility;

export const PermissionsList = () => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionState>({
    accessibility: false,
    overlay: false,
    usageStats: false,
    activityRecognition: false,
    batteryOptimization: false,
    notifications: false,
  });

  // Real grant state. The request* calls only open Settings pages, so the
  // checkmarks come from check* — refreshed on mount and whenever the user
  // returns from Settings (app goes active again).
  const refreshStatuses = useCallback(async () => {
    try {
      const [
        accessibility,
        overlay,
        usageStats,
        activityRecognition,
        batteryOptimization,
        notifications,
      ] = await Promise.all([
        Permissions.checkAccessibility(),
        Permissions.checkOverlay(),
        Permissions.checkUsageStats(),
        Permissions.checkActivityRecognition(),
        Permissions.checkBatteryOptimization(),
        Permissions.checkNotifications(),
      ]);
      setPermissions({
        accessibility,
        overlay,
        usageStats,
        activityRecognition,
        batteryOptimization,
        notifications,
      });
    } catch (e) {
      console.error('Permission status check failed:', e);
    }
  }, []);

  useEffect(() => {
    refreshStatuses().finally(() => setLoading(false));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshStatuses();
    });
    return () => sub.remove();
  }, [refreshStatuses]);

  const requestPermission = async (type: keyof PermissionState) => {
    try {
      switch (type) {
        case 'accessibility':
          await Permissions.requestAccessibility();
          break;
        case 'overlay':
          await Permissions.requestOverlay();
          break;
        case 'usageStats':
          await Permissions.requestUsageStats();
          break;
        case 'activityRecognition':
          await Permissions.requestActivityRecognition();
          break;
        case 'batteryOptimization':
          await Permissions.requestBatteryOptimization();
          break;
        case 'notifications':
          await Permissions.requestNotifications();
          break;
      }
      // Runtime dialogs (notifications, activity recognition) resolve without
      // leaving the app, so re-check immediately; Settings-page permissions
      // get picked up by the AppState listener instead.
      await refreshStatuses();
    } catch (e) {
      console.error('Permission request failed:', e);
    }
  };

  if (loading) return <PermissionsSkeleton />;

  return (
    <View style={styles.permissionsList}>
      {PERMISSION_ROWS.map((perm) => (
        <View key={perm.key} style={styles.permissionRow}>
          <View style={styles.permissionInfo}>
            <Text style={styles.permissionLabel}>{perm.label}</Text>
            <Text style={styles.permissionDesc}>{perm.desc}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.allowButton,
              permissions[perm.key] && styles.allowButtonDone,
            ]}
            onPress={() => requestPermission(perm.key)}
          >
            <Text
              style={[
                styles.allowButtonText,
                permissions[perm.key] && styles.allowButtonTextDone,
              ]}
            >
              {permissions[perm.key] ? '✓' : 'ALLOW'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {showRestrictedHint(permissions) && (
        <View style={styles.restrictedCard}>
          <Text style={styles.restrictedTitle}>
            Accessibility toggle greyed out or "Restricted setting"?
          </Text>
          <Text style={styles.restrictedBody}>
            1. Tap ALLOW above and try enabling "Locked" in Accessibility.{'\n'}
            2. If a "Restricted setting" dialog appears, come back here, tap
            "Open App Info" below, tap the ⋮ menu in the top-right, choose
            "Allow restricted settings", then retry step 1.
          </Text>
          <TouchableOpacity
            style={styles.restrictedButton}
            onPress={() => Permissions.openAppInfo()}
          >
            <Text style={styles.restrictedButtonText}>Open App Info</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
  permissionsList: {
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  allowButton: {
    backgroundColor: Colors.bgDark,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  allowButtonDone: {
    backgroundColor: Colors.accent,
  },
  allowButtonText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  allowButtonTextDone: {
    color: Colors.bg,
  },
  restrictedCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  restrictedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  restrictedBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  restrictedButton: {
    backgroundColor: Colors.bgDark,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: 'center',
  },
  restrictedButtonText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
