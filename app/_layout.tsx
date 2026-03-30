import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { setBackgroundColorAsync } from 'expo-system-ui';
import 'react-native-reanimated';

// Keep the native splash screen visible until we explicitly hide it
SplashScreen.preventAutoHideAsync();

// Set the root native background to match theme
setBackgroundColorAsync('#0A0A0F');

const customDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0A0A0F',
    card: '#0A0A0F',
    text: '#FFFFFF',
    border: '#1E293B',
    primary: '#7C3AED',
  },
};

function AppLoadingScreen({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const pulseAnim = React.useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Pulse the dots
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Wait a moment, then fade out and signal done
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
      {/* Logo dots */}
      <View style={styles.logoContainer}>
        <View style={styles.logoDot} />
        <View style={[styles.logoDot, styles.logoDotLight]} />
      </View>

      {/* Brand */}
      <Text style={styles.brand}>HIVE</Text>
      <Text style={styles.tagline}>Knowledge in isolation</Text>

      {/* Pulsing loader */}
      <Animated.View style={[styles.loaderDots, { opacity: pulseAnim }]}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </Animated.View>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // When layout mounts, the app is essentially loaded
    setAppReady(true);
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      // Hide the native splash screen first
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }} onLayout={onLayoutRootView}>
      <ThemeProvider value={customDark}>
        {!splashDone && (
          <AppLoadingScreen onFinish={() => setSplashDone(true)} />
        )}

        {splashDone && (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0A0A0F' },
              animation: 'fade',
              animationDuration: 250,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen
              name="create-space"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="add-files"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen name="processing" options={{ animation: 'fade' }} />
            <Stack.Screen name="chat" options={{ animation: 'fade' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        )}

        <StatusBar style="light" />
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  logoDot: {
    width: 14,
    height: 14,
    borderRadius: 9999,
    backgroundColor: '#7C3AED',
  },
  logoDotLight: {
    backgroundColor: '#A78BFA',
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    letterSpacing: 1,
    marginBottom: 40,
  },
  loaderDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: '#7C3AED',
  },
});
