import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { Palette } from '../colors';
import {
  getBlockedApps,
  setBlockedApps,
  stampDisableLock,
  type BlockedApp,
} from '../store/storage';
import { AppBlocker, type InstalledApp } from '../../modules/app-blocker/src';
import { BlockDurationModal } from '../components/BlockDurationModal';
import { LockDurationModal } from '../components/LockDurationModal';
import { AppListSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ChevronLeftIcon, SearchIcon } from '../components/icons';

interface AppWithSelected extends InstalledApp {
  selected: boolean;
}

const AppRow = React.memo(
  ({
    item,
    onToggle,
    styles,
  }: {
    item: AppWithSelected;
    onToggle: (packageName: string) => void;
    styles: any;
  }) => (
    <TouchableOpacity
      style={styles.appRow}
      onPress={() => onToggle(item.packageName)}
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
      <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
        {item.selected && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </TouchableOpacity>
  )
);

export const AddAppsScreen = ({ navigation, route }: any) => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const mode: 'temporary' | 'permanent' = route?.params?.mode ?? 'temporary';
  const [apps, setApps] = useState<AppWithSelected[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [selectedAppsToBlock, setSelectedAppsToBlock] = useState<AppWithSelected[]>([]);
  const [showLockDurationModal, setShowLockDurationModal] = useState(false);
  const [newAppsToStamp, setNewAppsToStamp] = useState<AppWithSelected[]>([]);
  const [reSelectedBlocks, setReSelectedBlocks] = useState<BlockedApp[]>([]);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    setError(false);
    try {
      const installed = await AppBlocker.getInstalledApps();
      const byPkg = new Map(getBlockedApps().map((a) => [a.packageName, a]));
      const withSelected: AppWithSelected[] = installed
        // Temporary mode can't touch permanently-blocked apps — they're managed
        // on the Blocked Apps screen. Hiding them stops a temp block from
        // silently downgrading a permanent one to timed.
        .filter((app) => {
          if (mode !== 'temporary') return true;
          return byPkg.get(app.packageName)?.blockType !== 'permanent';
        })
        .map((app) => {
          // Pre-select only blocks of the SAME mode, so the checkmarks reflect
          // what this screen actually manages (timed here, permanent there).
          const existing = byPkg.get(app.packageName);
          const selected =
            mode === 'permanent'
              ? existing?.blockType === 'permanent'
              : existing?.blockType === 'timed';
          return { ...app, selected: !!selected };
        });
      withSelected.sort((a, b) => a.appName.localeCompare(b.appName));
      setApps(withSelected);
    } catch (e) {
      console.error('Failed to load apps:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    if (!lower) return apps;
    return apps.filter(
      (a) =>
        a.appName.toLowerCase().includes(lower) ||
        a.packageName.toLowerCase().includes(lower)
    );
  }, [apps, search]);

  const toggleApp = useCallback((packageName: string) => {
    setApps((prev) =>
      prev.map((a) =>
        a.packageName === packageName ? { ...a, selected: !a.selected } : a
      )
    );
  }, []);

  // Merge new blocks with existing ones (replacing any same-package entries)
  // and persist. Shared by both the permanent and timed save paths.
  const mergeAndSave = (blockedAppsToAdd: BlockedApp[]) => {
    const existing = getBlockedApps();
    const merged = [
      ...existing.filter(
        (ea) => !blockedAppsToAdd.some((ba) => ba.packageName === ea.packageName)
      ),
      ...blockedAppsToAdd,
    ];
    setBlockedApps(merged);
  };

  const saveAndClose = () => {
    const selected = apps.filter((a) => a.selected);
    if (selected.length === 0) {
      navigation.goBack();
      return;
    }

    if (mode === 'permanent') {
      const existing = getBlockedApps();
      const permanentByPkg = new Map(
        existing
          .filter((a) => a.blockType === 'permanent')
          .map((a) => [a.packageName, a])
      );

      // Apps already permanently blocked: preserve their existing lock — do NOT
      // re-stamp. This prevents the bypass where re-saving resets the timer.
      const reSelected = selected
        .filter((a) => permanentByPkg.has(a.packageName))
        .map((a) => permanentByPkg.get(a.packageName)!);

      // Genuinely new permanent blocks that need a lock duration chosen.
      const newlyAdded = selected.filter((a) => !permanentByPkg.has(a.packageName));

      if (newlyAdded.length === 0) {
        // Only re-selections — merge with preserved locks and go back.
        mergeAndSave(reSelected);
        navigation.goBack();
        return;
      }

      // New apps need a lock duration — show the picker.
      setNewAppsToStamp(newlyAdded);
      setReSelectedBlocks(reSelected);
      setShowLockDurationModal(true);
      return;
    }

    // temporary: pick a duration via the modal
    setSelectedAppsToBlock(selected);
    setShowDurationModal(true);
  };

  const handleLockDurationSelect = (durationMs: number) => {
    const stamped = newAppsToStamp.map((a) =>
      stampDisableLock(
        {
          packageName: a.packageName,
          appName: a.appName,
          iconBase64: a.iconBase64,
          enabled: true,
          blockType: 'permanent',
          blockUntil: undefined,
        },
        durationMs
      )
    );
    mergeAndSave([...reSelectedBlocks, ...stamped]);
    setShowLockDurationModal(false);
    setNewAppsToStamp([]);
    setReSelectedBlocks([]);
    navigation.goBack();
  };

  const handleDurationSelect = (durationMs: number | 'permanent') => {
    // Permanent blocking now lives on its own flow; this path is timed-only.
    if (durationMs === 'permanent') return;

    const blockUntil = Date.now() + durationMs;
    // Never let a timed block overwrite an existing permanent one — permanent
    // always wins. (The picker already hides these, but guard the write too.)
    const permanentPkgs = new Set(
      getBlockedApps()
        .filter((a) => a.blockType === 'permanent')
        .map((a) => a.packageName)
    );
    const blockedAppsToAdd = selectedAppsToBlock
      .filter((a) => !permanentPkgs.has(a.packageName))
      .map((a) =>
        stampDisableLock({
        packageName: a.packageName,
        appName: a.appName,
        iconBase64: a.iconBase64,
        enabled: true,
        blockType: 'timed',
        blockUntil,
      })
    );

    mergeAndSave(blockedAppsToAdd);
    setShowDurationModal(false);
    setSelectedAppsToBlock([]);
    navigation.goBack();
  };

  const renderItem = useCallback(
    ({ item }: { item: AppWithSelected }) => (
      <AppRow item={item} onToggle={toggleApp} styles={styles} />
    ),
    [toggleApp, styles]
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeftIcon size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Select Apps</Text>
          <TouchableOpacity onPress={saveAndClose}>
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <SearchIcon size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search apps..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <AppListSkeleton />
        ) : error ? (
          <ErrorState
            message="Could not load installed apps."
            onRetry={loadApps}
          />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={filtered}
            renderItem={renderItem}
            keyExtractor={(item) => item.packageName}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState
                illustration="search"
                title="No apps found"
                subtitle={`No apps match "${search}"`}
              />
            }
          />
        )}

        <TouchableOpacity style={styles.cta} onPress={saveAndClose}>
          <Text style={styles.ctaText}>Add Selected Apps</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <BlockDurationModal
        visible={showDurationModal}
        appName={selectedAppsToBlock.length === 1 ? selectedAppsToBlock[0].appName : `${selectedAppsToBlock.length} apps`}
        onSelect={handleDurationSelect}
        onCancel={() => {
          setShowDurationModal(false);
          setSelectedAppsToBlock([]);
        }}
      />

      <LockDurationModal
        visible={showLockDurationModal}
        onSelect={handleLockDurationSelect}
        onCancel={() => {
          setShowLockDurationModal(false);
          setNewAppsToStamp([]);
          setReSelectedBlocks([]);
        }}
      />
    </>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
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
    letterSpacing: 0.2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
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
