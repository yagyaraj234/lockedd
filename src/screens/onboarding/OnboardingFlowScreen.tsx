import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { Palette } from '../../colors';
import { Motion, Radius, Spacing, Type } from '../../colors';
import { PermissionsList } from '../../components/PermissionsList';
import { PressableScale } from '../../components/PressableScale';
import { ChevronLeftIcon } from '../../components/icons';
import { useAccessibilityPreferences } from '../../hooks/useAccessibilityPreferences';
import { usePermissions } from '../../hooks/usePermissions';
import { updateSettings } from '../../store/storage';
import { useTheme } from '../../theme';

const useNativeAnimationDriver = Platform.OS !== 'android' || Number(Platform.Version) < 36;

const FocusMark = ({ colors }: { colors: Palette }) => (
  <View style={{ width: 120, height: 120, borderRadius: 36, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={70} height={70} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" stroke={colors.accent} strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="m8.8 12.2 2 2 4.5-4.5" stroke={colors.accent} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>
);

export const OnboardingFlowScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [page, setPage] = useState(0);
  const permissions = usePermissions();
  const { reduceMotion } = useAccessibilityPreferences();
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    contentOpacity.setValue(0);
    contentY.setValue(12);
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: Motion.standard, useNativeDriver: useNativeAnimationDriver }),
      Animated.timing(contentY, { toValue: 0, duration: Motion.standard, useNativeDriver: useNativeAnimationDriver }),
    ]).start();
  }, [page]);

  const finish = () => updateSettings({ onboardingComplete: true });
  const primaryAction = () => {
    if (page < 2) {
      setPage(page + 1);
      return;
    }
    if (permissions.coreReady) {
      finish();
      return;
    }
    permissions.request(permissions.statuses.accessibility ? 'overlay' : 'accessibility');
  };
  const primaryLabel = page < 2
    ? 'Continue'
    : permissions.coreReady
      ? 'Start using Locked'
      : permissions.statuses.accessibility
        ? 'Allow draw over apps'
        : 'Allow accessibility';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        {page > 0 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => setPage(page - 1)}
            style={styles.back}
            pressedStyle={styles.pressed}
          >
            <ChevronLeftIcon size={24} color={colors.label} />
          </PressableScale>
        ) : <View style={styles.back} />}
        <Text style={styles.progress}>{page + 1} of 3</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, { opacity: contentOpacity, transform: [{ translateY: contentY }] }]}>
          {page === 0 ? (
            <>
              <FocusMark colors={colors} />
              <Text style={styles.largeTitle}>Protect your attention.</Text>
              <Text style={styles.body}>Locked adds a deliberate barrier between an impulse and the apps that pull you away.</Text>
            </>
          ) : null}

          {page === 1 ? (
            <>
              <Text style={styles.eyebrow}>HOW IT WORKS</Text>
              <Text style={styles.largeTitle}>Choose the right kind of block.</Text>
              <View style={styles.cards}>
                <View style={styles.card}>
                  <Text style={styles.cardKicker}>TIMED</Text>
                  <Text style={styles.cardTitle}>Focus for a set period</Text>
                  <Text style={styles.cardBody}>The block expires automatically after 1, 10, or 24 hours.</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardKicker}>PERMANENT</Text>
                  <Text style={styles.cardTitle}>Keep an app out of reach</Text>
                  <Text style={styles.cardBody}>It stays blocked until you remove it after the lock window ends.</Text>
                </View>
              </View>
            </>
          ) : null}

          {page === 2 ? (
            <>
              <Text style={styles.eyebrow}>REQUIRED SETUP</Text>
              <Text style={styles.largeTitle}>Two permissions. Nothing extra.</Text>
              <Text style={styles.body}>Android needs these to detect a blocked app and cover it immediately.</Text>
              <View style={styles.permissionWrap}>
                <PermissionsList
                  statuses={permissions.statuses}
                  loading={permissions.loading}
                  request={permissions.request}
                  includeOptional={false}
                />
              </View>
            </>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
          containerStyle={styles.fullWidth}
          accessibilityRole="button"
          onPress={primaryAction}
          style={styles.primary}
          pressedStyle={styles.primaryPressed}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </PressableScale>
        {page === 2 ? (
          <PressableScale
            containerStyle={styles.fullWidth}
            accessibilityRole="button"
            onPress={finish}
            style={styles.secondary}
            pressedStyle={styles.pressed}
          >
            <Text style={styles.secondaryText}>Set up later</Text>
          </PressableScale>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { height: 56, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, minHeight: 48, borderRadius: Radius.pill, alignItems: 'center' },
  progress: { ...Type.footnoteStrong, color: colors.labelSecondary },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, alignItems: 'center' },
  content: { width: '100%', maxWidth: 620, flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
  eyebrow: { ...Type.footnoteStrong, color: colors.accent, letterSpacing: 1.1, marginBottom: Spacing.md },
  largeTitle: { ...Type.largeTitle, color: colors.label, marginTop: Spacing.xl, maxWidth: 520 },
  body: { ...Type.body, color: colors.labelSecondary, marginTop: Spacing.lg, maxWidth: 540 },
  cards: { width: '100%', gap: Spacing.md, marginTop: Spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: Radius.lg, padding: Spacing.xl },
  cardKicker: { ...Type.footnoteStrong, color: colors.accent, letterSpacing: 0.8 },
  cardTitle: { ...Type.title, color: colors.label, marginTop: Spacing.sm },
  cardBody: { ...Type.footnote, color: colors.labelSecondary, marginTop: Spacing.sm },
  permissionWrap: { width: '100%', marginTop: Spacing.xl },
  footer: { width: '100%', maxWidth: 668, alignSelf: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm, gap: Spacing.sm },
  fullWidth: { width: '100%' },
  primary: { minHeight: 54, borderRadius: Radius.pill, alignItems: 'center', backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accent },
  primaryText: { ...Type.bodyStrong, color: colors.onAccent },
  secondary: { minHeight: 48, borderRadius: Radius.pill, alignItems: 'center' },
  secondaryText: { ...Type.bodyStrong, color: colors.labelSecondary },
  pressed: { backgroundColor: colors.surfacePressed },
});
