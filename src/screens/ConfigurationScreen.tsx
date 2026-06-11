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
import { getBlockedApps, setBlockedApps, getSettings, updateSettings } from '../store/storage';

interface BlockedApp {
  packageName: string;
  appName: string;
  iconBase64: string;
  enabled: boolean;
}

export const ConfigurationScreen = ({ navigation }: any) => {
  const [blockedApps, setBlockedAppsState] = useState<BlockedApp[]>([]);
  const [settings, setSettingsState] = useState(getSettings());

  useEffect(() => {
    setBlockedAppsState(getBlockedApps());
  }, []);

  const toggleApp = (packageName: string) => {
    const updated = blockedApps.map((a) =>
      a.packageName === packageName ? { ...a, enabled: !a.enabled } : a
    );
    setBlockedAppsState(updated);
    setBlockedApps(updated);
  };

  const toggleMode = (mode: 'temporary' | 'physical') => {
    const newSettings = { ...settings, unlockMode: mode };
    setSettingsState(newSettings);
    updateSettings(newSettings);
  };

  const togglePreventionMode = (value: boolean) => {
    const newSettings = { ...settings, preventionMode: value };
    setSettingsState(newSettings);
    updateSettings(newSettings);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Configuration</Text>
        <View style={styles.spacer} />
      </View>

      {/* Blocked Apps Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BLOCKED APPS</Text>
        {blockedApps.length === 0 ? (
          <Text style={styles.emptyText}>No apps blocked yet</Text>
        ) : (
          blockedApps.map((app) => (
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
              </View>
              <Switch
                value={app.enabled}
                onValueChange={() => toggleApp(app.packageName)}
                trackColor={{ false: Colors.bgSecondary, true: Colors.accent }}
                thumbColor={app.enabled ? Colors.accent : Colors.bgSecondary}
              />
            </View>
          ))
        )}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddApps')}
        >
          <Text style={styles.addButtonText}>+ Add more apps</Text>
        </TouchableOpacity>
      </View>

      {/* Unlock Methods Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>UNLOCK methods</Text>
        <TouchableOpacity
          style={[
            styles.modeCard,
            settings.unlockMode === 'temporary' && styles.modeCardActive,
          ]}
          onPress={() => toggleMode('temporary')}
        >
          <View>
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
          <View>
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
          <View>
            <Text style={styles.securityLabel}>Prevention Mode</Text>
            <Text style={styles.securityDesc}>Prevents uninstalling the app during focus blocks.</Text>
          </View>
          <Switch
            value={settings.preventionMode}
            onValueChange={togglePreventionMode}
            trackColor={{ false: Colors.bgSecondary, true: Colors.accent }}
            thumbColor={settings.preventionMode ? Colors.accent : Colors.bgSecondary}
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.saveButtonText}>Save Configuration</Text>
      </TouchableOpacity>

      <View style={styles.spacer16} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
  },
  back: {
    fontSize: 32,
    color: Colors.text,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  spacer: {
    width: 32,
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
  emptyText: {
    color: Colors.textTertiary,
    fontSize: 14,
    marginBottom: 16,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSecondary,
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
  },
  addButton: {
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
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
  saveButton: {
    backgroundColor: Colors.accent,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer16: {
    height: 16,
  },
});
