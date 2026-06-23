import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { Palette } from '../colors';
import {
  getBlockedApps,
  setBlockedApps,
  isDisableLocked,
  disableLockRemainingMs,
  type BlockedApp,
} from '../store/storage';
import { LockIcon, PlusIcon } from '../components/icons';
import { EmptyState } from '../components/EmptyState';

export const BlockedAppsScreen = ({ navigation }: any) => {
  const { colors: Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [blockedApps, setBlockedAppsState] = useState<BlockedApp[]>([]);
  const [, setTick] = useState(0);

  const cleanupExpiredBlocks = () => {
    const now = Date.now();
    const apps = getBlockedApps();
    // Still prune expired timed entries that Home created from storage, even
    // though this screen no longer renders timed apps.
    const filtered = apps.filter((app) => {
      if (app.blockType === 'permanent') return true;
      if (app.blockType === 'timed' && app.blockUntil) {
        return app.blockUntil > now;
      }
      return false;
    });
    if (filtered.length !== apps.length) {
      setBlockedApps(filtered);
    }
    setBlockedAppsState(filtered);
  };

  // Refresh whenever the tab gains focus (e.g. returning from AddApps).
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      cleanupExpiredBlocks();
    });
    return unsubscribe;
  }, [navigation]);

  // Timer tick so the disable-lock countdown re-renders (every 60 seconds).
  // Run only while at least one permanent app is still inside its lock window.
  useEffect(() => {
    const anyLocked = blockedApps.some(
      (app) => app.blockType === 'permanent' && isDisableLocked(app)
    );
    if (!anyLocked) return;

    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [blockedApps]);

  const removeApp = (packageName: string) => {
    const app = blockedApps.find((a) => a.packageName === packageName);
    if (app && isDisableLocked(app)) {
      const ms = disableLockRemainingMs(app);
      const DAY_MS = 24 * 60 * 60 * 1000;
      const timeStr = ms >= DAY_MS
        ? `${Math.ceil(ms / DAY_MS)} day(s)`
        : `${Math.ceil(ms / 60000)} minute(s)`;
      Alert.alert('Locked', `You can remove this in about ${timeStr}.`);
      return;
    }
    const updated = blockedApps.filter((a) => a.packageName !== packageName);
    setBlockedAppsState(updated);
    setBlockedApps(updated);
  };

  const permanentApps = blockedApps.filter(
    (app) => app.blockType === 'permanent'
  );

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Blocked Apps</Text>
      </View>

      {permanentApps.length === 0 ? (
        <EmptyState
          illustration="lock"
          title="No apps blocked"
          subtitle="Add apps you want to permanently keep out of reach."
          actionLabel="Add an app"
          onAction={() => navigation.navigate('AddApps', { mode: 'permanent' })}
        />
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERMANENT</Text>
          {permanentApps.map((app) => {
            const locked = isDisableLocked(app);
            const remainingMs = disableLockRemainingMs(app);
            const DAY_MS = 24 * 60 * 60 * 1000;
            const lockLabel = remainingMs >= DAY_MS
              ? `Locked · ${Math.ceil(remainingMs / DAY_MS)}d`
              : `Locked · ${Math.ceil(remainingMs / 60000)}m`;
            return (
              <View
                key={app.packageName}
                style={[styles.appRow, styles.permanentAppRow]}
              >
                {app.iconBase64 ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                    style={styles.icon}
                  />
                ) : (
                  <View style={styles.iconPlaceholder} />
                )}
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{app.appName}</Text>
                  <View style={styles.permanentChip}>
                    <Text style={styles.permanentChipText}>PERMANENT</Text>
                  </View>
                </View>
                {locked ? (
                  <View style={styles.lockBadge}>
                    <LockIcon size={14} color={Colors.accent} />
                    <Text style={styles.lockBadgeText}>{lockLabel}</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => removeApp(app.packageName)}>
                    <Text style={styles.remove}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddApps', { mode: 'permanent' })}
      >
        <PlusIcon size={18} color={Colors.accent} />
        <Text style={styles.addButtonText}>Add more apps</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
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
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSecondary,
  },
  permanentAppRow: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.bgSecondary,
    marginRight: 12,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  permanentChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentSoft,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  permanentChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockBadgeText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500',
    marginLeft: 4,
  },
  remove: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  bottomSpacer: {
    height: 24,
  },
});
