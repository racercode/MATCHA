import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/containers/hooks/useColorScheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  return colorFromProps ?? Colors[theme][colorName];
}
