import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useTheme } from '../theme';
import type { Palette } from '../colors';
import { getBlockedApps, BlockedApp } from '../store/storage';
import { AppBlocker } from '../../modules/app-blocker/src';
import { ShieldIcon, GearIcon, PlusIcon } from '../components/icons';
import { EmptyState } from '../components/EmptyState';
import { HomeMetrics } from '../components/HomeMetrics';

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
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [stats, setStats] = useState({ totalAttempts: 0, todayAttempts: 0 });
  const [, setTick] = useState(0);

  // Block-attempt stats live in native shared prefs (written by the
  // accessibility service). try/catch keeps an old APK without the native
  // method from crashing Home.
  const loadStats = () => {
    try {
      setStats(AppBlocker.getBlockStats());
    } catch {
      // Native method missing (pre-rebuild) — leave zeros.
    }
  };

  const refresh = () => {
    setBlockedApps(
      getBlockedApps().filter(
        (a) => a.blockType === 'timed' && (a.blockUntil == null || a.blockUntil > Date.now())
      )
    );
    loadStats();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refresh();
    });
    return unsubscribe;
  }, [navigation]);

  // Tick every 60s so countdowns update while the screen is open; also re-read
  // stats so saved-time stays live if a block fires while Home is foregrounded.
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
      loadStats();
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

      <HomeMetrics
        totalAttempts={stats.totalAttempts}
        todayAttempts={stats.todayAttempts}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TEMPORARILY BLOCKED</Text>
        {blockedApps.length === 0 ? (
          <EmptyState
            illustration="shield"
            title="Nothing blocked yet"
            subtitle="Block apps for a set time to keep distractions out."
            actionLabel="Block an app"
            onAction={() => navigation.navigate('AddApps', { mode: 'temporary' })}
          />
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
                  <View style={styles.timerChip}>
                    <Text style={styles.timerChipText} numberOfLines={1}>
                      {formatTimeRemaining(app.blockUntil)}
                    </Text>
                  </View>
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

const makeStyles = (Colors: Palette) => StyleSheet.create({
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginBottom: 14,
    letterSpacing: 1.2,
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
  timerChip: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: 'stretch',
  },
  timerChipText: {
    fontSize: 11,
    color: Colors.accent,
    textAlign: 'center',
    fontWeight: '600',
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
