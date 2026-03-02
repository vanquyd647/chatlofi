/**
 * Design Tokens & Theme Configuration
 * Centralized styling constants for consistent UI across the app
 */

export const Colors = {
  // Brand
  primary: '#006AF5',
  primaryLight: '#e7f3ff',
  primaryDark: '#0052CC',

  // Backgrounds
  background: '#f5f5f5',
  surface: '#ffffff',
  inputBackground: '#F6F7FB',
  pinnedBackground: '#f0f8ff',
  headerOverlay: 'rgba(255,255,255,0.2)',

  // Text
  textPrimary: '#000000',
  textSecondary: '#666666',
  textTertiary: '#888888',
  textPlaceholder: '#999999',
  textWhite: '#FFFFFF',
  textLink: '#006AF5',

  // Borders & Dividers
  divider: '#f0f0f0',
  sectionSeparator: '#f5f5f5',
  border: '#E5E5E5',
  borderLight: '#EEEEEE',

  // Status
  danger: '#F44336',
  dangerLight: '#FFEBEE',
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  info: '#2196F3',
  infoLight: '#E3F2FD',

  // Notification
  badge: '#FF3B30',
  unreadBg: '#f0f7ff',

  // Misc
  skeleton: '#E0E0E0',
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#CCCCCC',
  disabledText: '#999999',
};

export const Typography = {
  // Headings
  h1: { fontSize: 36, fontWeight: 'bold' },
  h2: { fontSize: 24, fontWeight: 'bold' },
  h3: { fontSize: 20, fontWeight: 'bold' },

  // Body
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyBold: { fontSize: 16, fontWeight: '600' },
  caption: { fontSize: 14, fontWeight: '400' },
  captionBold: { fontSize: 14, fontWeight: '600' },
  small: { fontSize: 12, fontWeight: '400' },
  smallBold: { fontSize: 12, fontWeight: '600' },

  // Special
  button: { fontSize: 16, fontWeight: '600' },
  buttonLarge: { fontSize: 18, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  tabLabel: { fontSize: 15, fontWeight: '600' },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const Shadows = {
  small: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  medium: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  large: {
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
};

// Common component styles
export const CommonStyles = {
  // Header bar (blue bar at top of screens)
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    ...Shadows.medium,
  },
  // Legacy header bar (flat, used on some screens)
  headerBarFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  // Search input inside header
  headerSearchInput: {
    flex: 1,
    backgroundColor: Colors.headerOverlay,
    borderRadius: Radius.xl,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  headerSearchText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    fontSize: 15,
  },
  // Standard text input
  textInput: {
    backgroundColor: Colors.inputBackground,
    height: 50,
    marginBottom: 16,
    fontSize: 16,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
  },
  // Primary button
  primaryButton: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontWeight: 'bold',
    color: Colors.textWhite,
    fontSize: 16,
  },
  // Outline button
  outlineButton: {
    backgroundColor: Colors.surface,
    height: 50,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  outlineButtonText: {
    fontWeight: 'bold',
    color: Colors.primary,
    fontSize: 16,
  },
  // Danger button
  dangerButton: {
    backgroundColor: Colors.dangerLight,
    height: 50,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  dangerButtonText: {
    fontWeight: '600',
    color: Colors.danger,
    fontSize: 16,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: Radius.lg,
    width: '85%',
    alignItems: 'center',
    ...Shadows.large,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 16,
  },
  // Divider
  divider: {
    backgroundColor: Colors.divider,
    height: 1,
    width: '100%',
  },
  sectionDivider: {
    backgroundColor: Colors.sectionSeparator,
    height: 8,
    width: '100%',
  },
  // Avatar
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarMedium: {
    width: 55,
    height: 55,
    borderRadius: 28,
  },
  avatarLarge: {
    width: 75,
    height: 75,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
};
