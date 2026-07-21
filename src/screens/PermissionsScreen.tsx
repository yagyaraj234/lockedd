import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { PermissionsList } from '../components/PermissionsList';
import { PressableScale } from '../components/PressableScale';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { usePermissions } from '../hooks/usePermissions';
import { Permissions } from '../../modules/permissions/src';
import { useTheme } from '../theme';

export const PermissionsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const permissions = usePermissions();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={navigation.goBack} style={styles.back} pressedStyle={styles.pressed}>
          <ChevronLeftIcon size={24} color={colors.label} />
        </PressableScale>
        <Text style={styles.headerTitle}>Permissions</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.maxWidth}>
          <Text style={styles.title}>{permissions.coreReady ? 'Blocking is ready.' : 'Finish setup.'}</Text>
          <Text style={styles.body}>Required access stays focused on app blocking. Battery access is optional.</Text>
          <View style={styles.listWrap}>
            <PermissionsList statuses={permissions.statuses} loading={permissions.loading} request={permissions.request} />
          </View>

          <PressableScale
            containerStyle={styles.fullWidth}
            accessibilityRole="button"
            accessibilityState={{ expanded: showHelp }}
            onPress={() => setShowHelp((value) => !value)}
            style={styles.helpToggle}
            pressedStyle={styles.pressed}
          >
            <View style={styles.helpCopy}>
              <Text style={styles.helpTitle}>Accessibility option unavailable?</Text>
              <Text style={styles.helpDetail}>Help for restricted settings</Text>
            </View>
            <ChevronRightIcon size={20} color={colors.labelTertiary} />
          </PressableScale>

          {showHelp ? (
            <View style={styles.helpCard}>
              <Text style={styles.helpBody}>On Android 13+, open App info, use the top-right menu, choose “Allow restricted settings,” then return and allow Accessibility.</Text>
              <PressableScale
                containerStyle={styles.fullWidth}
                accessibilityRole="button"
                onPress={() => Permissions.openAppInfo()}
                style={styles.helpButton}
                pressedStyle={styles.pressed}
              >
                <Text style={styles.helpButtonText}>Open App info</Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { height: 56, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, minHeight: 48, borderRadius: Radius.pill, alignItems: 'center' },
  headerTitle: { ...Type.bodyStrong, color: colors.label },
  content: { padding: Spacing.xl, paddingBottom: 48, alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: 680 },
  title: { ...Type.largeTitle, color: colors.label },
  body: { ...Type.body, color: colors.labelSecondary, marginTop: Spacing.md },
  listWrap: { marginTop: Spacing.xl },
  fullWidth: { width: '100%' },
  helpToggle: { marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  helpCopy: { flex: 1, paddingVertical: Spacing.md },
  helpTitle: { ...Type.bodyStrong, color: colors.label },
  helpDetail: { ...Type.footnote, color: colors.labelSecondary, marginTop: 2 },
  helpCard: { marginTop: Spacing.sm, borderRadius: Radius.lg, backgroundColor: colors.surface, padding: Spacing.lg },
  helpBody: { ...Type.footnote, color: colors.labelSecondary },
  helpButton: { marginTop: Spacing.lg, borderRadius: Radius.pill, alignItems: 'center', backgroundColor: colors.accentMuted },
  helpButtonText: { ...Type.bodyStrong, color: colors.accent },
  pressed: { backgroundColor: colors.surfacePressed },
});
