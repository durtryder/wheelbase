import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const LOGO = require('@/assets/images/logo.png');

export function BrandHeader({ height = 140 }: { height?: number }) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Image
        source={LOGO}
        style={{ height, aspectRatio: 1 }}
        contentFit="contain"
        accessibilityLabel="Wheelbase"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
