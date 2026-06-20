import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Colors } from '../colors';
import {
  getBlockedApps,
  setBlockedApps,
  isDisableLocked,
  disableLockRemainingMs,
  stampDisableLock,
  type BlockedApp,
} from '../store/storage';
import { LockIcon, PlusIcon } from '../components/icons';

export const BlockedAppsScreen = ({ navigation }: any) => {
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

  const toggleApp = (packageName: string) => {
    const app = blockedApps.find((a) => a.packageName === packageName);
    if (app && isDisableLocked(app)) {
      Alert.alert(
        'Locked',
        `You can change this in about ${Math.ceil(
          disableLockRemainingMs(app) / 60000
        )} more minute(s).`
      );
      return;
    }
    const updated = blockedApps.map((a) => {
      if (a.packageName !== packageName) return a;
      const toggled = { ...a, enabled: !a.enabled };
      // Re-enabling restarts the 30-min disable lock so it can't be gamed by
      // toggling off-then-on to dodge the cooldown.
      return toggled.enabled ? stampDisableLock(toggled) : toggled;
    });
    setBlockedAppsState(updated);
    setBlockedApps(updated);
  };

  const removeApp = (packageName: string) => {
    const app = blockedApps.find((a) => a.packageName === packageName);
    if (app && isDisableLocked(app)) {
      Alert.alert(
        'Locked',
        `You can change this in about ${Math.ceil(
          disableLockRemainingMs(app) / 60000
        )} more minute(s).`
      );
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
      <View style={styles.header}>
        <Text style={styles.title}>Blocked Apps</Text>
      </View>

      {permanentApps.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No apps blocked yet</Text>
          <Text style={styles.emptySubtext}>
            Add your first app to get started
          </Text>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERMANENT</Text>
          {permanentApps.map((app) => {
            const locked = isDisableLocked(app);
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
                  <Text style={styles.permanentBadge}>
                    🔒 Permanently Blocked
                  </Text>
                </View>
                {locked ? (
                  <View style={styles.lockBadge}>
                    <LockIcon size={14} color={Colors.accent} />
                    <Text style={styles.lockBadgeText}>
                      {`Locked · ${Math.ceil(
                        disableLockRemainingMs(app) / 60000
                      )}m`}
                    </Text>
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
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
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
  permanentBadge: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '500',
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
