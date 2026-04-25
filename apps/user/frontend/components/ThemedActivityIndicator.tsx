import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';
import { useThemeColor } from '@/containers/hooks/useThemeColor';

export type ThemedActivityIndicatorProps = ActivityIndicatorProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedActivityIndicator({ size, lightColor, darkColor, ...otherProps }: ThemedActivityIndicatorProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'tint');
  return <ActivityIndicator size={size} color={color} {...otherProps} />;
}
