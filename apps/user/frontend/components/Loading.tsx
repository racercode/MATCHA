import { StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { ThemedActivityIndicator } from './ThemedActivityIndicator';

const Loading = ({ text = '', opacity = true }: { text?: string; opacity?: boolean }) => {
  return (
    <ThemedView style={[opacity ? { opacity: 1 } : { opacity: 0.5 }, styles.overlay]}>
      <ThemedActivityIndicator size="large" />
      {text !== '' && <ThemedText type="default">{text}</ThemedText>}
    </ThemedView>
  );
};

export default Loading;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
