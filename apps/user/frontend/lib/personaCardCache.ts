import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SwipeCardAnswer } from '@matcha/shared-types';

export type CachedPromptCard = {
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

export type CachedPersonaCardState = {
  cards: CachedPromptCard[];
  answers: SwipeCardAnswer[];
  expectedBatchSize: number;
  awaitingBatchResponse: boolean;
};

const cardCacheKey = (uid: string) => `persona-card-cache:${uid}`;

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export async function readCachedPersonaCardState(uid: string): Promise<CachedPersonaCardState | null> {
  return safeParse<CachedPersonaCardState>(await AsyncStorage.getItem(cardCacheKey(uid)));
}

export async function writeCachedPersonaCardState(uid: string, state: CachedPersonaCardState): Promise<void> {
  await AsyncStorage.setItem(cardCacheKey(uid), JSON.stringify(state));
}

export async function clearCachedPersonaCardState(uid: string): Promise<void> {
  await AsyncStorage.removeItem(cardCacheKey(uid));
}
