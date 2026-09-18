import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OverlayDesign } from '../../modules/app-blocker/src';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';
import { useTheme } from '../theme';
import { CheckIcon, CloseIcon } from './icons';
import { PressableScale } from './PressableScale';

export const OVERLAY_DESIGNS: Array<{
  id: OverlayDesign;
  name: string;
  quote: string;
  background: string;
  shade: string;
  accent: string;
}> = [
  { id: 'sunrise', name: 'New Dawn', quote: 'Begin again', background: '#0B1025', shade: '#3A1E42', accent: '#FFCD79' },
  { id: 'orbit', name: 'True Orbit', quote: 'Stay on course', background: '#061719', shade: '#16322D', accent: '#77EAB8' },
  { id: 'waves', name: 'Forward Tide', quote: 'Keep moving', background: '#071329', shade: '#173462', accent: '#65AFFF' },
  { id: 'bloom', name: 'Bloom', quote: 'Grow through it', background: '#180C20', shade: '#41182F', accent: '#FF8FBC' },
  { id: 'stars', name: 'Higher Ground', quote: 'Aim higher', background: '#050711', shade: '#111936', accent: '#FFE18F' },
  { id: 'grid', name: 'Next Step', quote: 'One step at a time', background: '#090A08', shade: '#242719', accent: '#C6E86A' },
];

export const overlayDesignName = (design: OverlayDesign) =>
  design === 'custom'
    ? 'Custom wallpaper'
    : OVERLAY_DESIGNS.find((option) => option.id === design)?.name ?? OVERLAY_DESIGNS[0].name;

type PreviewProps = {
  design: OverlayDesign;
  customWallpaperUri?: string | null;
  style?: StyleProp<ViewStyle>;
  showQuote?: boolean;
};

export function OverlayDesignPreview({ design, customWallpaperUri, style, showQuote = true }: PreviewProps) {
  const option = OVERLAY_DESIGNS.find((candidate) => candidate.id === design) ?? OVERLAY_DESIGNS[0];
  const isCustom = design === 'custom';
  const { reduceMotion } = useAccessibilityPreferences();
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || isCustom) {
      motion.setValue(0.35);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 4_500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 4_500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isCustom, motion, reduceMotion]);

  const rise = motion.interpolate({ inputRange: [0, 1], outputRange: [10, -8] });
  const pulse = motion.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.12] });
  const rotate = motion.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '198deg'] });
  const drift = motion.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const fade = motion.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  const visual = (() => {
    switch (design) {
      case 'custom':
        return null;
      case 'orbit':
        return (
          <Animated.View style={[styles.orbit, { borderColor: option.accent, transform: [{ rotate }] }]}>
            <View style={[styles.orbitInner, { borderColor: option.accent }]} />
            <View style={[styles.orbitDot, { backgroundColor: option.accent }]} />
          </Animated.View>
        );
      case 'waves':
        return (
          <Animated.View style={[styles.waveGroup, { transform: [{ translateX: drift }] }]}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={[styles.wave, { top: 12 + index * 24, borderColor: option.accent, opacity: 0.8 - index * 0.12 }]} />
            ))}
          </Animated.View>
        );
      case 'bloom':
        return (
          <Animated.View style={[styles.bloom, { transform: [{ scale: pulse }] }]}>
            {[1, 0.72, 0.44].map((scale) => (
              <View key={scale} style={[styles.bloomRing, { borderColor: option.accent, transform: [{ scale }] }]} />
            ))}
          </Animated.View>
        );
      case 'stars':
        return (
          <Animated.View style={[styles.starField, { opacity: fade, transform: [{ translateY: rise }] }]}>
            {Array.from({ length: 16 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.star,
                  {
                    left: `${(index * 37) % 94}%`,
                    top: `${(index * 53) % 82}%`,
                    width: 2 + (index % 3) * 2,
                    height: 2 + (index % 3) * 2,
                    backgroundColor: option.accent,
                  },
                ]}
              />
            ))}
          </Animated.View>
        );
      case 'grid':
        return (
          <Animated.View style={[styles.grid, { transform: [{ translateY: rise }] }]}>
            {Array.from({ length: 7 }, (_, index) => <View key={`h-${index}`} style={[styles.gridHorizontal, { top: 12 + index * 17, backgroundColor: option.accent }]} />)}
            {Array.from({ length: 7 }, (_, index) => <View key={`v-${index}`} style={[styles.gridVertical, { left: `${8 + index * 14}%`, backgroundColor: option.accent }]} />)}
          </Animated.View>
        );
      default:
        return (
          <>
            <Animated.View style={[styles.sunGlow, { backgroundColor: option.accent, opacity: fade, transform: [{ translateY: rise }, { scale: pulse }] }]} />
            <View style={[styles.horizon, { borderColor: option.accent }]} />
          </>
        );
    }
  })();

  return (
    <View pointerEvents="none" style={[styles.preview, { backgroundColor: isCustom ? '#090A08' : option.background }, style]}>
      {isCustom && customWallpaperUri ? (
        <Image source={{ uri: customWallpaperUri }} resizeMode="cover" style={styles.customImage} />
      ) : null}
      <View style={[styles.previewShade, { backgroundColor: isCustom ? '#000000' : option.shade }]} />
      {visual}
      {showQuote ? (
        <View style={styles.quoteWrap}>
          <Text style={[styles.quote, { color: isCustom ? '#FFFFFF' : option.accent }]} numberOfLines={1}>
            {isCustom ? 'MAKE IT COUNT' : option.quote.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  visible: boolean;
  selected: OverlayDesign;
  customWallpaperUri: string | null;
  onSelect: (design: OverlayDesign) => void;
  onImportCustom: () => void;
  onDismiss: () => void;
};

export function OverlayDesignSheet({ visible, selected, customWallpaperUri, onSelect, onImportCustom, onDismiss }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const themed = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={themed.fill}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close lock screen designs" style={themed.scrim} onPress={onDismiss} />
        <View style={[themed.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={themed.handle} />
          <View style={themed.header}>
            <View style={themed.headerCopy}>
              <Text style={themed.title}>Lock screen design</Text>
              <Text style={themed.subtitle}>Choose an animated design or import your image.</Text>
            </View>
            <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={onDismiss} style={themed.close} pressedStyle={themed.pressed}>
              <CloseIcon size={20} color={colors.labelSecondary} />
            </PressableScale>
          </View>
          <ScrollView style={themed.list} contentContainerStyle={themed.listContent} showsVerticalScrollIndicator={false}>
            {OVERLAY_DESIGNS.map((option) => {
              const active = selected === option.id;
              return (
                <PressableScale
                  key={option.id}
                  containerStyle={themed.fullWidth}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.name}, ${option.quote}`}
                  accessibilityState={{ checked: active }}
                  onPress={() => onSelect(option.id)}
                  style={[themed.option, active && themed.optionActive]}
                  pressedStyle={themed.pressed}
                >
                  <OverlayDesignPreview design={option.id} style={themed.optionPreview} />
                  <View style={themed.optionFooter}>
                    <View style={themed.optionCopy}>
                      <Text style={themed.optionName}>{option.name}</Text>
                      <Text style={themed.optionQuote}>{option.quote}</Text>
                    </View>
                    <View style={[themed.check, active && themed.checkActive]}>
                      {active ? <CheckIcon size={16} color={colors.onAccent} /> : null}
                    </View>
                  </View>
                </PressableScale>
              );
            })}
            <PressableScale
              containerStyle={themed.fullWidth}
              accessibilityRole={customWallpaperUri ? 'radio' : 'button'}
              accessibilityLabel={customWallpaperUri ? 'Custom wallpaper' : 'Import custom wallpaper'}
              accessibilityState={customWallpaperUri ? { checked: selected === 'custom' } : undefined}
              onPress={() => {
                if (customWallpaperUri && selected !== 'custom') onSelect('custom');
                else onImportCustom();
              }}
              style={[themed.option, selected === 'custom' && themed.optionActive]}
              pressedStyle={themed.pressed}
            >
              <OverlayDesignPreview
                design="custom"
                customWallpaperUri={customWallpaperUri}
                style={themed.optionPreview}
              />
              <View style={themed.optionFooter}>
                <View style={themed.optionCopy}>
                  <Text style={themed.optionName}>Custom wallpaper</Text>
                  <Text style={themed.optionQuote}>
                    {customWallpaperUri
                      ? selected === 'custom' ? 'Tap to replace' : 'Tap to use'
                      : 'Choose from device'}
                  </Text>
                </View>
                <View style={[themed.check, selected === 'custom' && themed.checkActive]}>
                  {selected === 'custom' ? <CheckIcon size={16} color={colors.onAccent} /> : null}
                </View>
              </View>
            </PressableScale>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 132, borderRadius: Radius.md, overflow: 'hidden' },
  customImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  previewShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%', opacity: 0.72 },
  quoteWrap: { position: 'absolute', left: 10, right: 10, bottom: 10, alignItems: 'center' },
  quote: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.1 },
  sunGlow: { position: 'absolute', width: 54, height: 54, borderRadius: 27, left: '50%', marginLeft: -27, top: 24 },
  horizon: { position: 'absolute', width: '78%', height: 72, borderRadius: 80, borderWidth: 1, left: '11%', top: 48, opacity: 0.58 },
  orbit: { position: 'absolute', width: 104, height: 62, borderRadius: 52, borderWidth: 2, left: '50%', top: 28, marginLeft: -52 },
  orbitInner: { position: 'absolute', width: 56, height: 96, borderRadius: 48, borderWidth: 1, left: 23, top: -18, opacity: 0.7 },
  orbitDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, right: -6, top: 25 },
  waveGroup: { position: 'absolute', width: '120%', height: 118, left: '-10%', top: 2 },
  wave: { position: 'absolute', width: '100%', height: 32, borderRadius: 50, borderWidth: 3, transform: [{ rotate: '-4deg' }] },
  bloom: { position: 'absolute', width: 98, height: 98, left: '50%', top: 12, marginLeft: -49, alignItems: 'center', justifyContent: 'center' },
  bloomRing: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 2 },
  starField: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  star: { position: 'absolute', borderRadius: 4 },
  grid: { position: 'absolute', left: 0, right: 0, top: 16, height: 116, opacity: 0.48, transform: [{ perspective: 180 }, { rotateX: '52deg' }] },
  gridHorizontal: { position: 'absolute', left: 0, right: 0, height: 1 },
  gridVertical: { position: 'absolute', top: 0, bottom: 0, width: 1 },
});

const makeStyles = (colors: Palette) => StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: { height: '92%', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surfaceElevated },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: colors.labelTertiary, opacity: 0.55 },
  header: { marginTop: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  headerCopy: { flex: 1 },
  title: { ...Type.title, color: colors.label },
  subtitle: { ...Type.footnote, color: colors.labelSecondary, marginTop: 3 },
  close: { width: 44, minHeight: 44, borderRadius: Radius.pill, alignItems: 'center', backgroundColor: colors.surfacePressed },
  list: { flex: 1, marginTop: Spacing.lg },
  listContent: { gap: Spacing.md, paddingBottom: Spacing.lg },
  option: { padding: Spacing.sm, borderRadius: Radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent', alignItems: 'stretch' },
  optionActive: { borderColor: colors.accent },
  optionPreview: { height: 148 },
  optionFooter: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm },
  optionCopy: { flex: 1 },
  optionName: { ...Type.bodyStrong, color: colors.label },
  optionQuote: { ...Type.footnote, color: colors.labelSecondary, marginTop: 2 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.separator, alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.82 },
});
