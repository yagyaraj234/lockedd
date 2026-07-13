import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const useAccessibilityPreferences = () => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const transparency = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    );
    return () => {
      motion.remove();
      transparency.remove();
    };
  }, []);

  return { reduceMotion, reduceTransparency };
};
