import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import type { Palette } from '../colors';

const ErrorSVG = ({ c }: { c: Palette }) => (
  <Svg width={100} height={100} viewBox="0 0 100 100" fill="none">
    {/* Warning triangle */}
    <Path
      d="M50 16 L88 82 L12 82 Z"
      fill={c.dangerSoft}
      stroke={c.danger}
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Exclamation line */}
    <Line x1="50" y1="40" x2="50" y2="63" stroke={c.danger} strokeWidth="3" strokeLinecap="round" />
    {/* Exclamation dot */}
    <Circle cx="50" cy="72" r="3" fill={c.danger} />
  </Svg>
);

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState = ({
  message = 'Something went wrong',
  onRetry,
}: ErrorStateProps) => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <View style={styles.container}>
      <View style={styles.illustrationWrap}>
        <ErrorSVG c={Colors} />
      </View>
      <Text style={styles.title}>Oops</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illustrationWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  retryText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
