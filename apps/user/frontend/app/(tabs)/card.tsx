import { useRef, useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

type ChoiceKey = 'no' | 'yes' | null;

const prompts = [
  {
    badge: '方向確認',
    title: '你目前是否有在考慮出國進修？',
    description:
      '你的檔案顯示對設計有興趣，但還未確定路徑。部分資源，如出國獎學金、語言課程補助，需要先知道你是否有這個方向。\n\n如果你完全沒有這個打算，matcha 就不會主動推送相關資源。',
    hint: '回答這個問題能讓推薦更精準',
  },
  {
    badge: '學習偏好',
    title: '你會想先從接案或實習開始累積作品嗎？',
    description:
      '如果你偏好先用實作累積經驗，matcha 會優先整理短期專案、實習缺口與作品集範例給你。\n\n如果你比較想先把基礎打穩，也可以改成推薦課程與入門社群。',
    hint: '你的回答會影響資源排序',
  },
  {
    badge: '生活安排',
    title: '你目前比較想找平日還是假日可參與的機會？',
    description:
      '不同課程、活動與社群聚會的時間差很多。知道你的可投入時段後，matcha 才能把真的排得進生活的選項放前面。\n\n這樣你看到的推薦會更實際，也更容易開始行動。',
    hint: 'matcha 會依你的時間安排調整推薦節奏',
  },
];

const SWIPE_THRESHOLD = 80;

const choiceLabels: Record<Exclude<ChoiceKey, null>, string> = {
  no: '先不考慮',
  yes: '有在想',
};

export default function CardScreen() {
  const { top } = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<ChoiceKey>(null);

  const position = useRef(new Animated.ValueXY()).current;

  const currentPrompt = useMemo(() => prompts[currentIndex], [currentIndex]);

  const advanceCard = (choice: Exclude<ChoiceKey, null>) => {
    setSelectedChoice(choice);
    const toX = choice === 'yes' ? 400 : -400;
    Animated.timing(position, {
      toValue: { x: toX, y: 0 },
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) => (prev + 1) % prompts.length);
      setSelectedChoice(null);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5,
      onPanResponderMove: Animated.event([null, { dx: position.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          advanceCard('no');
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          advanceCard('yes');
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const cardRotate = position.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const goToPrompt = (index: number) => {
    setCurrentIndex(index);
    setSelectedChoice(null);
    position.setValue({ x: 0, y: 0 });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.page, { paddingTop: top + 16, paddingBottom: tabBarHeight + 10 }]}>
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            <View style={styles.brandTitleRow}>
              <ThemedText style={styles.brandIcon}>🍵</ThemedText>
              <ThemedText style={styles.brandTitle}>matcha</ThemedText>
            </View>
            <ThemedText style={styles.brandSubtitle}>幫 agent 更新你的偏好</ThemedText>
          </View>
        </View>

        <View style={styles.stage}>
          <View style={[styles.stackCard, styles.stackCardBack]} />
          <View style={[styles.stackCard, styles.stackCardMiddle]} />

          <Animated.View
            style={[
              styles.questionCard,
              { transform: [{ translateX: position.x }, { rotate: cardRotate }] },
            ]}
            {...panResponder.panHandlers}>
            <View style={styles.cardTopBar} />
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{currentPrompt.badge}</ThemedText>
            </View>

            <ThemedText style={styles.questionTitle}>{currentPrompt.title}</ThemedText>
            <ThemedText style={styles.questionDescription}>{currentPrompt.description}</ThemedText>

            <View style={styles.cardFooter}>
              <ThemedText style={styles.cardHint}>{currentPrompt.hint}</ThemedText>
              <View style={styles.percentPill}>
                <ThemedText style={styles.percentText}>+15%</ThemedText>
              </View>
            </View>
          </Animated.View>

        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.secondaryButton, selectedChoice === 'no' && styles.secondaryButtonActive]}
            onPress={() => advanceCard('no')}>
            <ThemedText style={[styles.secondaryButtonText, selectedChoice === 'no' && styles.secondaryButtonTextActive]}>
              ← {choiceLabels.no}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.primaryButton, selectedChoice === 'yes' && styles.primaryButtonActive]}
            onPress={() => advanceCard('yes')}>
            <ThemedText style={styles.primaryButtonText}>{choiceLabels.yes} →</ThemedText>
          </Pressable>
        </View>

        <View style={styles.dotsRow}>
          {prompts.map((prompt, index) => (
            <Pressable
              key={prompt.title}
              onPress={() => goToPrompt(index)}
              style={[styles.dot, index === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  page: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  brandBlock: {
    gap: 4,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  brandTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: '#18365A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    color: '#8AA7C4',
    marginLeft: 4,
  },
  stage: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    minHeight: 0,
  },
  stackCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 28,
    backgroundColor: '#D6EEFF',
    borderWidth: 1,
    borderColor: '#B8DCFA',
    shadowColor: '#9CBFDD',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 2,
  },
  stackCardBack: {
    top: 48,
    bottom: 86,
    transform: [{ rotate: '-4deg' }, { translateX: -18 }],
    opacity: 0.55,
  },
  stackCardMiddle: {
    top: 28,
    bottom: 62,
    transform: [{ rotate: '4deg' }, { translateX: 16 }],
    opacity: 0.75,
  },
  questionCard: {
    flex: 1,
    backgroundColor: '#E8F4FF',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#BADBF7',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: '#9CBFDD',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 7,
  },
  cardTopBar: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#6ACFF0',
    marginHorizontal: 2,
    marginBottom: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DDF5FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#3483C9',
    fontWeight: '700',
  },
  questionTitle: {
    fontSize: 19,
    lineHeight: 28,
    color: '#15395D',
    fontWeight: '800',
    marginBottom: 14,
  },
  questionDescription: {
    flex: 1,
    fontSize: 14,
    lineHeight: 24,
    color: '#5A7593',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#C8E3F5',
    paddingTop: 14,
    marginTop: 14,
    gap: 14,
  },
  cardHint: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#8AA6C0',
  },
  percentPill: {
    backgroundColor: '#E8F8FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  percentText: {
    fontSize: 15,
    lineHeight: 18,
    color: '#1AA5D8',
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    height: 58,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D4E7F6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D5E7F7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 2,
  },
  secondaryButtonActive: {
    backgroundColor: '#EFF8FF',
    borderColor: '#94CDF1',
  },
  secondaryButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#35597D',
  },
  secondaryButtonTextActive: {
    color: '#1E75B8',
  },
  primaryButton: {
    flex: 1,
    height: 58,
    borderRadius: 22,
    backgroundColor: '#8BD8FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A7DFFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryButtonActive: {
    backgroundColor: '#68C8F8',
  },
  primaryButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  dot: {
    width: 16,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D4E6F5',
  },
  dotActive: {
    width: 26,
    backgroundColor: '#69CDF0',
  },
});
