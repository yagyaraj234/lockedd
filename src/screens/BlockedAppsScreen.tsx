import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Switch,
} from 'react-native';
import { Colors } from '../colors';
import { getBlockedApps, setBlockedApps } from '../store/storage';

export const BlockedAppsScreen = ({ navigation }: any) => {
  const [blockedApps, setBlockedAppsState] = useState<any[]>([]);
  const [tick, setTick] = useState(0);

  const cleanupExpiredBlocks = () => {
    const now = Date.now();
    const apps = getBlockedApps();
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

  // Timer tick for countdown updates (every 60 seconds)
  useEffect(() => {
    const timedApps = blockedApps.filter((app) => app.blockType === 'timed');
    if (timedApps.length === 0) return;

    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [blockedApps]);

  const toggleApp = (packageName: string) => {
    const updated = blockedApps.map((a) =>
      a.packageName === packageName ? { ...a, enabled: !a.enabled } : a
    );
    setBlockedAppsState(updated);
    setBlockedApps(updated);
  };

  const removeApp = (packageName: string) => {
    const updated = blockedApps.filter((a) => a.packageName !== packageName);
    setBlockedAppsState(updated);
    setBlockedApps(updated);
  };

  const formatTimeRemaining = (blockUntil: number) => {
    const now = Date.now();
    const remaining = Math.max(0, blockUntil - now);
    if (remaining === 0) return 'Expired';

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const permanentApps = blockedApps.filter((app) => app.blockType === 'permanent');
  const timedApps = blockedApps.filter((app) => app.blockType === 'timed');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Blocked Apps</Text>
      </View>

      {blockedApps.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No apps blocked yet</Text>
          <Text style={styles.emptySubtext}>
            Add your first app to get started
          </Text>
        </View>
      ) : (
        <>
          {permanentApps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERMANENT</Text>
              {permanentApps.map((app) => (
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
                    <Text style={styles.permanentBadge}>🔒 Permanently Blocked</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {timedApps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TIMED</Text>
              {timedApps.map((app) => (
                <View key={app.packageName} style={styles.appRow}>
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
                    <Text style={styles.timerText}>
                      {formatTimeRemaining(app.blockUntil)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeApp(app.packageName)}>
                    <Text style={styles.remove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddApps')}
      >
        <Text style={styles.addButtonText}>+ Add more apps</Text>
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
  timerText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  remove: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  addButton: {
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
  },
  bottomSpacer: {
    height: 24,
  },
});
