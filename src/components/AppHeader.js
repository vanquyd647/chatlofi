import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme';

/**
 * Reusable header bar component for consistent look across all screens
 * 
 * @param {string} title - Header title text
 * @param {function} onBack - Back button handler (if omitted, no back button)
 * @param {React.ReactNode} rightContent - Optional right side content (icons, buttons)
 * @param {React.ReactNode} children - Optional children to replace title (e.g. search input)
 * @param {boolean} flat - If true, no shadow/elevation
 */
const AppHeader = ({ title, onBack, rightContent, children, flat = false }) => {
  return (
    <View style={[styles.container, !flat && Shadows.medium]}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <AntDesign name="arrowleft" size={22} color="white" />
        </TouchableOpacity>
      )}
      {children ? (
        children
      ) : (
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      )}
      {rightContent && (
        <View style={styles.rightContent}>
          {rightContent}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    minHeight: 48,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

export default AppHeader;
