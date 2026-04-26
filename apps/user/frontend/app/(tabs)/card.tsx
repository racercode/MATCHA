import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NotificationBell from '@/components/NotificationBell';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { ClientEvent, ServerEvent, SwipeCard, SwipeCardAnswer } from '@matcha/shared-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Loading from '@/components/Loading';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { auth } from '@/lib/firebase';
import { WS_URL } from '@/lib/api';
import { useAuth } from '@/containers/hooks/useAuth';
import {
  clearCachedPersonaCardState,
  readCachedPersonaCardState,
  writeCachedPersonaCardState,
} from '@/lib/personaCardCache';

type ChoiceKey = 'no' | 'yes' | null;
type PromptCard = {
  cardId: string;
  badge?: string;
  title: string;
  description?: string;
  hint?: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
};

const SWIPE_THRESHOLD = 80;
const REQUEST_CARD_MESSAGE = 'generate_swipe_card';

const buildAuthedWsUrl = async () => {
  const token = await auth.currentUser?.getIdToken();
  return token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
};

const toPromptCard = (card: SwipeCard): PromptCard => {
  return {
    cardId: card.cardId,
    title: card.question,
    leftLabel: card.leftLabel,
    rightLabel: card.rightLabel,
    leftValue: card.leftValue,
    rightValue: card.rightValue,
  };
};

export default function CardScreen() {
  const { top } = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [cards, setCards] = useState<PromptCard[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<ChoiceKey>(null);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const wsRef = useRef<WebSocket | null>(null);
  const currentCardRef = useRef<PromptCard | null>(null);
  const cardsRef = useRef<PromptCard[]>([]);
  const requestPendingRef = useRef(false);
  const batchAnswersRef = useRef<SwipeCardAnswer[]>([]);
  const receivedBatchCountRef = useRef(0);
  const expectedBatchSizeRef = useRef(0);
  const awaitingBatchResponseRef = useRef(false);
  const restoreCompleteRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  const currentPrompt = useMemo(() => cards[0] ?? null, [cards]);

  useEffect(() => {
    currentCardRef.current = currentPrompt;
  }, [currentPrompt]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const persistCardState = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;

    const hasState =
      cardsRef.current.length > 0 ||
      batchAnswersRef.current.length > 0 ||
      awaitingBatchResponseRef.current;

    if (!hasState) {
      await clearCachedPersonaCardState(uid);
      return;
    }

    await writeCachedPersonaCardState(uid, {
      cards: cardsRef.current,
      answers: batchAnswersRef.current,
      expectedBatchSize: expectedBatchSizeRef.current,
      awaitingBatchResponse: awaitingBatchResponseRef.current,
    });
  }, []);

  // Keep currentUserIdRef in sync for persistCardState (which can't use closure over uid)
  currentUserIdRef.current = uid;

  const requestNextCard = useCallback(() => {
    if (requestPendingRef.current) {
      console.log('[card] requestNextCard skipped: request already pending');
      return;
    }
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.log('[card] requestNextCard skipped: WS not open, readyState=', wsRef.current?.readyState);
      return;
    }

    batchAnswersRef.current = [];
    receivedBatchCountRef.current = 0;
    expectedBatchSizeRef.current = 0;
    requestPendingRef.current = true;
    setIsLoadingCards(true);
    console.log('[card] sending swipe_card_request');
    const event: ClientEvent = { type: 'swipe_card_request', content: REQUEST_CARD_MESSAGE };
    wsRef.current.send(JSON.stringify(event));
    void persistCardState();
  }, [persistCardState]);

  const submitBatchAnswers = useCallback(() => {
    if (awaitingBatchResponseRef.current) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (batchAnswersRef.current.length === 0) return;

    awaitingBatchResponseRef.current = true;
    const event: ClientEvent = {
      type: 'swipe_card_batch_answer',
      answers: batchAnswersRef.current,
    };
    wsRef.current.send(JSON.stringify(event));
    void persistCardState();
  }, [persistCardState]);

  const maybeSubmitBatchAnswers = useCallback(() => {
    const expectedBatchSize = expectedBatchSizeRef.current;
    if (requestPendingRef.current) return;
    if (cardsRef.current.length > 0) return;
    if (expectedBatchSize <= 0) return;
    if (batchAnswersRef.current.length < expectedBatchSize) return;

    submitBatchAnswers();
  }, [submitBatchAnswers]);

  const maybeRecoverCardFlow = useCallback(() => {
    if (cardsRef.current.length > 0) return;

    if (requestPendingRef.current || awaitingBatchResponseRef.current) {
      setIsLoadingCards(true);
      return;
    }

    const expectedBatchSize = expectedBatchSizeRef.current;
    const answeredCount = batchAnswersRef.current.length;

    if (expectedBatchSize > 0) {
      if (answeredCount >= expectedBatchSize) {
        setIsLoadingCards(true);
        submitBatchAnswers();
      }
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      requestNextCard();
    }
  }, [requestNextCard, submitBatchAnswers]);

  useEffect(() => {
    if (!uid) {
      restoreCompleteRef.current = true;
      return;
    }

    let isMounted = true;
    restoreCompleteRef.current = false;

    (async () => {
      const cached = await readCachedPersonaCardState(uid);
      if (!isMounted) return;

      if (!cached) {
        restoreCompleteRef.current = true;
        if (wsRef.current?.readyState === WebSocket.OPEN && cardsRef.current.length === 0) {
          requestNextCard();
        }
        return;
      }

      cardsRef.current = cached.cards;
      batchAnswersRef.current = cached.answers;
      expectedBatchSizeRef.current = cached.expectedBatchSize;
      awaitingBatchResponseRef.current = cached.awaitingBatchResponse;
      setCards(cached.cards);
      restoreCompleteRef.current = true;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (cached.awaitingBatchResponse && cached.answers.length > 0) {
          awaitingBatchResponseRef.current = false;
          submitBatchAnswers();
        } else if (cached.cards.length === 0) {
          requestNextCard();
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [uid, requestNextCard, submitBatchAnswers]);

  const showNextCard = () => {
    setCards((prev) => {
      const next = prev.slice(1);
      cardsRef.current = next;
      if (next.length === 0) {
        setIsLoadingCards(true);
      }
      return next;
    });
    setSelectedChoice(null);
    position.setValue({ x: 0, y: 0 });
    void persistCardState();
  };

  const advanceCard = (choice: Exclude<ChoiceKey, null>) => {
    const activeCard = currentCardRef.current;
    if (!activeCard) return;

    setSelectedChoice(choice);
    const toX = choice === 'yes' ? 400 : -400;
    Animated.timing(position, {
      toValue: { x: toX, y: 0 },
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      const direction = choice === 'yes' ? 'right' : 'left';
      const value = choice === 'yes' ? activeCard.rightValue : activeCard.leftValue;
      batchAnswersRef.current = [
        ...batchAnswersRef.current,
        { cardId: activeCard.cardId, direction, value },
      ];
      showNextCard();
      void persistCardState();
      maybeSubmitBatchAnswers();
    });
  };

  useEffect(() => {
    if (!uid) return;

    let isActive = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (!isActive) return;
      const wsUrl = await buildAuthedWsUrl();
      if (!isActive) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[card] WS open');
        if (!restoreCompleteRef.current) {
          console.log('[card] WS open but restore not complete, waiting');
          return;
        }

        if (awaitingBatchResponseRef.current && batchAnswersRef.current.length > 0) {
          awaitingBatchResponseRef.current = false;
          submitBatchAnswers();
          return;
        }

        if (cardsRef.current.length === 0) {
          requestNextCard();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data);
          console.log('[card] WS message type:', data.type);

          if (data.type === 'swipe_card') {
            console.log('[card] received swipe_card:', data.card.cardId);
            setIsLoadingCards(false);
            receivedBatchCountRef.current += 1;
            setCards((prev) => {
              if (prev.some((card) => card.cardId === data.card.cardId)) {
                return prev;
              }
              const next = [...prev, toPromptCard(data.card)];
              cardsRef.current = next;
              void persistCardState();
              return next;
            });
          }

          if (data.type === 'agent_reply' && data.done) {
            const wasAwaitingBatchResponse = awaitingBatchResponseRef.current;
            const cardsReceived = receivedBatchCountRef.current;
            console.log(`[card] agent_reply done, cards=${cardsReceived}, awaitingBatch=${wasAwaitingBatchResponse}`);
            requestPendingRef.current = false;

            if (cardsReceived > 0) {
              expectedBatchSizeRef.current = cardsReceived;
              receivedBatchCountRef.current = 0;
              void persistCardState();
            }

            maybeSubmitBatchAnswers();

            if (wasAwaitingBatchResponse) {
              awaitingBatchResponseRef.current = false;
              batchAnswersRef.current = [];
              expectedBatchSizeRef.current = 0;
              void persistCardState();
              requestNextCard();
              return;
            }

            // Agent returned no cards — retry after 4s
            if (cardsReceived === 0 && !wasAwaitingBatchResponse) {
              console.warn('[card] 0 cards received, retrying in 4s');
              setIsLoadingCards(true);
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  requestNextCard();
                } else {
                  setIsLoadingCards(false);
                }
              }, 4000);
            }
          }

          if (data.type === 'error') {
            console.error('[card] server error:', (data as { code?: string; message?: string }).code, (data as { message?: string }).message);
            requestPendingRef.current = false;
            awaitingBatchResponseRef.current = false;
            setIsLoadingCards(false);
            void persistCardState();
            // Retry after error if no cards in queue
            if (cardsRef.current.length === 0) {
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) requestNextCard();
              }, 3000);
            }
          }
        } catch (e) {
          console.error('[card] failed to parse WS message:', e);
          requestPendingRef.current = false;
          void persistCardState();
        }
      };

      ws.onclose = (e) => {
        console.log('[card] WS closed, code=', e.code, 'reason=', e.reason);
        if (wsRef.current === ws) wsRef.current = null;
        requestPendingRef.current = false;
        awaitingBatchResponseRef.current = false;
        setIsLoadingCards(false);
        void persistCardState();
        if (isActive) {
          console.log('[card] reconnecting in 3s...');
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    void connect();

    return () => {
      isActive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      requestPendingRef.current = false;
      void persistCardState();
    };
  }, [uid, maybeSubmitBatchAnswers, persistCardState, requestNextCard, submitBatchAnswers]);

  useEffect(() => {
    if (!uid) return;
    maybeRecoverCardFlow();
  }, [cards, uid, maybeRecoverCardFlow]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(currentCardRef.current),
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
    setCards((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = prev.slice(index);
      cardsRef.current = next;
      if (next.length === 0) {
        setIsLoadingCards(true);
      }
      return next;
    });
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
          <NotificationBell />
        </View>

        <View style={styles.stage}>
          {isLoadingCards && cards.length === 0 ? (
            <View style={styles.loadingCard}>
              <Loading text="AI 正在生成新的問題…" contentStyle={styles.loadingContent} />
            </View>
          ) : (
            <>
              <View style={[styles.stackCard, styles.stackCardBack]} />
              <View style={[styles.stackCard, styles.stackCardMiddle]} />
            </>
          )}

          <Animated.View
            style={[
              styles.questionCard,
              isLoadingCards && cards.length === 0 && styles.questionCardHidden,
              { transform: [{ translateX: position.x }, { rotate: cardRotate }] },
            ]}
            {...panResponder.panHandlers}>
            <View style={styles.cardTopBar} />
            {currentPrompt?.badge ? (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{currentPrompt.badge}</ThemedText>
              </View>
            ) : null}

            <ThemedText style={styles.questionTitle}>{currentPrompt?.title ?? ''}</ThemedText>
            {currentPrompt?.description ? (
              <ThemedText style={styles.questionDescription}>{currentPrompt.description}</ThemedText>
            ) : (
              <View style={styles.questionDescription} />
            )}

            {currentPrompt?.hint ? (
              <View style={styles.cardFooter}>
                <ThemedText style={styles.cardHint}>{currentPrompt.hint}</ThemedText>
                <View style={styles.percentPill}>
                  <ThemedText style={styles.percentText}>+15%</ThemedText>
                </View>
              </View>
            ) : null}
          </Animated.View>

        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.secondaryButton, selectedChoice === 'no' && styles.secondaryButtonActive]}
            onPress={() => advanceCard('no')}>
            <ThemedText style={[styles.secondaryButtonText, selectedChoice === 'no' && styles.secondaryButtonTextActive]}>
              ← {currentPrompt?.leftLabel ?? ''}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.primaryButton, selectedChoice === 'yes' && styles.primaryButtonActive]}
            onPress={() => advanceCard('yes')}>
            <ThemedText style={styles.primaryButtonText}>{currentPrompt?.rightLabel ?? ''} →</ThemedText>
          </Pressable>
        </View>

        <View style={styles.dotsRow}>
          {cards.map((prompt, index) => (
            <Pressable
              key={prompt.cardId}
              onPress={() => goToPrompt(index)}
              style={[styles.dot, index === 0 && styles.dotActive]}
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
  loadingCard: {
    flex: 1,
    position: 'relative',
  },
  loadingContent: {
    transform: [{ translateY: 110 }],
  },
  questionCardHidden: {
    opacity: 0,
    pointerEvents: 'none' as const,
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
