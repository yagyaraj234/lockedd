import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../colors';
import { updateSettings } from '../../store/storage';

export const OnboardingScreen1 = ({ navigation }: any) => {
  const goNext = () => navigation.navigate('Onboarding2');
  // Flipping onboardingComplete swaps the navigator to the main app (tabs); a
  // direct navigate('Home') would fail because Home isn't registered yet.
  const skip = () => updateSettings({ onboardingComplete: true });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.number}>01</Text>
        <Text style={styles.title}>Reclaim your</Text>
        <Text style={styles.titleAccent}>Focus</Text>
        <Text style={styles.body}>
          A purposeful space designed to help you break digital habits, one step at a time.
        </Text>
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.dot, i === 0 && styles.dotActive]}
            />
          ))}
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cta} onPress={goNext}>
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={skip}>
          <Text style={styles.skip}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: 40,
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
