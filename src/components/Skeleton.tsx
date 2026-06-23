import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';

// All SkeletonBoxes inside a SkeletonContainer share one Animated.Value
// so they pulse in perfect sync.
const PulseCtx = createContext<Animated.Value | null>(null);

export const SkeletonContainer = ({ children }: { children: React.ReactNode }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <PulseCtx.Provider value={opacity}>{children}</PulseCtx.Provider>;
};

export const SkeletonBox = ({
  width,
  height = 14,
  borderRadius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
}) => {
  const opacity = useContext(PulseCtx);
  const base = { width, height, borderRadius, backgroundColor: '#2A2A2A' } as const;
  if (!opacity) return <View style={[base, style]} />;
  return <Animated.View style={[base, { opacity }, style]} />;
};

// ---------- Composed skeletons ----------

export const AppListSkeleton = () => (
  <SkeletonContainer>
    {Array.from({ length: 9 }).map((_, i) => (
      <View key={i} style={s.appRow}>
        <SkeletonBox width={48} height={48} borderRadius={10} />
        <View style={s.appInfo}>
          <SkeletonBox width="58%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBox width="38%" height={11} />
        </View>
        <SkeletonBox width={24} height={24} borderRadius={4} />
      </View>
    ))}
  </SkeletonContainer>
);

export const PermissionsSkeleton = () => (
  <SkeletonContainer>
    <View style={{ gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={s.permRow}>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox width="45%" height={14} />
            <SkeletonBox width="70%" height={11} />
          </View>
          <SkeletonBox width={64} height={36} borderRadius={8} />
        </View>
      ))}
    </View>
  </SkeletonContainer>
);

export const ProgressSkeleton = () => (
  <SkeletonContainer>
    <View style={s.progressContent}>
      <SkeletonBox width={130} height={11} borderRadius={6} style={{ marginBottom: 24 }} />
      <SkeletonBox width={280} height={280} borderRadius={140} style={{ marginBottom: 24 }} />
      <SkeletonBox width={120} height={28} borderRadius={14} style={{ marginBottom: 32 }} />
      <SkeletonBox width="100%" height={80} borderRadius={12} style={{ marginBottom: 16 }} />
      <SkeletonBox width={168} height={44} borderRadius={22} />
    </View>
  </SkeletonContainer>
);

const s = StyleSheet.create({
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 12,
  },
  appInfo: {
    flex: 1,
    gap: 0,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  progressContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
