import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../colors';
import { Motion, Radius, Spacing, Type } from '../colors';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';
import { useTheme } from '../theme';
import { useBlurTarget } from './AppMaterial';
import { CheckIcon, CloseIcon } from './icons';
import { PressableScale } from './PressableScale';

export type ChoiceOption<T> = {
  label: string;
  description?: string;
  value: T;
};

type Props<T> = {
  visible: boolean;
  title: string;
  subtitle: string;
  options: ChoiceOption<T>[];
  confirmLabel: string;
  onConfirm: (value: T) => void;
  onDismiss: () => void;
};

const rubberBand = (distance: number, dimension: number) =>
  (distance * dimension * 0.55) / (dimension + 0.55 * Math.abs(distance));

const useNativeAnimationDriver = Platform.OS !== 'android' || Number(Platform.Version) < 36;

export function ChoiceSheet<T>({
  visible,
  title,
  subtitle,
  options,
  confirmLabel,
  onConfirm,
  onDismiss,
}: Props<T>) {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const blurTarget = useBlurTarget();
  const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<T | null>(null);
  const [height, setHeight] = useState(520);
  const [transformActive, setTransformActive] = useState(false);
  const translateY = useRef(new Animated.Value(520)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const usesBlur = !reduceTransparency && blurTarget != null;

  const settle = (toValue: number, done?: () => void) => {
    setTransformActive(true);
    if (reduceMotion) {
      translateY.setValue(toValue);
      if (toValue === 0) setTransformActive(false);
      if (done) Animated.timing(scrimOpacity, { toValue: 0, duration: 120, useNativeDriver: useNativeAnimationDriver }).start(done);
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue,
        ...Motion.spring,
        overshootClamping: true,
        useNativeDriver: useNativeAnimationDriver,
      }),
      Animated.timing(scrimOpacity, {
        toValue: toValue === 0 ? 1 : 0,
        duration: Motion.standard,
        useNativeDriver: useNativeAnimationDriver,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (toValue === 0) setTransformActive(false);
      done?.();
    });
  };

  const dismiss = () => settle(height, onDismiss);

  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    translateY.setValue(reduceMotion ? 0 : height);
    scrimOpacity.setValue(0);
    requestAnimationFrame(() => settle(0));
  }, [visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => setTransformActive(true),
        onPanResponderMove: (_, gesture) => {
          const next = gesture.dy < 0 ? rubberBand(gesture.dy, height) : gesture.dy;
          translateY.setValue(next);
          scrimOpacity.setValue(Math.max(0, 1 - Math.max(0, next) / height));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldDismiss = gesture.dy > Math.min(160, height * 0.28) || gesture.vy > 0.9;
          if (shouldDismiss) {
            dismiss();
            return;
          }
          if (reduceMotion) {
            translateY.setValue(0);
            scrimOpacity.setValue(1);
            setTransformActive(false);
            return;
          }
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              velocity: gesture.vy,
              ...Motion.spring,
              overshootClamping: true,
              useNativeDriver: useNativeAnimationDriver,
            }),
            Animated.timing(scrimOpacity, { toValue: 1, duration: 140, useNativeDriver: useNativeAnimationDriver }),
          ]).start(({ finished }) => finished && setTransformActive(false));
        },
        onPanResponderTerminate: () => settle(0),
      }),
    [height, reduceMotion]
  );

  const choose = (value: T) => {
    setSelected(value);
    if (Platform.OS === 'android') {
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick).catch(() => {});
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrimOpacity }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close choice sheet"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            onPress={dismiss}
          />
        </Animated.View>
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            transformActive ? { transform: [{ translateY }] } : null,
          ]}
        >
          {usesBlur ? (
            <BlurView
              blurTarget={blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={42}
              tint={name === 'dark' ? 'systemMaterialDark' : 'systemMaterialLight'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: usesBlur
              ? name === 'dark' ? 'rgba(24,27,21,0.88)' : 'rgba(255,255,255,0.86)'
              : colors.surfaceElevated,
          }]} />
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={dismiss}
              style={styles.close}
              pressedStyle={styles.pressed}
            >
              <CloseIcon size={20} color={colors.labelSecondary} />
            </PressableScale>
          </View>

          <View style={styles.options} accessibilityRole="radiogroup">
            {options.map((option) => {
              const active = selected === option.value;
              return (
                <PressableScale
                  key={String(option.value)}
                  containerStyle={styles.fullWidth}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => choose(option.value)}
                  style={[styles.option, active && styles.optionActive]}
                  pressedStyle={styles.pressed}
                >
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <CheckIcon size={15} color={colors.onAccent} /> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <PressableScale
            containerStyle={styles.fullWidth}
            accessibilityRole="button"
            accessibilityState={{ disabled: selected == null }}
            disabled={selected == null}
            onPress={() => selected != null && onConfirm(selected)}
            style={styles.confirm}
            pressedStyle={styles.confirmPressed}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fill: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      overflow: 'hidden',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      maxHeight: '82%',
    },
    handle: {
      width: 38,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.labelTertiary,
      opacity: 0.55,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    headerCopy: { flex: 1 },
    title: { ...Type.title, color: colors.label },
    subtitle: { ...Type.footnote, color: colors.labelSecondary, marginTop: Spacing.xs },
    close: {
      width: 48,
      minHeight: 48,
      borderRadius: Radius.pill,
      alignItems: 'center',
      backgroundColor: colors.surfacePressed,
    },
    options: { marginTop: Spacing.xl, gap: Spacing.sm },
    option: {
      minHeight: 68,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.separator,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    optionActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    optionCopy: { flex: 1 },
    optionLabel: { ...Type.bodyStrong, color: colors.label },
    optionDescription: { ...Type.footnote, color: colors.labelSecondary, marginTop: 2 },
    radio: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.labelTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
    pressed: { backgroundColor: colors.surfacePressed },
    confirm: {
      minHeight: 54,
      borderRadius: Radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    confirmPressed: { backgroundColor: colors.accent },
    confirmText: { ...Type.bodyStrong, color: colors.onAccent },
    fullWidth: { width: '100%' },
  });
