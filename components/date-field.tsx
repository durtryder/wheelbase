import type { ComponentProps } from 'react';

import { FormField } from '@/components/form-field';

type Props = Omit<
  ComponentProps<typeof FormField>,
  'autoCorrect' | 'autoCapitalize' | 'keyboardType' | 'inputMode'
>;

/**
 * Thin wrapper over FormField that disables the aggressive iOS / Android
 * autocorrect + autocapitalize that mangle typed dates, and nudges the
 * on-screen keyboard to a digits-and-punctuation layout so dashes and
 * numerals are easy to reach. Expects YYYY-MM-DD input.
 *
 * A native date picker is a nice upgrade (Platform.OS === 'web' case could
 * use <input type="date">) — queued as a follow-up once we validate the
 * simple fix handles the reported UX issue.
 */
export function DateField(props: Props) {
  return (
    <FormField
      {...props}
      autoCorrect={false}
      autoCapitalize="none"
      keyboardType="numbers-and-punctuation"
      inputMode="numeric"
      placeholder={props.placeholder ?? 'YYYY-MM-DD'}
    />
  );
}
