import React, { useState, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';
import { getSpaces, getDocumentCountForSpace, deleteSpace } from '../src/database/database';
import HiveModal from '../components/HiveModal';

const SPACE_ICONS = ['S', 'R', 'D', 'N', 'M', 'A', 'I', 'F', 'K', 'G'];
const ICON_COLORS = [
  '#7C3AED', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EC4899', '#8B5CF6', '#14B8A6', '#6366F1', '#F97316',
];

type SpaceRow = {
  id: number;
  title: string;
  created_at: string;
  docCount?: number;
};

// ─── Individual Space Card ────────────────────────────────
// Isolated so each card owns its own animation values.

function SpaceCard({
  space,
  index,
  onPress,
  onRequestDelete,
}: {
  space: SpaceRow;
  index: number;
  onPress: () => void;
  onRequestDelete: (space: SpaceRow) => void;
}) {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;
  const [isShaking, setIsShaking] = useState(false);

  const triggerShakeAndConfirm = () => {
    if (isShaking) return;
    setIsShaking(true);

    // 1. Tomato-red background flash  +  2. X-axis shake
    // IMPORTANT: both animations must use useNativeDriver: false because
    // backgroundColor (bgAnim) cannot be driven by native and React Native
    // forbids mixing drivers on the same Animated.View node.
    Animated.parallel([
      // Red flash
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 120, useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0.7, duration: 80, useNativeDriver: false }),
      ]),
      // Shake
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: false }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: false }),
      ]),
    ]).start(() => {
      // 3. Trigger delete modal (managed by parent)
      onRequestDelete(space);
      // Fade red bg back and reset shaking state
      Animated.timing(bgAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(
        () => setIsShaking(false)
      );
    });
  };

  // Interpolated tomato-red background
  const redBg = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,99,71,0)', 'rgba(255,99,71,0.35)'],
  });

  return (
    <Animated.View
      style={[
        styles.spaceCard,
        {
          transform: [{ translateX: shakeAnim }],
          backgroundColor: redBg as any,
          borderColor: isShaking ? 'tomato' : T.colors.borderLight,
        },
      ]}
    >
      {/* Inner card content — separated so border radius clips the bg properly */}
      <TouchableOpacity
        style={styles.spaceCardInner}
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={triggerShakeAndConfirm}
        delayLongPress={400}
      >
        <View style={[styles.spaceIconBox, { backgroundColor: ICON_COLORS[index % ICON_COLORS.length] + '20' }]}>
          <Text style={[styles.spaceIconLetter, { color: ICON_COLORS[index % ICON_COLORS.length] }]}>
            {space.title?.charAt(0)?.toUpperCase() || SPACE_ICONS[index % SPACE_ICONS.length]}
          </Text>
        </View>
        <View style={styles.spaceInfo}>
          <Text style={styles.spaceName}>{space.title}</Text>
          <Text style={styles.spaceMeta}>
            {space.docCount || 0} file{space.docCount !== 1 ? 's' : ''} ·{' '}
            {new Date(space.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.spaceRight}>
          {isShaking ? (
            <Text style={styles.deleteHint}>✕</Text>
          ) : (
            <Text style={styles.spaceArrow}>›</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────

export default function Index() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Modal state
  const [deleteTarget, setDeleteTarget] = useState<SpaceRow | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const loadSpaces = useCallback(async () => {
    try {
      setLoading(true);
      const rows = (await getSpaces()) as SpaceRow[];

      const enriched = await Promise.all(
        rows.map(async (space) => {
          const docCount = await getDocumentCountForSpace(space.id);
          return { ...space, docCount };
        })
      );

      setSpaces(enriched);
    } catch (e) {
      console.error('Failed to load spaces:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [loadSpaces])
  );

  const handleDeleteConfirmed = async (id: number) => {
    setDeleteTarget(null);
    setDeletingId(id);
    try {
      await deleteSpace(id);
      setSpaces((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error('Failed to delete space:', e);
      setErrorModal('Failed to delete the space. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoDot} />
          <View style={[styles.logoDot, { backgroundColor: T.colors.accentLight }]} />
        </View>
        <Text style={styles.brand}>HIVE</Text>
        <Text style={styles.tagline}>Knowledge in isolation</Text>
      </View>

      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome back</Text>
        <Text style={styles.welcomeBody}>
          Create a new space or open an existing one to start exploring your knowledge base.
        </Text>

        <TouchableOpacity
          style={styles.createBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/create-space')}
        >
          <Text style={styles.createBtnIcon}>＋</Text>
          <Text style={styles.createBtnText}>Create Space</Text>
        </TouchableOpacity>
      </View>

      {/* Spaces Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Spaces</Text>
          <Text style={styles.sectionCount}>{spaces.length}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={T.colors.accent} />
          </View>
        ) : spaces.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIconChar}>H</Text>
            </View>
            <Text style={styles.emptyText}>No spaces yet</Text>
            <Text style={styles.emptyHint}>Tap "Create Space" above to get started</Text>
          </View>
        ) : (
          <>
            {/* Long-press hint */}
            <Text style={styles.longPressHint}>Long-press a space to delete it</Text>

            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {spaces.map((space, index) => (
                <View key={space.id} style={styles.cardWrapper}>
                  {/* Deleting overlay */}
                  {deletingId === space.id && (
                    <View style={styles.deletingOverlay}>
                      <ActivityIndicator size="small" color={T.colors.danger} />
                      <Text style={styles.deletingText}>Deleting…</Text>
                    </View>
                  )}

                  <SpaceCard
                    space={space}
                    index={index}
                    onPress={() =>
                      router.push({
                        pathname: '/chat',
                        params: { spaceId: space.id, spaceName: space.title },
                      })
                    }
                    onRequestDelete={(s) => setDeleteTarget(s)}
                  />
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {/* ── Delete Confirmation Modal ── */}
      <HiveModal
        visible={!!deleteTarget}
        variant="danger"
        title="Delete Space"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?\n\nThis will permanently remove all documents, chunks, and messages associated with this space.`}
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setDeleteTarget(null),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteTarget && handleDeleteConfirmed(deleteTarget.id),
          },
        ]}
        onDismiss={() => setDeleteTarget(null)}
      />

      {/* ── Error Modal ── */}
      <HiveModal
        visible={!!errorModal}
        variant="danger"
        title="Something went wrong"
        message={errorModal || ''}
        buttons={[
          {
            text: 'OK',
            style: 'default',
            onPress: () => setErrorModal(null),
          },
        ]}
        onDismiss={() => setErrorModal(null)}
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
    fontSize: 26,
    fontWeight: '800',
    color: T.colors.primaryText,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 13,
    color: T.colors.mutedText,
    marginTop: 4,
    letterSpacing: 1,
  },
  welcomeCard: {
    backgroundColor: T.colors.card,
    borderRadius: T.radius.lg,
    borderWidth: 1,
    borderColor: T.colors.border,
    padding: T.spacing.lg,
    marginBottom: T.spacing.xl,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: T.colors.primaryText,
    marginBottom: T.spacing.sm,
  },
  welcomeBody: {
    fontSize: 14,
    color: T.colors.secondaryText,
    lineHeight: 22,
    marginBottom: T.spacing.lg,
  },
  createBtn: {
    backgroundColor: T.colors.accent,
    borderRadius: T.radius.md,
    paddingVertical: 14,
    paddingHorizontal: T.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: T.colors.bodyText,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: T.colors.accent,
    backgroundColor: T.colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: T.radius.full,
    overflow: 'hidden',
  },
  longPressHint: {
    fontSize: 11,
    color: T.colors.mutedText,
    marginBottom: T.spacing.md,
    fontStyle: 'italic',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxl,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: T.radius.md,
    backgroundColor: T.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.md,
  },
  emptyIconChar: {
    fontSize: 24,
    fontWeight: '800',
    color: T.colors.accent,
    letterSpacing: 2,
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
  list: {
    flex: 1,
  },
  cardWrapper: {
    position: 'relative',
    marginBottom: T.spacing.sm + 4,
  },
  spaceCard: {
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.colors.borderLight,
    overflow: 'hidden',
  },
  spaceCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.colors.card,
    padding: T.spacing.md,
  },
  spaceIconBox: {
    width: 44,
    height: 44,
    borderRadius: T.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: T.spacing.md,
  },
  spaceIconLetter: {
    fontSize: 20,
    fontWeight: '800',
  },
  spaceInfo: {
    flex: 1,
  },
  spaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: T.colors.primaryText,
    textTransform: 'capitalize',
  },
  spaceMeta: {
    fontSize: 12,
    color: T.colors.mutedText,
    marginTop: 3,
  },
  spaceRight: {
    width: 28,
    alignItems: 'center',
  },
  spaceArrow: {
    fontSize: 22,
    color: T.colors.mutedText,
    fontWeight: '300',
  },
  deleteHint: {
    fontSize: 18,
    color: T.colors.danger,
    fontWeight: '700',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: T.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deletingText: {
    color: T.colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
