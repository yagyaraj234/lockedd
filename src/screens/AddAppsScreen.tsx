import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import { Colors } from '../colors';
import { getBlockedApps, setBlockedApps } from '../store/storage';
import { AppBlocker, type InstalledApp } from '../../modules/app-blocker/src';
import { BlockDurationModal } from '../components/BlockDurationModal';

interface AppWithSelected extends InstalledApp {
  selected: boolean;
}

export const AddAppsScreen = ({ navigation }: any) => {
  const [apps, setApps] = useState<AppWithSelected[]>([]);
  const [filtered, setFiltered] = useState<AppWithSelected[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [selectedAppsToBlock, setSelectedAppsToBlock] = useState<AppWithSelected[]>([]);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      const installed = await AppBlocker.getInstalledApps();
      const blocked = getBlockedApps();
      const blockedPkgs = new Set(blocked.map((a) => a.packageName));
      const withSelected: AppWithSelected[] = installed.map((app) => ({
        ...app,
        selected: blockedPkgs.has(app.packageName),
      }));
      withSelected.sort((a, b) => a.appName.localeCompare(b.appName));
      setApps(withSelected);
      setFiltered(withSelected);
    } catch (e) {
      console.error('Failed to load apps:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    const lower = text.toLowerCase();
    setFiltered(apps.filter((a) => a.appName.toLowerCase().includes(lower)));
  };

  const toggleApp = (packageName: string) => {
    setApps((prev) =>
      prev.map((a) =>
        a.packageName === packageName ? { ...a, selected: !a.selected } : a
      )
    );
    setFiltered((prev) =>
      prev.map((a) =>
        a.packageName === packageName ? { ...a, selected: !a.selected } : a
      )
    );
  };

  const saveAndClose = () => {
    const selected = apps.filter((a) => a.selected);
    if (selected.length === 0) {
      navigation.goBack();
      return;
    }
    setSelectedAppsToBlock(selected);
    setShowDurationModal(true);
  };

  const handleDurationSelect = (durationMs: number | 'permanent') => {
    const now = Date.now();
    const blockUntil = durationMs === 'permanent' ? undefined : now + durationMs;
    const blockType = durationMs === 'permanent' ? 'permanent' : 'timed';

    const blockedAppsToAdd = selectedAppsToBlock.map((a) => ({
      packageName: a.packageName,
      appName: a.appName,
      iconBase64: a.iconBase64,
      enabled: true,
      blockType: blockType as 'permanent' | 'timed',
      blockUntil,
    }));

    const existing = getBlockedApps();
    const merged = [
      ...existing.filter(
        (ea) => !blockedAppsToAdd.some((ba) => ba.packageName === ea.packageName)
      ),
      ...blockedAppsToAdd,
    ];

    setBlockedApps(merged);
    setShowDurationModal(false);
    setSelectedAppsToBlock([]);
    navigation.goBack();
  };

  const renderItem = ({ item }: {item: AppWithSelected}) => (
    <TouchableOpacity
      style={styles.appRow}
      onPress={() => toggleApp(item.packageName)}
    >
      {item.iconBase64 ? (
        <Image
          source={{ uri: `data:image/png;base64,${item.iconBase64}` }}
          style={styles.icon}
        />
      ) : (
        <View style={styles.iconPlaceholder} />
      )}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{item.appName}</Text>
        <Text style={styles.appPackage}>{item.packageName}</Text>
      </View>
      <View
        style={[
          styles.checkbox,
          item.selected && styles.checkboxSelected,
        ]}
      >
        {item.selected && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Apps</Text>
          <Text style={styles.done}>Done</Text>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search for an app..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={handleSearch}
        />

        {loading ? (
          <View style={styles.centerContent}>
            <Text style={styles.loadingText}>Loading apps...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            renderItem={renderItem}
            keyExtractor={(item) => item.packageName}
            scrollEnabled
          />
        )}

        <TouchableOpacity style={styles.cta} onPress={saveAndClose}>
          <Text style={styles.ctaText}>Add Selected Apps</Text>
        </TouchableOpacity>
      </View>

      <BlockDurationModal
        visible={showDurationModal}
        appName={selectedAppsToBlock.length === 1 ? selectedAppsToBlock[0].appName : `${selectedAppsToBlock.length} apps`}
        onSelect={handleDurationSelect}
        onCancel={() => {
          setShowDurationModal(false);
          setSelectedAppsToBlock([]);
        }}
      />
    </>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  done: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600',
  },
  search: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.bgSecondary,
    color: Colors.text,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    marginBottom: 2,
  },
  appPackage: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: Colors.bg,
    fontWeight: 'bold',
    fontSize: 14,
  },
  cta: {
    backgroundColor: Colors.accent,
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  ctaText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
