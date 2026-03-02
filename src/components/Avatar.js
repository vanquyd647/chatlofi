import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme';

/**
 * Reusable Avatar component with fallback initials
 * 
 * @param {string} uri - Image URI
 * @param {string} name - User name (for fallback initials)
 * @param {'small'|'medium'|'large'} size - Avatar size preset
 * @param {boolean} bordered - Show border around avatar
 * @param {string} borderColor - Custom border color
 * @param {object} style - Additional styles
 */
const Avatar = ({ uri, name = '', size = 'medium', bordered = true, borderColor, style }) => {
  const dimensions = SIZE_MAP[size];
  const initials = getInitials(name);

  const avatarStyle = [
    styles.base,
    {
      width: dimensions.size,
      height: dimensions.size,
      borderRadius: dimensions.size / 2,
    },
    bordered && {
      borderWidth: 2,
      borderColor: borderColor || Colors.primary,
    },
    style,
  ];

  if (uri) {
    return <Image source={{ uri }} style={avatarStyle} />;
  }

  return (
    <View style={[avatarStyle, styles.placeholder]}>
      <Text style={[styles.initials, { fontSize: dimensions.fontSize }]}>
        {initials}
      </Text>
    </View>
  );
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] || '?').toUpperCase();
};

const SIZE_MAP = {
  small: { size: 40, fontSize: 14 },
  medium: { size: 55, fontSize: 18 },
  large: { size: 75, fontSize: 24 },
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default Avatar;
