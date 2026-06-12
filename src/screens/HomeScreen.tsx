import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Colors } from '../colors';
import { getBlockedApps } from '../store/storage';

interface BlockedApp {
  packageName: string;
  appName: string;
  iconBase64: string;
  enabled: boolean;
}

export const HomeScreen = ({ navigation }: any) => {
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setBlockedApps(getBlockedApps());
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Locked</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BLOCKED APPS</Text>
        {blockedApps.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No apps blocked yet</Text>
            <Text style={styles.emptySubtext}>Add your first app to get started</Text>
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
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddApps')}
      >
        <Text style={styles.addButtonText}>+ Add more apps</Text>
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
  headerButton: {
    fontSize: 24,
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
});
