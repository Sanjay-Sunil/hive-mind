import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';

export default function Index() {
  const router = useRouter();

  const existingSpaces = [
    { id: '1', name: 'first aid', emoji: '🩹' },
    { id: '2', name: 'radio', emoji: '📻' },
    { id: '3', name: 'tv', emoji: '📺' },
    { id: '4', name: 'venomous', emoji: '🐍' },
  ];

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
          <Text style={styles.sectionCount}>{existingSpaces.length}</Text>
        </View>

        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {existingSpaces.map((space, index) => (
            <TouchableOpacity
              key={space.id}
              style={styles.spaceCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: { spaceName: space.name },
                })
              }
            >
              <View style={styles.spaceEmoji}>
                <Text style={{ fontSize: 22 }}>{space.emoji}</Text>
              </View>
              <View style={styles.spaceInfo}>
                <Text style={styles.spaceName}>{space.name}</Text>
                <Text style={styles.spaceMeta}>
                  {index + 2} files · last opened today
                </Text>
              </View>
              <Text style={styles.spaceArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
