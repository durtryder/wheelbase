import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TopNav } from '@/components/top-nav';
import { ThemedView } from '@/components/themed-view';

export default function TabsLayout() {
  return (
    <ThemedView style={styles.root}>
      <TopNav />
      <View style={styles.content}>
        <Slot />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
