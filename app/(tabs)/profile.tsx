import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { buildInstagramUrl, normalizeInstagramHandle } from '@/lib/instagram';
import { humanizeAuthError, signOutUser, updateDisplayName } from '@/services/auth';
import { setUserInstagramHandle, watchUserProfile } from '@/services/users';

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

  // Instagram handle edit state. Lives on /users/{uid} in Firestore — we
  // subscribe so the displayed value stays in sync if the same user is
  // signed in elsewhere. Independent of the display-name edit block above.
  const [savedInstagram, setSavedInstagram] = useState<string | null>(null);
  const [editingInstagram, setEditingInstagram] = useState(false);
  const [draftInstagram, setDraftInstagram] = useState('');
  const [savingInstagram, setSavingInstagram] = useState(false);
  const [instagramError, setInstagramError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setSavedDisplayName(user.displayName ?? null);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSavedInstagram(null);
      return;
    }
    const unsub = watchUserProfile(
      user.uid,
      (profile) => setSavedInstagram(profile?.instagramHandle?.trim() || null),
      (err) => setInstagramError(err.message),
    );
    return unsub;
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

  function startEditInstagram() {
    setDraftInstagram(savedInstagram ?? '');
    setEditingInstagram(true);
    setInstagramError(null);
  }

  async function saveInstagram() {
    if (!user) return;
    setInstagramError(null);
    setSavingInstagram(true);
    try {
      const normalized = normalizeInstagramHandle(draftInstagram) ?? null;
      await setUserInstagramHandle(user.uid, normalized);
      setSavedInstagram(normalized);
      setEditingInstagram(false);
    } catch (e) {
      setInstagramError(e instanceof Error ? e.message : 'Could not save Instagram handle.');
    } finally {
      setSavingInstagram(false);
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

                  <View style={styles.instagramSection}>
                    <View style={styles.headRow}>
                      <ThemedText
                        type="eyebrow"
                        style={{ color: palette.textMuted, flex: 1 }}>
                        Instagram
                      </ThemedText>
                      {!editingInstagram ? (
                        <Pressable onPress={startEditInstagram} hitSlop={8}>
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
                      ) : null}
                    </View>

                    {editingInstagram ? (
                      <View style={styles.editBlock}>
                        <FormField
                          label="Instagram"
                          value={draftInstagram}
                          onChangeText={setDraftInstagram}
                          placeholder="@handle or instagram.com/handle"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <ThemedText
                          type="metadata"
                          style={{ color: palette.textMuted }}>
                          Shown on your public profile. Leave blank to remove.
                        </ThemedText>
                        {instagramError ? (
                          <ThemedText
                            type="metadata"
                            style={{ color: palette.tint }}>
                            {instagramError}
                          </ThemedText>
                        ) : null}
                        <View style={styles.editActions}>
                          <Pressable
                            onPress={() => setEditingInstagram(false)}
                            disabled={savingInstagram}
                            style={[styles.ghostButton, { borderColor: palette.border }]}>
                            <ThemedText
                              style={[styles.ghostButtonText, { color: palette.text }]}>
                              Cancel
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={saveInstagram}
                            disabled={savingInstagram}
                            style={[
                              styles.primaryButton,
                              {
                                backgroundColor: palette.tint,
                                opacity: savingInstagram ? 0.6 : 1,
                              },
                            ]}>
                            {savingInstagram ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <ThemedText style={styles.primaryButtonText}>
                                Save Instagram
                              </ThemedText>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : savedInstagram ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Open @${savedInstagram} on Instagram`}
                        onPress={() => Linking.openURL(buildInstagramUrl(savedInstagram))}
                        style={({ hovered, pressed }) => [
                          styles.instagramChip,
                          {
                            borderColor: palette.border,
                            backgroundColor: palette.surfaceDim,
                            opacity: pressed ? 0.85 : 1,
                          },
                          hovered ? ({ cursor: 'pointer' } as object) : null,
                        ]}>
                        <ThemedText
                          type="metadata"
                          style={{ color: palette.tint, fontWeight: '600' }}>
                          @{savedInstagram}
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <ThemedText
                        type="metadata"
                        style={{ color: palette.placeholder }}>
                        Not set
                      </ThemedText>
                    )}
                  </View>

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
  instagramSection: {
    gap: 10,
  },
  instagramChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
