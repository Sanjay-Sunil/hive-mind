import React, { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';
import { createSpace } from '../src/database/database';

export default function CreateSpace() {
  const router = useRouter();
  const [spaceName, setSpaceName] = useState('');
  const [saving, setSaving] = useState(false);
  const isValid = spaceName.trim().length > 0;

  const handleStart = async () => {
    if (!isValid || saving) return;

    try {
      setSaving(true);
      const spaceId = await createSpace(spaceName.trim());
      console.log('Created space with id:', spaceId);

      // Navigate to add-files, passing the real spaceId from DB
      router.push({
        pathname: '/add-files',
        params: { spaceId: spaceId.toString(), spaceName: spaceName.trim() },
      });
    } catch (e) {
      console.error('Failed to create space:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoDot} />
          <View style={[styles.logoDot, { backgroundColor: T.colors.accentLight }]} />
        </View>
        <Text style={styles.brand}>HIVE</Text>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.inputCard}>
          <Text style={styles.label}>Name Your Space</Text>
          <Text style={styles.hint}>
            Choose a meaningful name that describes your knowledge domain.
          </Text>

          <TextInput
            style={[styles.input, isValid && styles.inputActive]}
            placeholder="e.g. medical protocols..."
            placeholderTextColor={T.colors.mutedText}
            value={spaceName}
            onChangeText={setSpaceName}
            autoFocus
            selectionColor={T.colors.accent}
            editable={!saving}
          />

          {isValid && (
            <View style={styles.validBadge}>
              <Text style={styles.validBadgeText}>✓ Looks good!</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          activeOpacity={0.8}
          onPress={handleStart}
          disabled={!isValid || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
                Let's get started
              </Text>
              <Text style={[styles.buttonArrow, !isValid && styles.buttonTextDisabled]}>
                →
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.colors.background,
    paddingHorizontal: T.spacing.lg,
    paddingTop: 56,
  },
  backBtn: {
    paddingVertical: T.spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: T.spacing.md,
  },
  backText: {
    color: T.colors.accentLight,
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: T.spacing.xxl,
  },
  logoContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: T.spacing.sm,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: T.radius.full,
    backgroundColor: T.colors.accent,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: T.colors.primaryText,
    letterSpacing: 6,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: T.spacing.xl,
  },
  inputCard: {
    backgroundColor: T.colors.card,
    borderRadius: T.radius.lg,
    borderWidth: 1,
    borderColor: T.colors.border,
    padding: T.spacing.lg,
  },
  label: {
    fontSize: 22,
    fontWeight: '700',
    color: T.colors.primaryText,
    marginBottom: T.spacing.sm,
  },
  hint: {
    fontSize: 14,
    color: T.colors.secondaryText,
    lineHeight: 20,
    marginBottom: T.spacing.lg,
  },
  input: {
    backgroundColor: T.colors.cardElevated,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.colors.border,
    color: T.colors.primaryText,
    padding: T.spacing.md,
    fontSize: 16,
  },
  inputActive: {
    borderColor: T.colors.borderAccent,
  },
  validBadge: {
    marginTop: T.spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: T.radius.full,
  },
  validBadgeText: {
    color: T.colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  bottom: {
    paddingBottom: T.spacing.xxl,
    paddingTop: T.spacing.md,
  },
  button: {
    backgroundColor: T.colors.accent,
    borderRadius: T.radius.md,
    paddingVertical: 16,
    paddingHorizontal: T.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: T.colors.card,
    borderWidth: 1,
    borderColor: T.colors.border,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextDisabled: {
    color: T.colors.mutedText,
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
