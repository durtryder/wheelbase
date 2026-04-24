import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { humanizeAuthError, signOutUser, updateDisplayName } from '@/services/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { user, loading } = useAuth();

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Display-name edit state. `savedDisplayName` is our local view of the
  // current value — updateProfile() in Firebase doesn't retrigger useAuth's
  // onAuthStateChanged, so we keep our own copy and update it on save.
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (user) setSavedDisplayName(user.displayName ?? null);
  }, [user]);

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      await signOutUser();
      router.replace('/');
    } catch (e) {
      setError(humanizeAuthError(e));
    } finally {
      setSigningOut(false);
    }
  }

  function startEditName() {
    setDraftName(savedDisplayName ?? user?.displayName ?? '');
    setEditing(true);
    setError(null);
  }

  async function saveName() {
    setError(null);
    setSavingName(true);
    try {
      const trimmed = draftName.trim();
      await updateDisplayName(trimmed);
      setSavedDisplayName(trimmed || null);
      setEditing(false);
    } catch (e) {
      setError(humanizeAuthError(e));
    } finally {
      setSavingName(false);
    }
  }

  const effectiveName =
    savedDisplayName?.trim() ||
    user?.displayName?.trim() ||
    null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText type="title">Profile</ThemedText>
          <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        </View>

        <ThemedView
          style={[
            styles.card,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}>
          {loading ? (
            <ThemedText>Loading…</ThemedText>
          ) : user ? (
            <>
              <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
                Signed in
              </ThemedText>

              {editing ? (
                <View style={styles.editBlock}>
                  <FormField
                    label="Display Name"
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Your name as it'll appear on builds"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                  />
                  <ThemedText
                    type="metadata"
                    style={{ color: palette.textMuted }}>
                    This is the &quot;by&quot; name on your vehicles and profile. Changes
                    apply to new saves; older vehicles update the next time you open
                    them.
                  </ThemedText>
                  <View style={styles.editActions}>
                    <Pressable
                      onPress={() => setEditing(false)}
                      disabled={savingName}
                      style={[styles.ghostButton, { borderColor: palette.border }]}>
                      <ThemedText
                        style={[styles.ghostButtonText, { color: palette.text }]}>
                        Cancel
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={saveName}
                      disabled={savingName}
                      style={[
                        styles.primaryButton,
                        {
                          backgroundColor: palette.tint,
                          opacity: savingName ? 0.6 : 1,
                        },
                      ]}>
                      {savingName ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.primaryButtonText}>
                          Save name
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.headRow}>
                    <ThemedText type="subtitle" style={{ flex: 1 }}>
                      {effectiveName ?? user.email ?? 'Account'}
                    </ThemedText>
                    <Pressable onPress={startEditName} hitSlop={8}>
                      <ThemedText
                        type="metadata"
                        style={{
                          color: palette.tint,
                          fontWeight: '600',
                          letterSpacing: 1,
                        }}>
                        EDIT
                      </ThemedText>
                    </Pressable>
                  </View>

                  {user.email ? (
                    <ThemedText
                      type="metadata"
                      style={{ color: palette.textMuted, marginTop: 4 }}>
                      {user.email}
                    </ThemedText>
                  ) : null}
                  <ThemedText
                    type="metadata"
                    style={{ color: palette.placeholder, marginTop: 8 }}>
                    UID: {user.uid}
                  </ThemedText>

                  <View
                    style={[styles.hairline, { backgroundColor: palette.border }]}
                  />

                  {error ? (
                    <ThemedText
                      type="metadata"
                      style={{ color: palette.tint, marginBottom: 8 }}>
                      {error}
                    </ThemedText>
                  ) : null}

                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={handleSignOut}
                      disabled={signingOut}
                      style={[
                        styles.ghostButton,
                        { borderColor: palette.border, opacity: signingOut ? 0.6 : 1 },
                      ]}>
                      {signingOut ? (
                        <ActivityIndicator color={palette.textMuted} />
                      ) : (
                        <ThemedText
                          style={[styles.ghostButtonText, { color: palette.text }]}>
                          Sign out
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
                Not signed in
              </ThemedText>
              <ThemedText type="subtitle">Welcome to Wheelbase.</ThemedText>
              <ThemedText
                type="default"
                style={{ color: palette.textMuted, marginTop: 4 }}>
                Sign in or create an account to save vehicles, upload photos, and share your
                builds.
              </ThemedText>

              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => router.push('/sign-in')}
                  style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
                  <ThemedText style={styles.primaryButtonText}>Sign in</ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
    gap: 24,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  titleBlock: { gap: 10, alignItems: 'center' },
  rule: { width: 40, height: 2, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 28,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hairline: {
    height: 1,
    width: '100%',
    marginTop: 20,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  editBlock: {
    gap: 12,
    marginTop: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ghostButton: {
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
