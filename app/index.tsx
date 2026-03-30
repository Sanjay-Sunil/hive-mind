import React, { useState, useCallback } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';
import { getSpaces, getDocumentCountForSpace } from '../src/database/database';

const SPACE_EMOJIS = ['📚', '🧬', '🔬', '📡', '🩹', '🎯', '💡', '🗂️', '🧠', '🌐'];

function getEmoji(index: number) {
  return SPACE_EMOJIS[index % SPACE_EMOJIS.length];
}

type SpaceRow = {
  id: number;
  title: string;
  created_at: string;
  docCount?: number;
};

export default function Index() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSpaces = useCallback(async () => {
    try {
      setLoading(true);
      const rows = (await getSpaces()) as SpaceRow[];

      // Enrich each space with its document count
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

  // Reload spaces every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [loadSpaces])
  );

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
        <Text style={styles.welcomeTitle}>Welcome back 👋</Text>
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
            <Text style={styles.emptyIcon}>🗂️</Text>
            <Text style={styles.emptyText}>No spaces yet</Text>
            <Text style={styles.emptyHint}>Tap "Create Space" above to get started</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {spaces.map((space, index) => (
              <TouchableOpacity
                key={space.id}
                style={styles.spaceCard}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/chat',
                    params: { spaceId: space.id, spaceName: space.title },
                  })
                }
              >
                <View style={styles.spaceEmoji}>
                  <Text style={{ fontSize: 22 }}>{getEmoji(index)}</Text>
                </View>
                <View style={styles.spaceInfo}>
                  <Text style={styles.spaceName}>{space.title}</Text>
                  <Text style={styles.spaceMeta}>
                    {space.docCount || 0} file{space.docCount !== 1 ? 's' : ''} ·{' '}
                    {new Date(space.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.spaceArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
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
    marginBottom: T.spacing.md,
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  list: {
    flex: 1,
  },
  spaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.colors.card,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.colors.borderLight,
    padding: T.spacing.md,
    marginBottom: T.spacing.sm + 4,
  },
  spaceEmoji: {
    width: 44,
    height: 44,
    borderRadius: T.radius.sm,
    backgroundColor: T.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: T.spacing.md,
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
  spaceArrow: {
    fontSize: 22,
    color: T.colors.mutedText,
    fontWeight: '300',
  },
});
