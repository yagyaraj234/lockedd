import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View, StyleSheet } from 'react-native';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';
import { useTheme } from '../theme';

const PulseCtx = createContext<Animated.Value | null>(null);
const useNativeAnimationDriver = Platform.OS !== 'android' || Number(Platform.Version) < 36;

export const SkeletonContainer = ({ children }: { children: React.ReactNode }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const { reduceMotion } = useAccessibilityPreferences();

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.42, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: useNativeAnimationDriver }),
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: useNativeAnimationDriver }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return <PulseCtx.Provider value={opacity}>{children}</PulseCtx.Provider>;
};

export const SkeletonBox = ({ width, height = 14, borderRadius = 6, style }: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
}) => {
  const opacity = useContext(PulseCtx);
  const { colors } = useTheme();
  const base = { width, height, borderRadius, backgroundColor: colors.skeleton } as const;
  if (!opacity) return <View style={[base, style]} />;
  return <Animated.View style={[base, { opacity }, style]} />;
};

export const AppListSkeleton = () => (
  <SkeletonContainer>
    {Array.from({ length: 8 }).map((_, index) => (
      <View key={index} style={styles.appRow}>
        <SkeletonBox width={44} height={44} borderRadius={11} />
        <SkeletonBox width="52%" height={16} />
        <SkeletonBox width={26} height={26} borderRadius={13} style={{ marginLeft: 'auto' }} />
      </View>
    ))}
  </SkeletonContainer>
);

const styles = StyleSheet.create({
  appRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 14 },
});
