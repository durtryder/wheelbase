import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { humanizeAuthError, signIn, signUp } from '@/services/auth';

type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Offer to continue to the Garage.
  if (!authLoading && user) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleBlock}>
            <ThemedText type="title">You&apos;re signed in</ThemedText>
            <View style={[styles.rule, { backgroundColor: palette.accent }]} />
          </View>
          <ThemedText type="default" style={{ color: palette.textMuted, textAlign: 'center' }}>
            Signed in as {user.displayName ?? user.email ?? user.uid}.
          </ThemedText>
          <View style={styles.centerRow}>
            <Pressable
              onPress={() => router.replace('/')}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <ThemedText style={styles.primaryButtonText}>Go to my garage</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  async function handleSubmit() {
    setError(null);
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) {
      setError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp(emailTrimmed, password, displayName.trim() || undefined);
      } else {
        await signIn(emailTrimmed, password);
      }
      router.replace('/');
    } catch (e) {
      setError(humanizeAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">
            {mode === 'signin' ? 'Sign in' : 'Create an account'}
          </ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <View style={[styles.toggle, { borderColor: palette.border }]}>
          <ToggleButton
            label="Sign in"
            isActive={mode === 'signin'}
            onPress={() => {
              setMode('signin');
              setError(null);
            }}
            palette={palette}
          />
          <ToggleButton
            label="Create account"
            isActive={mode === 'signup'}
            onPress={() => {
              setMode('signup');
              setError(null);
            }}
            palette={palette}
          />
        </View>

        <View style={styles.form}>
          {mode === 'signup' ? (
            <FormField
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name (optional)"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          ) : null}
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
          />
        </View>

        {error ? (
          <ThemedText type="metadata" style={{ color: palette.tint, textAlign: 'center' }}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.centerRow}>
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[
              styles.primaryButton,
              { backgroundColor: palette.tint, opacity: submitting ? 0.6 : 1 },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </ThemedText>
            )}
          </Pressable>
        </View>

        <ThemedText type="metadata" style={{ color: palette.textMuted, textAlign: 'center' }}>
          {mode === 'signin'
            ? "Don't have an account yet? Create one above."
            : 'Already have an account? Sign in above.'}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function ToggleButton({
  label,
  isActive,
  onPress,
  palette,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  palette: (typeof Colors)['light'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleButton,
        isActive
          ? { backgroundColor: palette.surface, borderColor: palette.tint }
          : { borderColor: 'transparent' },
      ]}>
      <ThemedText
        type="default"
        style={{
          color: isActive ? palette.text : palette.textMuted,
          fontWeight: isActive ? '700' : '500',
          textAlign: 'center',
        }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 64,
    gap: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: {
    gap: 10,
    alignItems: 'center',
  },
  rule: {
    width: 40,
    height: 2,
    marginTop: 2,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 6,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  form: {
    gap: 14,
  },
  centerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryButton: {
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
