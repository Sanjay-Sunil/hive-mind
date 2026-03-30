import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { CyberTheme as T } from '../constants/CyberTheme';

export default function AddFiles() {
  const router = useRouter();
  const { spaceName } = useLocalSearchParams();
  const [files, setFiles] = useState<{ name: string; uri: string }[]>([]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: false,
      });

      if (!result.canceled && result.assets) {
        setFiles([
          ...files,
          ...result.assets.map((a) => ({ name: a.name, uri: a.uri })),
        ]);
      }
    } catch (err) {
      console.warn('Failed to pick document', err);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleFinish = () => {
    router.push({
      pathname: '/processing',
      params: {
        spaceName,
        files: JSON.stringify(files.map((f) => f.name)),
      },
    });
  };

  return (
    <View style={styles.container}>
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

      {/* Space name badge */}
      <View style={styles.spaceBadge}>
        <Text style={styles.spaceBadgeText}>📂 {spaceName}</Text>
      </View>

      {/* Add file button */}
      <TouchableOpacity
        style={styles.addButton}
        activeOpacity={0.7}
        onPress={pickDocument}
      >
        <View style={styles.addIconCircle}>
          <Text style={styles.addIcon}>＋</Text>
        </View>
        <View>
          <Text style={styles.addButtonTitle}>Add PDF File</Text>
          <Text style={styles.addButtonSub}>
            Tap to browse your device
          </Text>
        </View>
      </TouchableOpacity>

      {/* File list */}
      <View style={styles.fileSection}>
        <View style={styles.fileSectionHeader}>
          <Text style={styles.fileSectionTitle}>Selected Files</Text>
          <Text style={styles.fileCount}>{files.length}</Text>
        </View>

        <ScrollView
          style={styles.fileList}
          showsVerticalScrollIndicator={false}
        >
          {files.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyText}>No files selected yet</Text>
              <Text style={styles.emptyHint}>
                Tap the button above to pick PDF documents
              </Text>
            </View>
          )}

          {files.map((file, index) => (
            <View key={index.toString()} style={styles.fileRow}>
              <View style={styles.fileIconWrap}>
                <Text style={styles.fileIcon}>📄</Text>
              </View>
              <Text
                style={styles.fileName}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {file.name}
              </Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFile(index)}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* CTA */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.finishButton}
          activeOpacity={0.8}
          onPress={handleFinish}
        >
          <Text style={styles.finishText}>Let's finish processing</Text>
          <Text style={styles.finishArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    marginBottom: T.spacing.lg,
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
  spaceBadge: {
    alignSelf: 'center',
    backgroundColor: T.colors.accentSoft,
    borderRadius: T.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: T.spacing.lg,
  },
  spaceBadgeText: {
    color: T.colors.accentLight,
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: T.colors.card,
    borderRadius: T.radius.lg,
    borderWidth: 1,
    borderColor: T.colors.borderAccent,
    borderStyle: 'dashed',
    padding: T.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    marginBottom: T.spacing.lg,
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: T.radius.full,
    backgroundColor: T.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    color: T.colors.accent,
    fontSize: 22,
    fontWeight: '700',
  },
  addButtonTitle: {
    color: T.colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonSub: {
    color: T.colors.mutedText,
    fontSize: 13,
    marginTop: 2,
  },
  fileSection: {
    flex: 1,
  },
  fileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.md,
  },
  fileSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: T.colors.bodyText,
  },
  fileCount: {
    fontSize: 13,
    fontWeight: '600',
    color: T.colors.blue,
    backgroundColor: T.colors.blueSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: T.radius.full,
    overflow: 'hidden',
  },
  fileList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: T.spacing.md,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: T.colors.secondaryText,
    fontWeight: '600',
    marginBottom: T.spacing.xs,
  },
  emptyHint: {
    fontSize: 13,
    color: T.colors.mutedText,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.colors.card,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.colors.borderLight,
    padding: T.spacing.md,
    marginBottom: T.spacing.sm,
  },
  fileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: T.radius.sm,
    backgroundColor: T.colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: T.spacing.md,
  },
  fileIcon: {
    fontSize: 18,
  },
  fileName: {
    flex: 1,
    color: T.colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
    marginRight: T.spacing.md,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: T.radius.full,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: T.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  bottom: {
    paddingBottom: T.spacing.xxl,
    paddingTop: T.spacing.md,
  },
  finishButton: {
    backgroundColor: T.colors.accent,
    borderRadius: T.radius.md,
    paddingVertical: 16,
    paddingHorizontal: T.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  finishArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
