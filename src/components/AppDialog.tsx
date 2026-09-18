import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../colors';
import { Radius, Spacing, Type } from '../colors';
import { useAccessibilityPreferences } from '../hooks/useAccessibilityPreferences';
import { useTheme } from '../theme';
import { PressableScale } from './PressableScale';

type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type DialogState = {
  title: string;
  message?: string;
  buttons: DialogButton[];
};

let presentDialog: ((dialog: DialogState) => void) | null = null;

export const AppDialog = {
  alert(title: string, message?: string, buttons?: DialogButton[]) {
    presentDialog?.({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    });
  },
};

export function AppDialogHost() {
  const { colors } = useTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    presentDialog = setDialog;
    return () => {
      presentDialog = null;
    };
  }, []);

  const close = (button?: DialogButton) => {
    setDialog(null);
    button?.onPress?.();
  };

  return (
    <Modal
      visible={dialog != null}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(dialog?.buttons.find((button) => button.style === 'cancel'))}
    >
      <View style={styles.fill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          style={styles.scrim}
          onPress={() => close()}
        />
        {dialog ? (
          <View accessibilityRole="alert" accessibilityViewIsModal style={styles.card}>
            <Text style={styles.title}>{dialog.title}</Text>
            {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
            <View style={styles.actions}>
              {dialog.buttons.map((button, index) => {
                const destructive = button.style === 'destructive';
                const secondary = button.style === 'cancel';
                return (
                  <PressableScale
                    key={`${button.text}-${index}`}
                    accessibilityRole="button"
                    onPress={() => close(button)}
                    style={[
                      styles.button,
                      secondary && styles.secondaryButton,
                      destructive && styles.destructiveButton,
                    ]}
                    pressedStyle={styles.pressed}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        secondary && styles.secondaryText,
                        destructive && styles.destructiveText,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fill: {
      flex: 1,
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    scrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.scrim,
    },
    card: {
      width: '100%',
      maxWidth: 440,
      maxHeight: '82%',
      alignSelf: 'center',
      padding: Spacing.xl,
      borderRadius: 28,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
    },
    title: {
      ...Type.title,
      color: colors.label,
    },
    message: {
      ...Type.body,
      color: colors.labelSecondary,
      marginTop: Spacing.md,
    },
    actions: {
      marginTop: Spacing.xl,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    button: {
      minWidth: 96,
      minHeight: 48,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.pill,
      alignItems: 'center',
      backgroundColor: colors.accent,
    },
    secondaryButton: {
      backgroundColor: colors.surfacePressed,
    },
    destructiveButton: {
      backgroundColor: colors.dangerMuted,
    },
    buttonText: {
      ...Type.footnoteStrong,
      color: colors.onAccent,
    },
    secondaryText: {
      color: colors.label,
    },
    destructiveText: {
      color: colors.danger,
    },
    pressed: {
      opacity: 0.76,
    },
  });
