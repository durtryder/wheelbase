import { useWindowDimensions } from 'react-native';

/**
 * Single source of truth for "is this a phone?" style layout decisions.
 * Values picked to match our content's natural breakpoints rather than
 * generic Tailwind/Bootstrap sizes:
 *
 *   narrow  — phones (most iPhones are 390, most Androids 360–412)
 *   medium  — tablets + split-screen phones
 *   wide    — desktop-ish viewports
 */
export function useBreakpoints() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isNarrow: width < 700,
    isMedium: width >= 700 && width < 1024,
    isWide: width >= 1024,
  };
}
