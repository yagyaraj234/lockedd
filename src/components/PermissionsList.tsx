import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { useTheme } from '../theme';
import type { PermissionKey, PermissionStatuses } from '../hooks/usePermissions';
import { CheckIcon } from './icons';
import { PressableScale } from './PressableScale';

const rows: Array<{
  key: PermissionKey;
  title: string;
  detail: string;
  badge?: string;
  optional?: boolean;
}> = [
  {
    key: 'accessibility',
    title: 'Accessibility',
    detail: 'Detects when a blocked app opens.',
  },
  {
    key: 'overlay',
    title: 'Draw over apps',
    detail: 'Shows the blocking screen immediately.',
  },
  {
    key: 'exactAlarms',
    title: 'Alarms & reminders',
    detail: 'Starts scheduled locks at the exact minute.',
    badge: 'SCHEDULES',
  },
  {
    key: 'batteryOptimization',
    title: 'Unrestricted battery',
    detail: 'Helps Locked stay reliable in the background.',
    optional: true,
  },
];

type Props = {
  statuses: PermissionStatuses;
  loading: boolean;
  request: (key: PermissionKey) => Promise<void>;
  includeOptional?: boolean;
};

export const PermissionsList = ({
  statuses,
  loading,
  request,
  includeOptional = true,
}: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loading} accessibilityLabel="Checking permissions">
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Checking access…</Text>
      </View>
    );
  }

  return (
    <View style={styles.group}>
      {rows.filter((row) => includeOptional || !row.optional).map((row, index, visibleRows) => {
        const granted = statuses[row.key];
        return (
          <View key={row.key}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <View style={styles.titleLine}>
                  <Text style={styles.title}>{row.title}</Text>
                  {row.optional || row.badge ? (
                    <Text style={styles.optional}>{row.badge ?? 'OPTIONAL'}</Text>
                  ) : null}
                </View>
                <Text style={styles.detail}>{row.detail}</Text>
              </View>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${row.title}, ${granted ? 'allowed' : 'not allowed'}`}
                accessibilityHint={granted ? 'Opens Android settings' : `Allow ${row.title}`}
                onPress={() => request(row.key)}
                style={[styles.action, granted && styles.actionGranted]}
                pressedStyle={styles.pressed}
              >
                {granted ? (
                  <CheckIcon size={18} color={colors.onAccent} />
                ) : (
                  <Text style={styles.actionText}>Allow</Text>
                )}
              </PressableScale>
            </View>
            {index < visibleRows.length - 1 ? <View style={styles.separator} /> : null}
          </View>
        );
      })}
    </View>
  );
};

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    group: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    row: {
      minHeight: 84,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    copy: { flex: 1 },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    title: { ...Type.bodyStrong, color: colors.label },
    detail: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
    optional: {
      fontSize: 9,
      lineHeight: 13,
      fontWeight: '700',
      letterSpacing: 0.7,
      color: colors.labelTertiary,
    },
    action: {
      minWidth: 68,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
    },
    actionGranted: { minWidth: 40, backgroundColor: colors.accent },
    actionText: { ...Type.footnoteStrong, color: colors.accent },
    pressed: { backgroundColor: colors.surfacePressed },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 16 },
    loading: {
      minHeight: 112,
      borderRadius: Radius.lg,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    loadingText: { ...Type.footnote, color: colors.labelSecondary },
  });
