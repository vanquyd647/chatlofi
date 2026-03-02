import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

/**
 * Reusable EmptyState component for screens with no data
 * 
 * @param {string} icon - Ionicons icon name
 * @param {string} title - Main message
 * @param {string} subtitle - Secondary message
 * @param {string} buttonText - CTA button text (optional)
 * @param {function} onButtonPress - CTA button handler (optional)
 * @param {number} iconSize - Icon size (default 72)
 * @param {string} iconColor - Icon color
 */
const EmptyState = ({
  icon = 'file-tray-outline',
  title = 'Không có dữ liệu',
  subtitle,
  buttonText,
  onButtonPress,
  iconSize = 72,
  iconColor = Colors.disabled,
}) => {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={iconSize} color={iconColor} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {buttonText && onButtonPress && (
        <TouchableOpacity style={styles.button} onPress={onButtonPress} activeOpacity={0.7}>
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  buttonText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EmptyState;
