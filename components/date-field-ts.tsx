/**
 * DateFieldTs — Timestamp-aware variant of DateField. Maintains an
 * internal string buffer so the user can type partial dates ("2",
 * "2024", "2024-01") without their input being clobbered every
 * keystroke by parse-fail-then-rerender.
 *
 * The parent only sees a parsed Timestamp (or undefined for a blank
 * field). Partial / unparseable strings are held in the buffer until
 * they either parse cleanly or get cleared.
 */

import { Timestamp } from 'firebase/firestore';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';

import { DateField } from '@/components/date-field';

type Props = Omit<
  ComponentProps<typeof DateField>,
  'value' | 'onChange' | 'onChangeText'
> & {
  value: Timestamp | undefined;
  onChange: (next: Timestamp | undefined) => void;
};

function formatTs(ts: Timestamp | undefined): string {
  if (!ts) return '';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts as unknown as Date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function parseTs(s: string): Timestamp | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return undefined;
  return Timestamp.fromDate(d);
}

function tsMillis(ts: Timestamp | undefined): number | null {
  if (!ts) return null;
  try {
    return typeof ts.toMillis === 'function' ? ts.toMillis() : null;
  } catch {
    return null;
  }
}

export function DateFieldTs({ value, onChange, ...rest }: Props) {
  const [buffer, setBuffer] = useState(() => formatTs(value));

  // Sync the buffer when the underlying Timestamp changes from outside
  // (initial load, programmatic clear, etc.). Don't fight in-progress
  // user input: if the buffer already parses to the same Timestamp,
  // leave it alone.
  useEffect(() => {
    setBuffer((prev) => {
      const bufferMs = tsMillis(parseTs(prev));
      const valueMs = tsMillis(value);
      if (bufferMs === valueMs) return prev;
      return formatTs(value);
    });
  }, [value]);

  return (
    <DateField
      {...rest}
      value={buffer}
      onChangeText={(next) => {
        setBuffer(next);
        const trimmed = next.trim();
        if (trimmed === '') {
          onChange(undefined);
          return;
        }
        const ts = parseTs(next);
        if (ts) onChange(ts);
        // Partial / invalid: hold the buffer, don't disturb parent.
        // The user's last cleanly-parsed value stays in `value` until
        // they either clear the field or finish typing a valid date.
      }}
    />
  );
}
