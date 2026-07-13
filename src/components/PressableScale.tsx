import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Motion } from '../colors';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';

type Props = Omit<PressableProps, 'style'> & {
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
};

const useNativeAnimationDriver = Platform.OS !== 'android' || Number(Platform.Version) < 36;

export const PressableScale = ({
  children,
  containerStyle,
  style,
  pressedStyle,
  disabled,
  onPressIn,
  onPressOut,
  hitSlop = 6,
  ...props
}: Props) => {
  const scale = useRef(new Animated.Value(1)).current;
  const [transformActive, setTransformActive] = useState(false);
  const { reduceMotion } = useAccessibilityPreferences();

  return (
    <Animated.View style={[containerStyle, transformActive ? { transform: [{ scale }] } : null]}>
      <Pressable
        {...props}
        disabled={disabled}
        hitSlop={hitSlop}
        onPressIn={(event) => {
          if (!reduceMotion) {
            setTransformActive(true);
            Animated.timing(scale, {
              toValue: 0.98,
              duration: 70,
              useNativeDriver: useNativeAnimationDriver,
            }).start();
          }
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          if (!reduceMotion) {
            Animated.spring(scale, {
              toValue: 1,
              ...Motion.spring,
              useNativeDriver: useNativeAnimationDriver,
            }).start(({ finished }) => finished && setTransformActive(false));
          }
          onPressOut?.(event);
        }}
        style={({ pressed }) => [
          { minHeight: 48, justifyContent: 'center' },
          style,
          pressed && pressedStyle,
          disabled && { opacity: 0.42 },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};
