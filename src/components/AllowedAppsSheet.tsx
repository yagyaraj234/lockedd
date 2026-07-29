import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBlocker, type InstalledApp } from '../../modules/app-blocker/src';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { useTheme } from '../theme';
import { CloseIcon } from './icons';
import { PressableScale } from './PressableScale';

type Props = {
  visible: boolean;
  selected: string[];
  onConfirm: (packageNames: string[]) => void;
  onDismiss: () => void;
};

export function AllowedAppsSheet({ visible, selected, onConfirm, onDismiss }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelection(selected);
    setQuery('');
    setLoading(true);
    AppBlocker.getInstalledApps()
      .then((installed) =>
        setApps(
          installed
            .filter(
              (app) =>
                app.canAllowDuringPhoneLock && !app.isAlwaysAllowedDuringPhoneLock
            )
            .sort((a, b) => a.appName.localeCompare(b.appName))
        )
      )
      .catch(() => Alert.alert('Could not load apps', 'Rebuild the native app and try again.'))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = apps.filter(
    (app) =>
      app.appName.toLowerCase().includes(query.toLowerCase()) ||
      app.packageName.toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (packageName: string) => {
    if (selection.includes(packageName)) {
      setSelection(selection.filter((value) => value !== packageName));
      return;
    }
    if (selection.length === 5) {
      Alert.alert('Five-app limit', 'Remove one allowed app before adding another.');
      return;
    }
    setSelection([...selection, packageName]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.fill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close allowed apps"
          style={styles.scrim}
          onPress={onDismiss}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Allowed apps</Text>
              <Text style={styles.subtitle}>
                Choose up to five. Phone is always available and uses no slot.
              </Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onDismiss}
              style={styles.close}
              pressedStyle={styles.pressed}
            >
              <CloseIcon size={20} color={colors.labelSecondary} />
            </PressableScale>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={colors.labelTertiary}
            accessibilityLabel="Search allowed apps"
            style={styles.search}
          />

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.map((app) => {
                const active = selection.includes(app.packageName);
                return (
                  <PressableScale
                    key={app.packageName}
                    containerStyle={styles.fullWidth}
                    accessibilityRole="checkbox"
                    accessibilityLabel={app.appName}
                    accessibilityState={{ checked: active }}
                    onPress={() => toggle(app.packageName)}
                    style={[styles.row, active && styles.rowActive]}
                    pressedStyle={styles.pressed}
                  >
                    {app.iconBase64 ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                        style={styles.icon}
                      />
                    ) : (
                      <View style={styles.icon} />
                    )}
                    <View style={styles.rowCopy}>
                      <Text style={styles.appName} numberOfLines={1}>
                        {app.appName}
                      </Text>
                      <Text style={styles.packageName} numberOfLines={1}>
                        {app.packageName}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
                      {active ? <Text style={styles.check}>✓</Text> : null}
                    </View>
                  </PressableScale>
                );
              })}
              {filtered.length === 0 ? (
                <Text style={styles.empty}>No eligible apps found.</Text>
              ) : null}
            </ScrollView>
          )}

          <PressableScale
            containerStyle={styles.fullWidth}
            accessibilityRole="button"
            accessibilityLabel={`Save ${selection.length} allowed apps`}
            onPress={() => onConfirm(selection)}
            style={styles.confirm}
            pressedStyle={styles.confirmPressed}
          >
            <Text style={styles.confirmText}>
              Save {selection.length}/5
            </Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fill: { flex: 1, justifyContent: 'flex-end' },
    scrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.scrim,
    },
    sheet: {
      maxHeight: '92%',
      minHeight: '68%',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: colors.surfaceElevated,
    },
    handle: {
      width: 38,
      height: 5,
      borderRadius: 3,
      alignSelf: 'center',
      backgroundColor: colors.labelTertiary,
      opacity: 0.55,
    },
    header: {
      marginTop: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    headerCopy: { flex: 1 },
    title: { ...Type.title, color: colors.label },
    subtitle: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
    close: {
      width: 44,
      minHeight: 44,
      borderRadius: Radius.pill,
      alignItems: 'center',
      backgroundColor: colors.surfacePressed,
    },
    search: {
      minHeight: 50,
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: colors.surface,
      ...Type.body,
      color: colors.label,
    },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { flex: 1, marginTop: Spacing.md },
    row: {
      minHeight: 66,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderRadius: Radius.md,
    },
    rowActive: { backgroundColor: colors.accentMuted },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.surfacePressed,
    },
    rowCopy: { flex: 1 },
    appName: { ...Type.bodyStrong, color: colors.label },
    packageName: { ...Type.footnote, color: colors.labelSecondary },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.separator,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: { borderColor: colors.accent, backgroundColor: colors.accent },
    check: { color: colors.onAccent, fontWeight: '700' },
    empty: {
      ...Type.body,
      color: colors.labelSecondary,
      textAlign: 'center',
      paddingVertical: Spacing.xxl,
    },
    confirm: {
      marginTop: Spacing.md,
      minHeight: 52,
      borderRadius: Radius.pill,
      alignItems: 'center',
      backgroundColor: colors.accent,
    },
    confirmPressed: { opacity: 0.85 },
    confirmText: { ...Type.bodyStrong, color: colors.onAccent },
    fullWidth: { width: '100%' },
    pressed: { backgroundColor: colors.surfacePressed },
  });
