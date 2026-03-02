import React from 'react';
import { View, TextInput as RNTextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../theme';

/**
 * Reusable TextInput component with consistent styling
 * 
 * @param {object} props - Standard TextInput props
 * @param {boolean} isPassword - Show password toggle
 * @param {boolean} showPassword - Current visibility state
 * @param {function} onTogglePassword - Toggle password visibility
 * @param {object} containerStyle - Additional container styles
 * @param {object} inputStyle - Additional input styles
 */
const AppTextInput = ({
  isPassword = false,
  showPassword = false,
  onTogglePassword,
  containerStyle,
  inputStyle,
  ...props
}) => {
  if (isPassword) {
    return (
      <View style={[styles.container, styles.passwordContainer, containerStyle]}>
        <RNTextInput
          style={[styles.input, styles.passwordInput, inputStyle]}
          placeholderTextColor={Colors.textPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showPassword}
          {...props}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={onTogglePassword}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={showPassword ? 'visibility' : 'visibility-off'}
            size={22}
            color={Colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RNTextInput
      style={[styles.container, styles.input, containerStyle, inputStyle]}
      placeholderTextColor={Colors.textPlaceholder}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.inputBackground,
    height: 50,
    marginBottom: 16,
    borderRadius: Radius.md,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
  },
  passwordToggle: {
    paddingHorizontal: 12,
  },
});

export default AppTextInput;
