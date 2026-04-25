import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

type TabScreenScaffoldProps = {
  title: string;
  subtitle: string;
};

export default function TabScreenScaffold({ title, subtitle }: TabScreenScaffoldProps) {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 96,
  },
  content: {
    gap: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  subtitle: {
    color: '#6B7280',
  },
});
