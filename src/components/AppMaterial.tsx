import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';

type TargetRef = React.RefObject<View | null>;
type MaterialContextValue = {
  target?: TargetRef;
  setTarget: (target?: TargetRef) => void;
};

const MaterialContext = createContext<MaterialContextValue>({ setTarget: () => {} });

export const AppMaterial = ({ children }: { children: React.ReactNode }) => {
  const [target, setTarget] = useState<TargetRef>();
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <MaterialContext.Provider value={value}>{children}</MaterialContext.Provider>;
};

export const MaterialScreen = ({ children }: { children: React.ReactNode }) => {
  const target = useRef<View>(null);
  const { setTarget } = useContext(MaterialContext);
  // Android 16's hardware renderer can tile BlurTargetView content incorrectly.
  // Keep the solid material fallback there until the native blur path is stable.
  const supportsBlurTarget = Platform.OS !== 'android' || Number(Platform.Version) < 36;
  useFocusEffect(useCallback(() => {
    setTarget(supportsBlurTarget ? target : undefined);
    return () => setTarget(undefined);
  }, [setTarget, supportsBlurTarget]));

  if (!supportsBlurTarget) return <View style={{ flex: 1 }}>{children}</View>;
  return <BlurTargetView ref={target} style={{ flex: 1 }}>{children}</BlurTargetView>;
};

export const useBlurTarget = () => useContext(MaterialContext).target;
