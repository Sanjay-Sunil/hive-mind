import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';

import { getUnembeddedChunks, updateChunkEmbedding } from '../src/database/database';
import AIEngine from '../src/engine/AIEngine';
import HiveModal from '../components/HiveModal';

export default function Processing() {
  const router = useRouter();
  const { spaceId, spaceName, files } = useLocalSearchParams();
  const numericSpaceId = Number(spaceId);

  // System States
  const [chunks, setChunks] = useState<{ id: number; text_content: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalVariant, setModalVariant] = useState<'danger' | 'info'>('danger');

  // Pulse animation for waiting state
  const pulseAnim = React.useRef(new Animated.Value(0.6)).current;

  // Initialize DB and Load Chunks
  useEffect(() => {
    let isMounted = true;
    
    // Start subtle pulse for waiting
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    const loadData = async () => {
      try {
        await AIEngine.initialize();
        const pendingChunks = await getUnembeddedChunks(numericSpaceId);
        
        if (isMounted) {
          setChunks(pendingChunks);
          setProgress((prev) => ({ ...prev, total: pendingChunks.length }));
          
          if (pendingChunks.length === 0) {
            setIsComplete(true);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        showError('Setup Failed', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [numericSpaceId]);


  const showError = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVariant('danger');
    setModalVisible(true);
  };

  const handleProcess = async () => {
    if (chunks.length === 0) return;
    
    setIsProcessing(true);
    let successCount = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // 1. Generate 384-D vector
        const vectorArray = await AIEngine.getEmbedding(chunk.text_content);
        
        // 2. Save it
        await updateChunkEmbedding(chunk.id, vectorArray);

        successCount++;
        setProgress((prev) => ({ ...prev, current: successCount }));
      }
      
      setIsComplete(true);
    } catch (e: any) {
      console.error('[Processing UI] Execution Loop Error:', e);
      showError('Processing Interrupted', `An error occurred while generating embeddings: ${e.message}\n\nYou can retry generating the remaining chunks.`);
      
      // Update our chunks list to remove the ones we successfully processed so we can retry the rest
      const remaining = chunks.slice(successCount);
      setChunks(remaining);
      setProgress({ current: 0, total: remaining.length });
    } finally {
      setIsProcessing(false);
    }
  };

  const onFinish = () => {
    router.replace({
      pathname: '/chat',
      params: { spaceId, spaceName, files },
    });
  };

  const progressPercent = progress.total > 0 
    ? (progress.current / progress.total) * 100 
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoDot} />
          <View style={[styles.logoDot, { backgroundColor: T.colors.accentLight }]} />
        </View>
        <Text style={styles.brand}>HIVE</Text>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        <View style={styles.spaceBadge}>
          <Text style={styles.spaceBadgeText}>{spaceName}</Text>
        </View>

        {loading ? (
          <Text style={styles.statusText}>Initializing AI Engine...</Text>
        ) : isComplete ? (
          <View style={styles.centered}>
            <View style={styles.successIconWrapper}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.statusTitle}>Knowledge Base Ready</Text>
            <Text style={styles.statusSub}>All documents have been embedded and indexed.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vector Embeddings</Text>
            <Text style={styles.cardDesc}>
              Your files have been extracted into {progress.total} chunks. We now need to process these chunks through our neural network to make them searchable.
            </Text>

            {isProcessing ? (
              <View style={styles.progressContainer}>
                <Text style={styles.processingText}>Processing chunk {progress.current} of {progress.total}</Text>
                
                <View style={styles.progressBarBg}>
                  <Animated.View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${progressPercent}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.percentText}>{Math.round(progressPercent)}%</Text>
              </View>
            ) : (
              <Animated.View style={{ opacity: pulseAnim }}>
                <Text style={styles.readyText}>Ready to process</Text>
              </Animated.View>
            )}
          </View>
        )}
      </View>

      {/* Footer Actions */}
      <View style={styles.bottom}>
        {!loading && !isComplete && !isProcessing && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleProcess}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>Generate Embeddings</Text>
          </TouchableOpacity>
        )}

        {isProcessing && (
          <View style={[styles.actionButton, styles.actionButtonDisabled]}>
            <Text style={styles.actionText}>Processing... Please wait</Text>
          </View>
        )}

        {isComplete && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: T.colors.success }]}
            onPress={onFinish}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>Continue to Area</Text>
            <Text style={styles.actionTextIcon}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      <HiveModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        variant={modalVariant}
        buttons={[{ text: 'OK', onPress: () => setModalVisible(false) }]}
        onDismiss={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.colors.background,
    paddingHorizontal: T.spacing.lg,
    paddingTop: 64,
  },
  header: {
    alignItems: 'center',
    marginBottom: T.spacing.xl,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaceBadge: {
    backgroundColor: T.colors.accentSoft,
    borderRadius: T.radius.full,
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginBottom: T.spacing.lg,
  },
  spaceBadgeText: {
    color: T.colors.accentLight,
    fontSize: 15,
    fontWeight: '600',
  },
  statusText: {
    color: T.colors.secondaryText,
    fontSize: 16,
    fontWeight: '500',
  },
  centered: {
    alignItems: 'center',
  },
  successIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.lg,
  },
  successIcon: {
    color: T.colors.success,
    fontSize: 28,
    fontWeight: 'bold',
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: T.colors.primaryText,
    marginBottom: T.spacing.sm,
  },
  statusSub: {
    fontSize: 14,
    color: T.colors.mutedText,
    textAlign: 'center',
  },
  card: {
    backgroundColor: T.colors.card,
    borderRadius: T.radius.lg,
    padding: T.spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: T.colors.borderLight,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: T.colors.primaryText,
    marginBottom: T.spacing.md,
  },
  cardDesc: {
    fontSize: 14,
    color: T.colors.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: T.spacing.xl,
  },
  readyText: {
    fontSize: 14,
    color: T.colors.accentLight,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  processingText: {
    color: T.colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: T.spacing.md,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: T.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: T.spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: T.colors.accent,
    borderRadius: 4,
  },
  percentText: {
    fontSize: 13,
    color: T.colors.mutedText,
    fontWeight: '700',
  },
  bottom: {
    paddingBottom: T.spacing.xxl,
  },
  actionButton: {
    backgroundColor: T.colors.accent,
    paddingVertical: 16,
    borderRadius: T.radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonDisabled: {
    backgroundColor: T.colors.cardElevated,
    opacity: 0.8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionTextIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
