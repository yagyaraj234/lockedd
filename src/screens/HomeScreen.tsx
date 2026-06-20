import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Colors } from '../colors';
import { getBlockedApps, BlockedApp } from '../store/storage';
import { ShieldIcon, GearIcon, PlusIcon } from '../components/icons';

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

export const HomeScreen = ({ navigation }: any) => {
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [, setTick] = useState(0);

  const refresh = () => {
    setBlockedApps(
      getBlockedApps().filter(
        (a) => a.blockType === 'timed' && (a.blockUntil == null || a.blockUntil > Date.now())
      )
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refresh();
    });
    return unsubscribe;
  }, [navigation]);

  // Tick every 60s so countdowns update while the screen is open.
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Locked</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('BlockedApps')}>
            <ShieldIcon size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <GearIcon size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TEMPORARILY BLOCKED</Text>
        {blockedApps.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No apps blocked temporarily</Text>
            <Text style={styles.emptySubtext}>
              Block an app for a set time to get started
            </Text>
          </View>
        ) : (
          <View style={styles.appGrid}>
            {blockedApps.map((app) => (
              <View key={app.packageName} style={styles.appCard}>
                {app.iconBase64 ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                    style={styles.appIcon}
                  />
                ) : (
                  <View style={styles.appIconPlaceholder} />
                )}
                <Text style={styles.appCardName} numberOfLines={2}>
                  {app.appName}
                </Text>
                {app.blockUntil != null && (
                  <Text style={styles.timerText} numberOfLines={1}>
                    {formatTimeRemaining(app.blockUntil)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddApps', { mode: 'temporary' })}
      >
        <PlusIcon size={18} color={Colors.accent} />
        <Text style={styles.addButtonText}>Block temporarily</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
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
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  appCard: {
    width: '48%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 8,
  },
  appIconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: Colors.bgDark,
    marginBottom: 8,
  },
  appCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  timerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
  },
  addButtonText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
