import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { ChoiceSheet, type ChoiceOption } from '../components/ChoiceSheet';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PressableScale } from '../components/PressableScale';
import { AppListSkeleton } from '../components/Skeleton';
import { CheckIcon, ChevronLeftIcon, SearchIcon } from '../components/icons';
import { filterEligibleApps } from '../domain';
import { AppBlocker, type InstalledApp } from '../../modules/app-blocker/src';
import { getBlockedApps, setBlockedApps, stampDisableLock, type BlockedApp } from '../store/storage';
import { useTheme } from '../theme';

type SelectableApp = InstalledApp & { selected: boolean };

const timedOptions: ChoiceOption<number>[] = [
  { label: '1 hour', description: 'A short focus session', value: 3_600_000 },
  { label: '10 hours', description: 'Most of the day', value: 36_000_000 },
  { label: '24 hours', description: 'A full day away', value: 86_400_000 },
];

const permanentOptions: ChoiceOption<number>[] = [
  { label: '12 hours', description: 'Earliest removal time', value: 43_200_000 },
  { label: '1 day', description: 'Removal locked for 24 hours', value: 86_400_000 },
  { label: '7 days', description: 'Removal locked for one week', value: 604_800_000 },
  { label: '28 days', description: 'Removal locked for four weeks', value: 2_419_200_000 },
];

const confirmationHaptic = () => {
  if (Platform.OS === 'android') {
    return Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
  }
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const AddAppsScreen = ({ navigation, route }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const mode: 'temporary' | 'permanent' = route?.params?.mode ?? 'temporary';
  const [apps, setApps] = useState<SelectableApp[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const installed = await AppBlocker.getInstalledApps();
      const eligible = filterEligibleApps(installed, getBlockedApps())
        .sort((a, b) => a.appName.localeCompare(b.appName))
        .map((app) => ({ ...app, selected: false }));
      setApps(eligible);
    } catch (loadError) {
      console.error('Failed to load installed apps:', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return apps;
    return apps.filter((app) => app.appName.toLowerCase().includes(query) || app.packageName.toLowerCase().includes(query));
  }, [apps, search]);
  const selected = useMemo(() => apps.filter((app) => app.selected), [apps]);

  const toggle = useCallback((packageName: string) => {
    setApps((current) => current.map((app) => app.packageName === packageName ? { ...app, selected: !app.selected } : app));
  }, []);

  const save = (duration: number) => {
    const existing = getBlockedApps();
    const stillEligible = filterEligibleApps(selected, existing);
    if (stillEligible.length === 0) {
      setShowSheet(false);
      loadApps();
      return;
    }
    const blockUntil = Date.now() + duration;
    const additions: BlockedApp[] = stillEligible.map((app) => stampDisableLock({
      packageName: app.packageName,
      appName: app.appName,
      iconBase64: app.iconBase64,
      enabled: true,
      blockType: mode === 'temporary' ? 'timed' : 'permanent',
      blockUntil: mode === 'temporary' ? blockUntil : undefined,
    }, mode === 'permanent' ? duration : undefined));
    setBlockedApps([...existing, ...additions]);
    confirmationHaptic().catch(() => {});
    setShowSheet(false);
    navigation.goBack();
  };

  const renderItem = useCallback(({ item }: { item: SelectableApp }) => (
    <PressableScale
      containerStyle={styles.fullWidth}
      accessibilityRole="checkbox"
      accessibilityLabel={item.appName}
      accessibilityState={{ checked: item.selected }}
      onPress={() => toggle(item.packageName)}
      style={styles.row}
      pressedStyle={styles.rowPressed}
    >
      {item.iconBase64 ? (
        <Image accessible={false} source={{ uri: `data:image/png;base64,${item.iconBase64}` }} style={styles.icon} />
      ) : <View style={styles.iconPlaceholder} />}
      <Text style={styles.appName} numberOfLines={1}>{item.appName}</Text>
      <View style={[styles.check, item.selected && styles.checkSelected]}>
        {item.selected ? <CheckIcon size={16} color={colors.onAccent} /> : null}
      </View>
    </PressableScale>
  ), [colors.onAccent, styles, toggle]);

  const countLabel = `${selected.length} app${selected.length === 1 ? '' : 's'}`;

  return (
    <>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={navigation.goBack} style={styles.back} pressedStyle={styles.rowPressed}>
            <ChevronLeftIcon size={24} color={colors.label} />
          </PressableScale>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Choose apps</Text>
            <Text style={styles.headerSubtitle}>{mode === 'temporary' ? 'Timed block' : 'Permanent block'}</Text>
          </View>
          <View style={styles.back} />
        </View>

        <View style={styles.maxWidth}>
          <View style={styles.search}>
            <SearchIcon size={18} color={colors.labelTertiary} />
            <TextInput
              accessibilityLabel="Search installed apps"
              value={search}
              onChangeText={setSearch}
              placeholder="Search apps"
              placeholderTextColor={colors.labelTertiary}
              style={styles.input}
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>

          <View style={styles.listWrap}>
            {loading ? <AppListSkeleton /> : error ? (
              <ErrorState message="Could not load installed apps." onRetry={loadApps} />
            ) : (
              <FlatList
                data={filtered}
                renderItem={renderItem}
                keyExtractor={(item) => item.packageName}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={filtered.length === 0 ? styles.emptyList : styles.listContent}
                ListEmptyComponent={
                  <EmptyState
                    illustration="search"
                    title={search ? 'No matching apps' : 'No apps left to add'}
                    subtitle={search ? `Nothing matches “${search}”.` : 'Every eligible app is already blocked.'}
                  />
                }
              />
            )}
          </View>

          <View style={styles.footer}>
            <PressableScale
              containerStyle={styles.fullWidth}
              accessibilityRole="button"
              accessibilityState={{ disabled: selected.length === 0 }}
              disabled={selected.length === 0}
              onPress={() => setShowSheet(true)}
              style={styles.continueButton}
              pressedStyle={styles.continuePressed}
            >
              <Text style={styles.continueText}>Continue with {countLabel}</Text>
            </PressableScale>
          </View>
        </View>
      </SafeAreaView>

      <ChoiceSheet
        visible={showSheet}
        title={mode === 'temporary' ? 'Choose block duration' : 'Lock removal'}
        subtitle={mode === 'temporary'
          ? `${countLabel} will become available when this timer expires.`
          : `${countLabel} will stay blocked until manually removed after this lock window.`}
        options={mode === 'temporary' ? timedOptions : permanentOptions}
        confirmLabel={mode === 'temporary' ? `Block ${countLabel}` : `Add ${countLabel}`}
        onConfirm={save}
        onDismiss={() => setShowSheet(false)}
      />
    </>
  );
};

const makeStyles = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { height: 60, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, minHeight: 48, borderRadius: Radius.pill, alignItems: 'center' },
  headerCopy: { alignItems: 'center' },
  headerTitle: { ...Type.bodyStrong, color: colors.label },
  headerSubtitle: { ...Type.footnote, color: colors.labelSecondary },
  maxWidth: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  search: { minHeight: 48, marginHorizontal: Spacing.lg, marginVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: { flex: 1, ...Type.body, color: colors.label, paddingVertical: 0 },
  listWrap: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  fullWidth: { width: '100%' },
  row: { minHeight: 68, paddingHorizontal: Spacing.xs, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  rowPressed: { backgroundColor: colors.surfacePressed },
  icon: { width: 44, height: 44, borderRadius: 11, marginRight: Spacing.md },
  iconPlaceholder: { width: 44, height: 44, borderRadius: 11, marginRight: Spacing.md, backgroundColor: colors.surfacePressed },
  appName: { ...Type.bodyStrong, color: colors.label, flex: 1 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.labelTertiary, alignItems: 'center', justifyContent: 'center' },
  checkSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: colors.background },
  continueButton: { minHeight: 54, borderRadius: Radius.pill, backgroundColor: colors.accent, alignItems: 'center' },
  continuePressed: { backgroundColor: colors.accent },
  continueText: { ...Type.bodyStrong, color: colors.onAccent },
});
