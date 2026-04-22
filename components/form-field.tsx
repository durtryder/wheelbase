import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  hint?: string;
  required?: boolean;
};

export function FormField({ label, hint, required, ...rest }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.textMuted }]}>
        {label.toUpperCase()}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        placeholderTextColor={palette.textMuted}
        style={[
          styles.input,
          {
            borderColor: palette.border,
            color: palette.text,
            backgroundColor: palette.surface,
          },
        ]}
        {...rest}
      />
      {hint ? (
        <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
});
