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

interface LockDuration {
  label: string;
  description: string;
  value: number;
}

interface LockDurationModalProps {
  visible: boolean;
  onSelect: (durationMs: number) => void;
  onCancel: () => void;
}

const lockDurations: LockDuration[] = [
  { label: '12 hours', description: 'Minimum lock period', value: 12 * 60 * 60 * 1000 },
  { label: '1 day', description: '24-hour lock', value: 24 * 60 * 60 * 1000 },
  { label: '7 days', description: 'One week', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '28 days', description: 'Four weeks', value: 28 * 24 * 60 * 60 * 1000 },
];

export const LockDurationModal = ({
  visible,
  onSelect,
  onCancel,
}: LockDurationModalProps) => {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);

  const handleSelect = (value: number) => {
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
          <Text style={styles.title}>Lock Duration</Text>
          <Text style={styles.subtitle}>
            How long before you can remove this permanent block?
          </Text>

          <View style={styles.optionsContainer}>
            {lockDurations.map((duration) => (
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
                      selectedValue === duration.value && styles.radioButtonSelected,
                    ]}
                  >
                    {selectedValue === duration.value && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View style={styles.labelContainer}>
                    <Text style={styles.optionLabel}>{duration.label}</Text>
                    <Text style={styles.optionDesc}>{duration.description}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
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
    paddingVertical: 14,
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
  labelContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cancelButton: {
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
