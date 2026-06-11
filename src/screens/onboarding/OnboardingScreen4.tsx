import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../colors';

// Permissions module
const Permissions = {
  async requestAccessibility() { return true; },
  async requestOverlay() { return true; },
  async requestUsageStats() { return true; },
  async requestActivityRecognition() { return true; },
};

interface PermissionState {
  accessibility: boolean;
  overlay: boolean;
  usageStats: boolean;
  activityRecognition: boolean;
}

export const OnboardingScreen4 = ({ navigation }: any) => {
  const [permissions, setPermissions] = useState<PermissionState>({
    accessibility: false,
    overlay: false,
    usageStats: false,
    activityRecognition: false,
  });

  const requestPermission = async (type: keyof PermissionState) => {
    try {
      let result = false;
      switch (type) {
        case 'accessibility':
          result = await Permissions.requestAccessibility();
          break;
        case 'overlay':
          result = await Permissions.requestOverlay();
          break;
        case 'usageStats':
          result = await Permissions.requestUsageStats();
          break;
        case 'activityRecognition':
          result = await Permissions.requestActivityRecognition();
          break;
      }
      setPermissions((prev) => ({ ...prev, [type]: result }));
    } catch (e) {
      console.error('Permission request failed:', e);
    }
  };

  const permissionsList = [
    { key: 'accessibility', label: 'Accessibility', desc: 'Required for app interception' },
    { key: 'overlay', label: 'Draw Over Apps', desc: 'Required for overlay' },
    { key: 'usageStats', label: 'Usage Access', desc: 'Required for installed app list' },
    { key: 'activityRecognition', label: 'Activity Recognition', desc: 'Required for step tracking' },
  ] as const;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      <Text style={styles.number}>04</Text>
      <Text style={styles.title}>Granting</Text>
      <Text style={styles.titleAccent}>Access</Text>
      <Text style={styles.body}>
        To monitor app usage and movement, we need several permissions.
      </Text>

      <View style={styles.permissionsList}>
        {permissionsList.map((perm) => (
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
      </View>

      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[styles.dot, i === 3 && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('Onboarding5')}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.skip}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  number: {
    fontSize: 80,
    fontWeight: 'bold',
    color: Colors.accent,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  titleAccent: {
    fontSize: 32,
    fontWeight: '300',
    fontStyle: 'italic',
    color: Colors.accent,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 24,
  },
  permissionsList: {
    gap: 12,
    marginBottom: 40,
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
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },
  dotActive: {
    backgroundColor: Colors.accent,
  },
  buttonContainer: {
    gap: 16,
  },
  cta: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
  },
  ctaText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  skip: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
