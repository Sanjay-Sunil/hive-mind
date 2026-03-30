import React, { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';

export default function Processing() {
  const router = useRouter();
  const { spaceName, files } = useLocalSearchParams();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Spinner rotation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Dots animation
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    // Auto navigate
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/chat',
        params: { spaceName, files },
      });
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(dotInterval);
    };
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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

      {/* Center content */}
      <View style={styles.content}>
        {/* Spinner */}
        <Animated.View
          style={[
            styles.spinner,
            { transform: [{ rotate: spin }] },
          ]}
        />

        <Animated.Text style={[styles.creatingText, { opacity: pulseAnim }]}>
          Creating Your Space{dots}
        </Animated.Text>

        <View style={styles.spaceBadge}>
          <Text style={styles.spaceBadgeText}>{spaceName as string}</Text>
        </View>

        <Text style={styles.subText}>
          Setting up your knowledge base.{'\n'}This won't take long.
        </Text>
      </View>

      {/* Bottom info */}
      <View style={styles.bottom}>
        <View style={styles.tipCard}>
          <Text style={styles.tipLabel}>💡 Did you know?</Text>
          <Text style={styles.tipText}>
            Hive uses intelligent indexing to make your documents instantly
            searchable and queryable through natural conversation.
          </Text>
        </View>
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
    justifyContent: 'space-between',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 56,
    height: 56,
    borderRadius: T.radius.full,
    borderWidth: 3,
    borderColor: T.colors.border,
    borderTopColor: T.colors.accent,
    marginBottom: T.spacing.xl,
  },
  creatingText: {
    fontSize: 22,
    fontWeight: '700',
    color: T.colors.primaryText,
    textAlign: 'center',
    marginBottom: T.spacing.md,
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
    textTransform: 'capitalize',
  },
  subText: {
    fontSize: 14,
    color: T.colors.mutedText,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottom: {
    paddingBottom: T.spacing.xxl,
  },
  tipCard: {
    backgroundColor: T.colors.card,
    borderRadius: T.radius.lg,
    borderWidth: 1,
    borderColor: T.colors.border,
    padding: T.spacing.lg,
  },
  tipLabel: {
    color: T.colors.accentLight,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: T.spacing.sm,
  },
  tipText: {
    color: T.colors.secondaryText,
    fontSize: 14,
    lineHeight: 22,
  },
});
