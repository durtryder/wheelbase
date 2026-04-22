/**
 * Documentation list — uploads + renders VehicleDocument records.
 *
 * Flow:
 *   1. Owner clicks "Add document" → expo-document-picker opens
 *   2. On selection, a modal form appears asking for title + kind
 *      (both optional overrides; title defaults to the filename)
 *   3. Upload streams to Storage with a progress row, then writes Firestore
 *   4. The list updates in realtime via watchDocumentsForVehicle
 */

import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  deleteVehicleDocument,
  updateVehicleDocument,
  uploadVehicleDocument,
  watchDocumentsForVehicle,
} from '@/services/documents';
import {
  DOCUMENT_KIND_LABELS,
  type DocumentKind,
  type VehicleDocument,
} from '@/types/vehicle';

type Palette = (typeof Colors)['light'];

type Props = {
  vehicleId: string;
  ownerId: string;
  isOwner: boolean;
};

export function DocumentList({ vehicleId, ownerId, isOwner }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const [docs, setDocs] = useState<VehicleDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Upload state
  const [picking, setPicking] = useState(false);
  const [uploadForm, setUploadForm] = useState<PendingUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    uploaded: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    setError(null);
    const unsub = watchDocumentsForVehicle(
      vehicleId,
      (items) => setDocs(items),
      (e) => setError(e.message),
    );
    return unsub;
  }, [vehicleId]);

  async function handlePick() {
    if (!isOwner) return;
    setError(null);
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const defaultTitle = (asset.name ?? 'Untitled document').replace(/\.[^.]+$/, '');
      setUploadForm({
        uri: asset.uri,
        fileName: asset.name ?? 'document',
        mimeType: asset.mimeType ?? 'application/octet-stream',
        fileSize: asset.size,
        title: defaultTitle,
        kind: 'other',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open file picker.');
    } finally {
      setPicking(false);
    }
  }

  async function handleConfirmUpload() {
    if (!uploadForm) return;
    setUploading(true);
    setUploadProgress({ uploaded: 0, total: uploadForm.fileSize ?? 0 });
    try {
      await uploadVehicleDocument({
        ownerId,
        vehicleId,
        uri: uploadForm.uri,
        fileName: uploadForm.fileName,
        mimeType: uploadForm.mimeType,
        fileSize: uploadForm.fileSize,
        title: uploadForm.title,
        kind: uploadForm.kind,
        description: uploadForm.description,
        onProgress: (uploaded, total) => setUploadProgress({ uploaded, total }),
      });
      setUploadForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function openExternal(doc: VehicleDocument) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(doc.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleDelete(document: VehicleDocument) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Remove "${document.title}"?`)
    ) {
      return;
    }
    setError(null);
    try {
      await deleteVehicleDocument(document);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  return (
    <View style={styles.wrap}>
      {isOwner ? (
        <View style={styles.actions}>
          <Pressable
            onPress={handlePick}
            disabled={picking}
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.tint,
                opacity: picking ? 0.6 : 1,
              },
            ]}>
            {picking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {docs && docs.length > 0 ? 'Add another document' : 'Add document'}
              </ThemedText>
            )}
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <ThemedText type="metadata" style={{ color: palette.tint }}>
          {error}
        </ThemedText>
      ) : null}

      {docs === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.tint} />
        </View>
      ) : docs.length === 0 ? (
        <ThemedText type="metadata" style={{ color: palette.placeholder }}>
          {isOwner
            ? 'No documents yet. Upload service records, shop invoices, awards, or anything else worth keeping.'
            : 'No documents yet.'}
        </ThemedText>
      ) : (
        <View style={[styles.table, { borderColor: palette.border }]}>
          {docs.map((d, idx) => (
            <DocumentRow
              key={d.id}
              document={d}
              palette={palette}
              isOwner={isOwner}
              isLast={idx === docs.length - 1}
              isEditing={editingId === d.id}
              onBeginEdit={() => setEditingId(d.id)}
              onCancelEdit={() => setEditingId(null)}
              onOpen={() => openExternal(d)}
              onDelete={() => handleDelete(d)}
              onSave={async (patch) => {
                try {
                  await updateVehicleDocument(d.id, patch);
                  setEditingId(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Update failed.');
                }
              }}
            />
          ))}
        </View>
      )}

      {uploadForm ? (
        <UploadModal
          palette={palette}
          form={uploadForm}
          setForm={setUploadForm}
          uploading={uploading}
          progress={uploadProgress}
          onCancel={() => {
            if (!uploading) setUploadForm(null);
          }}
          onConfirm={handleConfirmUpload}
        />
      ) : null}
    </View>
  );
}

// ---------- Row ----------

function DocumentRow({
  document,
  palette,
  isOwner,
  isLast,
  isEditing,
  onBeginEdit,
  onCancelEdit,
  onOpen,
  onDelete,
  onSave,
}: {
  document: VehicleDocument;
  palette: Palette;
  isOwner: boolean;
  isLast: boolean;
  isEditing: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onSave: (
    patch: Partial<Pick<VehicleDocument, 'title' | 'kind' | 'description'>>,
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState(document.title);
  const [kind, setKind] = useState<DocumentKind>(document.kind);
  const [description, setDescription] = useState(document.description ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(document.title);
    setKind(document.kind);
    setDescription(document.description ?? '');
  }, [document.id, document.title, document.kind, document.description, isEditing]);

  const date = formatDocumentDate(document);
  const size = document.fileSize ? formatBytes(document.fileSize) : null;

  if (isEditing) {
    return (
      <View
        style={[
          styles.row,
          styles.rowEditing,
          !isLast && { borderBottomColor: palette.border, borderBottomWidth: 1 },
          { backgroundColor: palette.surfaceDim },
        ]}>
        <FormField label="Title" value={title} onChangeText={setTitle} />
        <KindSelector value={kind} onChange={setKind} palette={palette} />
        <FormField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
        />
        <View style={styles.editActions}>
          <Pressable
            disabled={saving}
            onPress={onCancelEdit}
            style={[styles.ghostButton, { borderColor: palette.border }]}>
            <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={saving || !title.trim()}
            onPress={async () => {
              setSaving(true);
              try {
                await onSave({
                  title: title.trim(),
                  kind,
                  description: description.trim() || undefined,
                });
              } finally {
                setSaving(false);
              }
            }}
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.tint,
                opacity: saving || !title.trim() ? 0.6 : 1,
              },
            ]}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Save</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomColor: palette.border, borderBottomWidth: 1 },
      ]}>
      <View style={styles.rowBody}>
        <ThemedText
          type="eyebrow"
          style={{ color: palette.tint, marginBottom: 4 }}>
          {DOCUMENT_KIND_LABELS[document.kind]}
        </ThemedText>
        <Pressable onPress={onOpen}>
          <ThemedText type="defaultSemiBold">{document.title}</ThemedText>
        </Pressable>
        {document.description ? (
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, marginTop: 3 }}>
            {document.description}
          </ThemedText>
        ) : null}
        <ThemedText
          type="metadata"
          style={{ color: palette.textMuted, marginTop: 6 }}>
          {[date, size, friendlyMime(document.mimeType)]
            .filter(Boolean)
            .join('    ·    ')}
        </ThemedText>
      </View>

      <View style={styles.rowActions}>
        <TextLink onPress={onOpen} color={palette.tint}>
          Open
        </TextLink>
        {isOwner ? (
          <>
            <TextLink onPress={onBeginEdit} color={palette.textMuted}>
              Edit
            </TextLink>
            <TextLink onPress={onDelete} color={palette.tint}>
              Remove
            </TextLink>
          </>
        ) : null}
      </View>
    </View>
  );
}

// ---------- Upload modal ----------

function UploadModal({
  palette,
  form,
  setForm,
  uploading,
  progress,
  onCancel,
  onConfirm,
}: {
  palette: Palette;
  form: PendingUpload;
  setForm: (f: PendingUpload | null) => void;
  uploading: boolean;
  progress: { uploaded: number; total: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            modalStyles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}>
          <ThemedText type="subtitle">Add document</ThemedText>
          <ThemedText
            type="metadata"
            style={{ color: palette.textMuted, marginTop: 4 }}>
            {form.fileName}
            {form.fileSize ? `  ·  ${formatBytes(form.fileSize)}` : ''}
          </ThemedText>

          <View style={[modalStyles.hairline, { backgroundColor: palette.border }]} />

          <FormField
            label="Title"
            required
            value={form.title}
            onChangeText={(v) => setForm({ ...form, title: v })}
            placeholder="e.g. Dyno tune — June 2024"
          />

          <KindSelector
            value={form.kind}
            onChange={(k) => setForm({ ...form, kind: k })}
            palette={palette}
          />

          <FormField
            label="Description"
            value={form.description ?? ''}
            onChangeText={(v) => setForm({ ...form, description: v || undefined })}
            placeholder="Optional"
          />

          {progress ? (
            <ThemedText type="metadata" style={{ color: palette.textMuted }}>
              Uploading… {formatBytes(progress.uploaded)} /{' '}
              {formatBytes(progress.total || form.fileSize || 0)}
            </ThemedText>
          ) : null}

          <View style={modalStyles.actions}>
            <Pressable
              disabled={uploading}
              onPress={onCancel}
              style={[styles.ghostButton, { borderColor: palette.border }]}>
              <ThemedText style={[styles.ghostButtonText, { color: palette.text }]}>
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={uploading || !form.title.trim()}
              onPress={onConfirm}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: palette.tint,
                  opacity: uploading || !form.title.trim() ? 0.6 : 1,
                },
              ]}>
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Upload</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Bits ----------

function KindSelector({
  value,
  onChange,
  palette,
}: {
  value: DocumentKind;
  onChange: (k: DocumentKind) => void;
  palette: Palette;
}) {
  return (
    <View style={styles.kindWrap}>
      <ThemedText type="eyebrow" style={{ color: palette.textMuted }}>
        Kind
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kindRow}>
        {(Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[]).map((k) => {
          const active = k === value;
          return (
            <Pressable
              key={k}
              onPress={() => onChange(k)}
              style={[
                styles.kindChip,
                active
                  ? { backgroundColor: palette.tint, borderColor: palette.tint }
                  : { backgroundColor: 'transparent', borderColor: palette.border },
              ]}>
              <ThemedText
                type="metadata"
                style={{
                  color: active ? '#fff' : palette.text,
                  fontWeight: active ? '700' : '500',
                }}>
                {DOCUMENT_KIND_LABELS[k]}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TextLink({
  onPress,
  color,
  children,
}: {
  onPress: (e: GestureResponderEvent) => void;
  color: string;
  children: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.textLink}>
      <ThemedText
        type="metadata"
        style={{ color, fontWeight: '600', letterSpacing: 1.1 }}>
        {children.toUpperCase()}
      </ThemedText>
    </Pressable>
  );
}

// ---------- Helpers ----------

type PendingUpload = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  title: string;
  kind: DocumentKind;
  description?: string;
};

function formatDocumentDate(doc: VehicleDocument): string | null {
  const ts = doc.documentDate ?? doc.createdAt;
  if (!ts) return null;
  try {
    const d =
      typeof (ts as { toDate?: () => Date }).toDate === 'function'
        ? (ts as { toDate: () => Date }).toDate()
        : (ts as unknown as Date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const labeled = d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return doc.documentDate ? labeled : `Uploaded ${labeled}`;
  } catch {
    return null;
  }
}

function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function friendlyMime(mime: string): string {
  if (!mime) return '';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return mime.replace('image/', '').toUpperCase();
  if (mime === 'application/msword') return 'DOC';
  if (mime.includes('wordprocessingml')) return 'DOCX';
  if (mime.includes('spreadsheetml')) return 'XLSX';
  if (mime === 'application/vnd.ms-excel') return 'XLS';
  if (mime === 'text/plain') return 'TXT';
  if (mime === 'text/csv') return 'CSV';
  return mime.split('/').pop()?.toUpperCase() ?? '';
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  actions: {
    flexDirection: 'row',
  },
  centered: {
    padding: 24,
    alignItems: 'center',
  },
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  rowEditing: {
    flexDirection: 'column',
    gap: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  textLink: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  primaryButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
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
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  kindWrap: {
    gap: 8,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 6,
  },
  kindChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    gap: 14,
  },
  hairline: {
    height: 1,
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
});
