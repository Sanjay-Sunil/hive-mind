import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { CyberTheme as T } from '../constants/CyberTheme';
import {
  getDocuments,
  pickAndSaveDocument,
  deleteDocument,
  getChunkCountForDocument,
} from '../src/database/database';
import { processDocument } from '../src/engine/processor';
import HiveModal from '../components/HiveModal';

type DocRow = {
  id: number;
  space_id: number;
  file_name: string;
  local_uri: string;
};

export default function AddFiles() {
  const router = useRouter();
  const { spaceId, spaceName } = useLocalSearchParams<{ spaceId: string; spaceName: string }>();
  const numericSpaceId = Number(spaceId);

  const [files, setFiles] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);

  // Processed document tracking: Set of document IDs that already have chunks
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set());

  // Batch processing state
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string | null>(null);
  const [processProgress, setProcessProgress] = useState({ done: 0, total: 0 });

  // Spinner animation for processing overlay
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVariant, setModalVariant] = useState<'info' | 'danger' | 'success'>('info');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  // ── Spinner loop ──
  useEffect(() => {
    if (isBatchProcessing) {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [isBatchProcessing]);

  // ── Load documents and their processed status ──
  const loadDocs = async () => {
    try {
      const docs = (await getDocuments(numericSpaceId)) as DocRow[];
      setFiles(docs);

      // Check which documents already have chunks (processed)
      const processed = new Set<number>();
      for (const doc of docs) {
        const count = await getChunkCountForDocument(doc.id);
        if (count > 0) processed.add(doc.id);
      }
      setProcessedIds(processed);
    } catch (e) {
      console.error('Failed to load docs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  // ── Pick files ──
  const handlePick = async () => {
    if (picking || isBatchProcessing) return;
    setPicking(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        for (const asset of result.assets) {
          try {
            const saved = await pickAndSaveDocument(numericSpaceId, asset);
            if (saved) {
              setFiles((prev) => [
                ...prev,
                {
                  id: saved.id,
                  space_id: numericSpaceId,
                  file_name: saved.file_name,
                  local_uri: saved.local_uri,
                },
              ]);
            }
          } catch (e) {
            console.error('Failed to save document:', asset.name, e);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to pick document', err);
    } finally {
      setPicking(false);
    }
  };

  // ── Remove file ──
  const handleRemove = async (docId: number) => {
    if (isBatchProcessing) return;
    try {
      await deleteDocument(docId);
      setFiles((prev) => prev.filter((f) => f.id !== docId));
      setProcessedIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    } catch (e) {
      console.error('Failed to delete document:', e);
    }
  };

  // ── Batch process all unprocessed files ──
  const handleProcessAll = async () => {
    const unprocessed = files.filter((f) => !processedIds.has(f.id));
    if (unprocessed.length === 0) return;

    setIsBatchProcessing(true);
    setProcessProgress({ done: 0, total: unprocessed.length });

    let successCount = 0;
    let failCount = 0;
    let totalChunks = 0;

    for (let i = 0; i < unprocessed.length; i++) {
      const item = unprocessed[i];
      setCurrentProcessingFile(item.file_name);
      setProcessProgress({ done: i, total: unprocessed.length });

      try {
        const result = await processDocument(item.local_uri, item.id);
        totalChunks += result.savedChunks;
        successCount++;
        // Mark as processed immediately
        setProcessedIds((prev) => new Set(prev).add(item.id));
      } catch (err: any) {
        console.error(`[AddFiles] Failed to process "${item.file_name}":`, err);
        failCount++;
      }
    }

    setIsBatchProcessing(false);
    setCurrentProcessingFile(null);
    setProcessProgress({ done: 0, total: 0 });

    // Show summary modal
    if (failCount === 0) {
      setModalVariant('success');
      setModalTitle('Processing Complete');
      setModalMessage(
        `All ${successCount} file${successCount !== 1 ? 's' : ''} processed successfully.\n\n${totalChunks} total segments extracted and saved.`
      );
    } else {
      setModalVariant('danger');
      setModalTitle('Processing Finished');
      setModalMessage(
        `${successCount} file${successCount !== 1 ? 's' : ''} processed, ${failCount} failed.\n\n${totalChunks} segments saved. Failed files can be retried.`
      );
    }
    setModalVisible(true);
  };

  const handleFinish = () => {
    router.replace({
      pathname: '/processing',
      params: {
        spaceId: spaceId,
        spaceName: spaceName,
        files: JSON.stringify(files.map((f) => f.file_name)),
      },
    });
  };

  // ── Derived state ──
  const unprocessedCount = files.filter((f) => !processedIds.has(f.id)).length;
  const allProcessed = files.length > 0 && unprocessedCount === 0;

  // Spinner interpolation
  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* ── Processing Overlay ── */}
      {isBatchProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            {/* Spinning icon */}
            <Animated.View
              style={[
                styles.spinnerWrap,
                { transform: [{ rotate: spinInterpolation }] },
              ]}
            >
              <View style={styles.spinnerDot} />
              <View style={[styles.spinnerDot, styles.spinnerDot2]} />
            </Animated.View>

            <Text style={styles.processingTitle}>Processing Documents</Text>
            <Text style={styles.processingWarning}>
              Please do not close the app while processing is in progress.
            </Text>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      processProgress.total > 0
                        ? `${(processProgress.done / processProgress.total) * 100}%`
                        : '0%',
                  },
                ]}
              />
            </View>

            <Text style={styles.processingStatus}>
              {processProgress.done} / {processProgress.total} completed
            </Text>

            {currentProcessingFile && (
              <Text style={styles.processingFilename} numberOfLines={1}>
                {currentProcessingFile}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={isBatchProcessing}>
        <Text style={[styles.backText, isBatchProcessing && { opacity: 0.3 }]}>← Back</Text>
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
        <Text style={styles.spaceBadgeText}>{spaceName}</Text>
      </View>

      {/* Add file button */}
      <TouchableOpacity
        style={[styles.addButton, isBatchProcessing && { opacity: 0.4 }]}
        activeOpacity={0.7}
        onPress={handlePick}
        disabled={picking || isBatchProcessing}
      >
        {picking ? (
          <ActivityIndicator size="small" color={T.colors.accent} style={{ marginRight: T.spacing.md }} />
        ) : (
          <View style={styles.addIconCircle}>
            <Text style={styles.addIcon}>＋</Text>
          </View>
        )}
        <View>
          <Text style={styles.addButtonTitle}>
            {picking ? 'Importing files...' : 'Add PDF File'}
          </Text>
          <Text style={styles.addButtonSub}>
            {picking ? 'Copying to permanent storage' : 'Tap to browse your device'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* File list */}
      <View style={styles.fileSection}>
        <View style={styles.fileSectionHeader}>
          <Text style={styles.fileSectionTitle}>Selected Files</Text>
          <Text style={styles.fileCount}>{files.length}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={T.colors.accent} />
          </View>
        ) : (
          <ScrollView style={styles.fileList} showsVerticalScrollIndicator={false}>
            {files.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Text style={styles.emptyIconChar}>P</Text>
                </View>
                <Text style={styles.emptyText}>No files selected yet</Text>
                <Text style={styles.emptyHint}>
                  Tap the button above to pick PDF documents
                </Text>
              </View>
            )}

            {files.map((file) => {
              const isProcessed = processedIds.has(file.id);
              return (
                <View
                  key={file.id.toString()}
                  style={[
                    styles.fileRow,
                    isProcessed && styles.fileRowProcessed,
                  ]}
                >
                  <View
                    style={[
                      styles.fileIconWrap,
                      isProcessed && styles.fileIconWrapProcessed,
                    ]}
                  >
                    <Text style={[styles.fileIconChar, isProcessed && styles.fileIconCharProcessed]}>
                      {isProcessed ? '✓' : 'P'}
                    </Text>
                  </View>
                  <View style={styles.fileNameWrap}>
                    <Text
                      style={styles.fileName}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {file.file_name}
                    </Text>
                    <Text style={[styles.fileStatus, isProcessed && styles.fileStatusDone]}>
                      {isProcessed ? 'Processed' : 'Pending'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(file.id)}
                    disabled={isBatchProcessing}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Bottom actions */}
      <View style={styles.bottom}>
        {/* Process All button — only shown when there are unprocessed files */}
        {unprocessedCount > 0 && (
          <TouchableOpacity
            style={styles.processAllButton}
            activeOpacity={0.8}
            onPress={handleProcessAll}
            disabled={isBatchProcessing}
          >
            <Text style={styles.processAllText}>
              Process {unprocessedCount} file{unprocessedCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Finish button — only when all files are processed */}
        {allProcessed && (
          <TouchableOpacity
            style={styles.finishButton}
            activeOpacity={0.8}
            onPress={handleFinish}
          >
            <Text style={styles.finishText}>Continue</Text>
            <Text style={styles.finishArrow}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Branded Modal */}
      <HiveModal
        visible={modalVisible}
        variant={modalVariant}
        title={modalTitle}
        message={modalMessage}
        buttons={[
          {
            text: 'OK',
            style: 'default',
            onPress: () => setModalVisible(false),
          },
        ]}
        onDismiss={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────

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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxl,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: T.radius.md,
    backgroundColor: T.colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.md,
  },
  emptyIconChar: {
    fontSize: 24,
    fontWeight: '800',
    color: T.colors.blue,
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

  /* ── File rows ── */
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
  fileRowProcessed: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
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
  fileIconWrapProcessed: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  fileIconChar: {
    fontSize: 14,
    fontWeight: '800',
    color: T.colors.blue,
  },
  fileIconCharProcessed: {
    color: T.colors.success,
  },
  fileNameWrap: {
    flex: 1,
    marginRight: T.spacing.md,
  },
  fileName: {
    color: T.colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  fileStatus: {
    fontSize: 11,
    color: T.colors.mutedText,
    marginTop: 2,
    fontWeight: '500',
  },
  fileStatusDone: {
    color: T.colors.success,
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

  /* ── Bottom actions ── */
  bottom: {
    paddingBottom: T.spacing.xxl,
    paddingTop: T.spacing.md,
    gap: 10,
  },
  processAllButton: {
    backgroundColor: T.colors.cyan,
    borderRadius: T.radius.md,
    paddingVertical: 15,
    paddingHorizontal: T.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processAllText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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

  /* ── Processing overlay ── */
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  processingCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: T.colors.card,
    borderRadius: T.radius.lg,
    borderWidth: 1,
    borderColor: T.colors.border,
    padding: 28,
    alignItems: 'center',
  },
  spinnerWrap: {
    width: 48,
    height: 48,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.colors.accent,
    top: 0,
  },
  spinnerDot2: {
    top: 'auto' as any,
    bottom: 0,
    backgroundColor: T.colors.accentLight,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: T.colors.primaryText,
    marginBottom: 8,
    textAlign: 'center',
  },
  processingWarning: {
    fontSize: 13,
    color: T.colors.danger,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: T.colors.cardElevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: T.colors.accent,
    borderRadius: 3,
  },
  processingStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: T.colors.secondaryText,
    marginBottom: 4,
  },
  processingFilename: {
    fontSize: 12,
    color: T.colors.mutedText,
    fontStyle: 'italic',
    maxWidth: '90%',
  },
});
