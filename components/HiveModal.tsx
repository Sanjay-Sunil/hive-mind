import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { CyberTheme as T } from '../constants/CyberTheme';

export type HiveModalButton = {
  text: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress?: () => void;
};

type HiveModalProps = {
  visible: boolean;
  title: string;
  message: string;
  buttons?: HiveModalButton[];
  variant?: 'info' | 'danger' | 'success';
  onDismiss?: () => void;
};

export default function HiveModal({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  variant = 'info',
  onDismiss,
}: HiveModalProps) {
  const accentColor =
    variant === 'danger'
      ? T.colors.danger
      : variant === 'success'
      ? T.colors.success
      : T.colors.accent;

  const accentSoft =
    variant === 'danger'
      ? 'rgba(239, 68, 68, 0.12)'
      : variant === 'success'
      ? 'rgba(16, 185, 129, 0.12)'
      : T.colors.accentSoft;

  const handlePress = (btn: HiveModalButton) => {
    btn.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* ── Brand header ── */}
          <View style={styles.brandRow}>
            <View style={styles.logoContainer}>
              <View style={[styles.logoDot, { backgroundColor: accentColor }]} />
              <View
                style={[
                  styles.logoDot,
                  {
                    backgroundColor:
                      variant === 'danger'
                        ? '#F87171'
                        : variant === 'success'
                        ? '#34D399'
                        : T.colors.accentLight,
                  },
                ]}
              />
            </View>
            <Text style={styles.brandText}>HIVE</Text>
          </View>

          {/* ── Accent divider ── */}
          <View style={[styles.divider, { backgroundColor: accentColor }]} />

          {/* ── Title ── */}
          <Text style={[styles.title, { color: accentColor }]}>{title}</Text>

          {/* ── Message ── */}
          <Text style={styles.message}>{message}</Text>

          {/* ── Action buttons ── */}
          <View style={styles.buttonRow}>
            {buttons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';

              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.75}
                  onPress={() => handlePress(btn)}
                  style={[
                    styles.button,
                    isCancel && styles.cancelButton,
                    isDestructive && styles.destructiveButton,
                    !isCancel && !isDestructive && [styles.primaryButton, { backgroundColor: accentColor }],
                    buttons.length === 1 && { flex: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.cancelButtonText,
                      isDestructive && styles.destructiveButtonText,
                      !isCancel && !isDestructive && styles.primaryButtonText,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: T.colors.card,
    borderRadius: T.radius.lg,
    borderWidth: 1,
    borderColor: T.colors.border,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },

  /* Brand */
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    color: T.colors.mutedText,
    letterSpacing: 4,
  },

  /* Divider */
  divider: {
    height: 2,
    borderRadius: 1,
    opacity: 0.35,
    marginBottom: 18,
  },

  /* Content */
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: T.colors.secondaryText,
    marginBottom: 24,
  },

  /* Buttons */
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: T.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: T.colors.cardElevated,
    borderWidth: 1,
    borderColor: T.colors.borderLight,
  },
  cancelButtonText: {
    color: T.colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  destructiveButtonText: {
    color: T.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {},
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
