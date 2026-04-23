import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const LOGO = require('@/assets/images/logo.png');

type Props = {
  error: string | null;
  onSubmit: (password: string) => Promise<boolean> | boolean;
};

export function AccessGate({ error, onSubmit }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting || !password) return;
    setSubmitting(true);
    try {
      await onSubmit(password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.inner}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />

        <ThemedText type="title" style={styles.title}>
          Wheelbase
        </ThemedText>

        <ThemedText
          type="metadata"
          style={[styles.tagline, { color: palette.textMuted }]}>
          Early preview — enter the access code to continue.
        </ThemedText>

        <View style={styles.formWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
            placeholder="Access code"
            placeholderTextColor={palette.placeholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            autoFocus
            style={[
              styles.input,
              {
                borderColor: palette.border,
                color: palette.text,
                backgroundColor: palette.surface,
              },
            ]}
          />

          {error ? (
            <ThemedText
              type="metadata"
              style={[styles.error, { color: palette.tint }]}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !password}
            style={[
              styles.button,
              {
                backgroundColor: palette.tint,
                opacity: submitting || !password ? 0.6 : 1,
              },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Enter</ThemedText>
            )}
          </Pressable>
        </View>

        <ThemedText
          type="metadata"
          style={[styles.footnote, { color: palette.placeholder }]}>
          By invitation only during the preview.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inner: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  logo: {
    width: 220,
    height: 220,
  },
  title: {
    marginTop: 4,
  },
  tagline: {
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 20,
  },
  formWrap: {
    width: '100%',
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: Fonts.sans.regular,
  },
  error: {
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.sans.semibold,
  },
  footnote: {
    marginTop: 24,
    textAlign: 'center',
  },
});
