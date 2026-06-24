import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../theme';
import type { Palette } from '../colors';

interface Duration {
  label: string;
  value: number | 'permanent';
  hours?: number;
}

interface BlockDurationModalProps {
  visible: boolean;
  appName: string;
  onSelect: (durationMs: number | 'permanent') => void;
  onCancel: () => void;
}

const durations: Duration[] = [
  { label: '1 hour', value: 1 * 60 * 60 * 1000, hours: 1 },
  { label: '10 hours', value: 10 * 60 * 60 * 1000, hours: 10 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000, hours: 24 },
];

export const BlockDurationModal = ({
  visible,
  appName,
  onSelect,
  onCancel,
}: BlockDurationModalProps) => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [selectedValue, setSelectedValue] = useState<number | 'permanent' | null>(null);

  const handleSelect = (value: number | 'permanent') => {
    setSelectedValue(value);
    onSelect(value);
    setSelectedValue(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Block Duration</Text>
          <Text style={styles.subtitle}>
            How long should {appName} be blocked?
          </Text>

          <View style={styles.optionsContainer}>
            {durations.map((duration) => (
              <TouchableOpacity
                key={String(duration.value)}
                style={[
                  styles.option,
                  selectedValue === duration.value && styles.optionSelected,
                ]}
                onPress={() => handleSelect(duration.value)}
              >
                <View style={styles.optionContent}>
                  <View
                    style={[
                      styles.radioButton,
                      selectedValue === duration.value &&
                        styles.radioButtonSelected,
                    ]}
                  >
                    {selectedValue === duration.value && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <Text style={styles.optionLabel}>{duration.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (Colors: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 2,
    borderColor: Colors.bgSecondary,
  },
  optionSelected: {
    backgroundColor: Colors.bg,
    borderColor: Colors.accent,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: Colors.accent,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  optionLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
