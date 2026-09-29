import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { EmptyState } from '../components/EmptyState';
import { PressableScale } from '../components/PressableScale';
import { AppDialog } from '../components/AppDialog';
import { LockIcon, PlusIcon } from '../components/icons';
import { usePermissions } from '../hooks/usePermissions';
import {
  cleanupExpiredBlocks,
  disableLockRemainingMs,
  getBlockedApps,
  isDisableLocked,
  setBlockedApps,
  type BlockedApp,
} from '../store/storage';
import { useTheme } from '../theme';

const lockLabel = (app: BlockedApp) => {
  const remaining = disableLockRemainingMs(app);
  if (remaining <= 0) return 'Ready to remove';
  if (remaining >= 86_400_000) return `Removal locked for ${Math.ceil(remaining / 86_400_000)}d`;
  if (remaining >= 3_600_000) return `Removal locked for ${Math.ceil(remaining / 3_600_000)}h`;
  return `Removal locked for ${Math.max(1, Math.ceil(remaining / 60_000))}m`;
};

export const BlockedAppsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const permissions = usePermissions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [apps, setApps] = useState<BlockedApp[]>([]);
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    cleanupExpiredBlocks();
    setApps(getBlockedApps().filter((app) => app.blockType === 'permanent'));
  }, []);

  useEffect(() => navigation.addListener('focus', refresh), [navigation, refresh]);
  useEffect(() => {
    if (!apps.some(isDisableLocked)) return;
    const interval = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(interval);
  }, [apps]);

  const addApp = () => {
    if (!permissions.coreReady) {
      navigation.navigate('Permissions');
      return;
    }
    navigation.navigate('AddApps', { mode: 'permanent' });
  };

  const remove = (app: BlockedApp) => {
    if (isDisableLocked(app)) {
      AppDialog.alert('Removal is locked', lockLabel(app));
      return;
    }
    AppDialog.alert('Remove block?', `${app.appName} will be available again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setBlockedApps(getBlockedApps().filter((item) => item.packageName !== app.packageName));
          refresh();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.maxWidth}>
        <Text style={styles.largeTitle}>Blocks</Text>
        <Text style={styles.intro}>Apps that stay out of reach until you choose to remove them.</Text>

        {apps.length === 0 ? (
          <EmptyState
            illustration="lock"
            title="No permanent blocks"
            subtitle="Add an app you want to keep out of your routine."
            actionLabel="Add an app"
            onAction={addApp}
          />
        ) : (
          <>
            <View style={styles.list}>
              {apps.map((app, index) => {
                const locked = isDisableLocked(app);
                return (
                  <View key={app.packageName}>
                    <View style={styles.row}>
                      {app.iconBase64 ? (
                        <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.icon} />
                      ) : <View style={styles.iconPlaceholder} />}
                      <View style={styles.copy}>
                        <Text style={styles.appName} numberOfLines={1}>{app.appName}</Text>
                        <View style={styles.lockLine}>
                          {locked ? <LockIcon size={13} color={colors.labelTertiary} /> : null}
                          <Text style={[styles.lockText, !locked && styles.readyText]}>{lockLabel(app)}</Text>
                        </View>
                      </View>
                      {!locked ? (
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${app.appName}`}
                          onPress={() => remove(app)}
                          style={styles.remove}
                          pressedStyle={styles.pressed}
                        >
                          <Text style={styles.removeText}>Remove</Text>
                        </PressableScale>
                      ) : null}
                    </View>
                    {index < apps.length - 1 ? <View style={styles.separator} /> : null}
                  </View>
                );
              })}
            </View>
            <PressableScale
              containerStyle={styles.fullWidth}
              accessibilityRole="button"
              onPress={addApp}
              style={styles.addButton}
              pressedStyle={styles.pressed}
            >
              <PlusIcon size={18} color={colors.accent} />
              <Text style={styles.addText}>Add permanent block</Text>
            </PressableScale>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: 680 },
  largeTitle: { ...Type.largeTitle, color: colors.label },
  intro: { ...Type.body, color: colors.labelSecondary, marginTop: Spacing.sm, maxWidth: 520 },
  list: { marginTop: Spacing.xxl, borderRadius: Radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { minHeight: 78, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 48, height: 48, borderRadius: 12 },
  iconPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surfacePressed },
  copy: { flex: 1 },
  appName: { ...Type.bodyStrong, color: colors.label },
  lockLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  lockText: { ...Type.footnote, color: colors.labelTertiary },
  readyText: { color: colors.accent },
  remove: { minHeight: 48, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, alignItems: 'center' },
  removeText: { ...Type.footnoteStrong, color: colors.danger },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 76 },
  fullWidth: { width: '100%' },
  addButton: { marginTop: Spacing.md, borderRadius: Radius.pill, borderWidth: 1, borderColor: colors.separator, backgroundColor: colors.surface, alignItems: 'center', flexDirection: 'row', gap: Spacing.sm },
  addText: { ...Type.bodyStrong, color: colors.accent },
  pressed: { backgroundColor: colors.surfacePressed },
});
