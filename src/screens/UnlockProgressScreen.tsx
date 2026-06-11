import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../colors';
import Svg, { Circle } from 'react-native-svg';

// StepCounter module stub
const StepCounter = {
  startListening() {},
  stopListening() {},
  async getTodaySteps() { return 0; },
  async getStepGoal() { return 10000; },
  async setStepGoal(goal: number) { return true; },
};

const CIRCLE_RADIUS = 80;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export const UnlockProgressScreen = ({ navigation }: any) => {
  const [steps, setSteps] = useState(0);
  const [goal, setGoal] = useState(10000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    StepCounter.startListening();
    return () => {
      clearInterval(interval);
      StepCounter.stopListening();
    };
  }, []);

  const loadData = async () => {
    try {
      const todaySteps = await StepCounter.getTodaySteps();
      const stepGoal = await StepCounter.getStepGoal();
      setSteps(todaySteps);
      setGoal(stepGoal);
    } catch (e) {
      console.error('Failed to load step data:', e);
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.min(steps / goal, 1);
  const percentage = Math.round(progress * 100);
  const offset = CIRCLE_CIRCUMFERENCE - progress * CIRCLE_CIRCUMFERENCE;

  const remaining = Math.max(0, goal - steps);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Unlock Progress</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.appLabel}>INSTAGRAM BLOCKED</Text>

          <View style={styles.progressContainer}>
            <Svg height={280} width={280} viewBox="0 0 280 280">
              <Circle
                cx="140"
                cy="140"
                r={CIRCLE_RADIUS}
                stroke={Colors.bgSecondary}
                strokeWidth="8"
                fill="none"
              />
              <Circle
                cx="140"
                cy="140"
                r={CIRCLE_RADIUS}
                stroke={Colors.accent}
                strokeWidth="8"
                fill="none"
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={offset}
                strokeLinecap="round"
                rotation="-90"
                origin="140, 140"
              />
            </Svg>
            <View style={styles.centerText}>
              <Text style={styles.stepsCount}>{steps.toLocaleString()}</Text>
              <Text style={styles.stepsLabel}>STEPS TAKEN</Text>
            </View>
          </View>

          <View style={styles.progressBadge}>
            <Text style={styles.progressPercentage}>{percentage}% COMPLETE</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Keep moving</Text>
            <Text style={styles.cardValue}>
              {remaining.toLocaleString()} steps remaining to unlock {goal.toLocaleString()} permanently for today.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Health Sync</Text>
            <Text style={styles.cardValue}>Last synced 2 minutes ago from Apple Health.</Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {/* Navigate to settings */}}
          >
            <Text style={styles.settingsButtonText}>Customize Step Goal</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
  },
  close: {
    fontSize: 24,
    color: Colors.text,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  spacer: {
    width: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  appLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  progressContainer: {
    height: 280,
    width: 280,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
  },
  stepsCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.text,
  },
  stepsLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: 4,
  },
  progressBadge: {
    backgroundColor: Colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 32,
  },
  progressPercentage: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.bg,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  settingsButton: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 16,
  },
  settingsButtonText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
