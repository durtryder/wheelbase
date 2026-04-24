import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AccessGate } from '@/components/access-gate';
import { useAccess } from '@/hooks/use-access';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * URLs we intentionally let past the preview access gate. Today:
 *   /vehicles/<id> — shared public-vehicle links
 *   /u/<uid>       — public builder profile pages
 * Both need to work for people who don't have the preview password.
 * We don't bypass /vehicles/new or /vehicles/edit/<id> — those are
 * owner-only actions that live behind the gate like everything else.
 */
function isPublicShareRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (/^\/u\/[^/]+$/.test(pathname)) return true;
  return (
    /^\/vehicles\/[^/]+$/.test(pathname) &&
    pathname !== '/vehicles/new'
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const { state: accessState, error: accessError, unlock } = useAccess();

  if (!fontsLoaded) return null;

  const gateRequired =
    accessState === 'required' && !isPublicShareRoute(pathname);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {accessState === 'checking' ? null : gateRequired ? (
        <AccessGate error={accessError} onSubmit={unlock} />
      ) : (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
