import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { Palette } from '../../colors';
import { updateSettings } from '../../store/storage';

export const OnboardingScreen3 = ({ navigation }: any) => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.number}>03</Text>
        <Text style={styles.title}>Two ways to</Text>
        <Text style={styles.titleAccent}>Unlock</Text>

        <View style={styles.modeCard}>
          <Text style={styles.modeNumber}>5m</Text>
          <View>
            <Text style={styles.modeName}>Temporary Mode</Text>
            <Text style={styles.modeDesc}>
              A 5-minute breathing delay before access.
            </Text>
          </View>
        </View>

        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.dot, i === 2 && styles.dotActive]}
            />
          ))}
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('Onboarding4')}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => updateSettings({ onboardingComplete: true })}>
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
    marginBottom: 40,
  },
  modeCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 40,
  },
  modeNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  modeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
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
