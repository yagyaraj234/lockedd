import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Colors } from '../colors';
import { getSettings, addTemporaryAllow } from '../store/storage';

const TEMPORARY_DURATION = 5 * 60 * 1000; // 5 minutes
const UPDATE_INTERVAL = 1000; // 1 second

export const BreathingOverlay = (props: any) => {
  const packageName = props.packageName || '';
  const [timeLeft, setTimeLeft] = useState(TEMPORARY_DURATION);
  const [breathe, setbreathe] = useState<'EXHALE' | 'INHALE'>('EXHALE');
  const scale = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          finishBlocking();
          return 0;
        }
        return prev - 1000;
      });

      // Animate breathing
      if (Math.random() > 0.5) {
        setbreathe('INHALE');
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.2,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        setbreathe('EXHALE');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const finishBlocking = () => {
    // Close the blocking overlay after timeout
    if (props.onComplete) {
      props.onComplete();
    }
  };

  const ignoreForNow = () => {
    const settings = getSettings();
    if (settings.unlockMode === 'temporary') {
      // Allow app for 1 minute before re-blocking
      addTemporaryAllow(packageName, 60 * 1000);
    }
    if (props.onComplete) {
      props.onComplete();
    }
  };

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.gradient}>
        <Text style={styles.subtitle}>Time to pause</Text>
        <Text style={styles.caption}>
          This app is temporarily paused to help you find balance.
        </Text>

        <View style={styles.breathingContainer}>
          <Animated.Text
            style={[
              styles.breathText,
              { transform: [{ scale }] },
            ]}
          >
            {breathe}
          </Animated.Text>
        </View>

        <Text style={styles.timer}>{timeDisplay}</Text>
        <Text style={styles.timerCaption}>REMAINING BALANCE</Text>

        <TouchableOpacity style={styles.ignoreButton} onPress={ignoreForNow}>
          <Text style={styles.ignoreButtonText}>Ignore for 1 minute</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  caption: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 20,
  },
  breathingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
  },
  breathText: {
    fontSize: 56,
    fontWeight: '300',
    color: Colors.blue,
    letterSpacing: 2,
  },
  timer: {
    fontSize: 72,
    fontWeight: '300',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timerCaption: {
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 80,
    textAlign: 'center',
  },
  ignoreButton: {
    backgroundColor: Colors.bgSecondary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 20,
  },
  ignoreButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
