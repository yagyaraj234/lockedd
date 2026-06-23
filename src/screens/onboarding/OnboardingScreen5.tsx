import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { Palette, ThemeName } from '../../colors';
import { updateSettings } from '../../store/storage';

export const OnboardingScreen5 = ({ navigation }: any) => {
  const { colors: Colors, name: themeName, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const startApp = () => {
    // Flipping onboardingComplete swaps the navigator to the main app stack
    // (see AppNavigator's settings subscription); no explicit navigate needed —
    // and navigate('Home') would fail here because Home isn't registered yet.
    updateSettings({ onboardingComplete: true });
  };

  const THEMES: { key: ThemeName; label: string }[] = [
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.number}>05</Text>
        <Text style={styles.title}>Ready to</Text>
        <Text style={styles.titleAccent}>Start?</Text>
        <Text style={styles.body}>
          Your focus starts now. Choose your first app to block on the next screen.
        </Text>

        <Text style={styles.themeLabel}>APPEARANCE</Text>
        <View style={styles.themeToggle}>
          {THEMES.map((t) => {
            const active = themeName === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.themeOption, active && styles.themeOptionActive]}
                onPress={() => setTheme(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.dot, i === 4 && styles.dotActive]}
            />
          ))}
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cta} onPress={startApp}>
          <Text style={styles.ctaText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => startApp()}>
          <Text style={styles.skip}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  number: {
    fontSize: 80,
    fontWeight: 'bold',
    color: Colors.accent,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  titleAccent: {
    fontSize: 32,
    fontWeight: '300',
    fontStyle: 'italic',
    color: Colors.accent,
    marginBottom: 24,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 32,
  },
  themeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 40,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  themeOptionActive: {
    backgroundColor: Colors.accent,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  themeOptionTextActive: {
    color: Colors.bg,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },
  dotActive: {
    backgroundColor: Colors.accent,
  },
  buttonContainer: {
    gap: 16,
  },
  cta: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
  },
  ctaText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  skip: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
