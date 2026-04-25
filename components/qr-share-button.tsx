/**
 * QrShareButton — a pill button that, when tapped, opens a modal with a
 * scannable QR code for a vehicle's public URL. Designed for car-meetup
 * use: hold up the phone, friend points their camera at it, the
 * vehicle listing opens.
 *
 * The QR PNG is generated client-side via the `qrcode` npm package (pure
 * JS — works on web and RN, no native deps). We render the data URL
 * through expo-image so it caches like any other thumb. The vehicle
 * URL is printed below the code so a viewer can also tap-to-copy.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'qrcode';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

type Palette = (typeof Colors)['light'];

type Props = {
  /** The full URL we want viewers to land on after scanning. */
  url: string;
  /**
   * Vehicle title shown above the QR for context — helps when the
   * popup is photographed at a meetup and shared later.
   */
  title?: string;
  palette: Palette;
};

export function QrShareButton({ url, title, palette }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ hovered }) => [
          styles.triggerButton,
          { borderColor: palette.border },
          hovered ? ({ cursor: 'pointer' } as object) : null,
        ]}>
        <ThemedText
          type="metadata"
          style={{ color: palette.text, fontWeight: '600' }}>
          QR code
        </ThemedText>
      </Pressable>

      {open ? (
        <QrModal
          url={url}
          title={title}
          palette={palette}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function QrModal({
  url,
  title,
  palette,
  onClose,
}: {
  url: string;
  title?: string;
  palette: Palette;
  onClose: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Render the QR at a generous size so it scans cleanly even when the
  // photographer is a few feet away and the screen is dim. We use a
  // fixed pixel size in the data URL (720) so the bitmap stays sharp
  // when scaled down to whatever fits the modal.
  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);
    QRCode.toDataURL(url, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not generate QR.');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Escape closes on web. Native users get the back gesture / Android
  // hardware back via Modal's onRequestClose.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function copyLink() {
    if (typeof window === 'undefined') return;
    try {
      navigator.clipboard?.writeText?.(url).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => {
          window.prompt('Copy this link:', url);
        },
      );
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  // Slightly smaller on phones so the modal doesn't run edge-to-edge,
  // and capped on desktop so the code doesn't dominate the viewport.
  const qrSize = Math.min(windowWidth - 80, 360);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={modalStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            modalStyles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}>
          <ThemedText
            type="eyebrow"
            style={{ color: palette.tint, marginBottom: 6 }}>
            Scan to open
          </ThemedText>
          {title ? (
            <ThemedText
              type="subtitle"
              style={{ textAlign: 'center', marginBottom: 4 }}>
              {title}
            </ThemedText>
          ) : null}
          <ThemedText
            type="metadata"
            style={{
              color: palette.textMuted,
              textAlign: 'center',
              marginBottom: 18,
            }}>
            Point a phone camera at the code below.
          </ThemedText>

          <View
            style={[
              modalStyles.qrFrame,
              {
                width: qrSize + 24,
                height: qrSize + 24,
                borderColor: palette.border,
              },
            ]}>
            {dataUrl ? (
              <Image
                source={{ uri: dataUrl }}
                style={{ width: qrSize, height: qrSize }}
                contentFit="contain"
              />
            ) : error ? (
              <ThemedText type="metadata" style={{ color: palette.tint }}>
                {error}
              </ThemedText>
            ) : (
              <ActivityIndicator color={palette.tint} />
            )}
          </View>

          <Pressable
            onPress={copyLink}
            style={({ hovered }) => [
              modalStyles.linkPill,
              { borderColor: palette.border },
              hovered ? ({ cursor: 'pointer' } as object) : null,
            ]}>
            <ThemedText
              type="metadata"
              numberOfLines={1}
              style={{
                color: palette.text,
                fontWeight: '600',
                maxWidth: qrSize,
              }}>
              {copied ? '✓ Link copied' : url}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={[
              modalStyles.closeButton,
              { backgroundColor: palette.tint },
            ]}>
            <ThemedText style={modalStyles.closeButtonText}>Close</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  triggerButton: {
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Same opaque-black recipe as the lightbox so the modal feels like
    // it lives in the same visual universe.
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
    maxWidth: 460,
    width: '100%',
    gap: 4,
  },
  qrFrame: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  linkPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 18,
    maxWidth: '100%',
  },
  closeButton: {
    paddingVertical: 9,
    paddingHorizontal: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
