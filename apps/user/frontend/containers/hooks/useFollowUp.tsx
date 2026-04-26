import { useCallback, useState } from 'react';
import { auth } from '@/lib/firebase';
import { postResourceFollowUp } from '@/lib/api';

export type FollowUpMessage = {
  role: 'user' | 'agent' | 'error';
  text: string;
};

export function useFollowUp() {
  const [conversations, setConversations] = useState<Map<string, FollowUpMessage[]>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  const getMessages = useCallback(
    (replyId: string) => conversations.get(replyId) ?? [],
    [conversations],
  );

  const isLoading = useCallback(
    (replyId: string) => loadingKeys.has(replyId),
    [loadingKeys],
  );

  const sendQuestion = useCallback(async (replyId: string, resourceId: string, question: string) => {
    setConversations(prev => {
      const next = new Map(prev);
      next.set(replyId, [...(prev.get(replyId) ?? []), { role: 'user', text: question }]);
      return next;
    });
    setLoadingKeys(prev => new Set(prev).add(replyId));

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('未登入');
      const result = await postResourceFollowUp(token, { resourceId, replyId, question });
      setConversations(prev => {
        const next = new Map(prev);
        next.set(replyId, [...(prev.get(replyId) ?? []), { role: 'agent', text: result.answer }]);
        return next;
      });
    } catch {
      setConversations(prev => {
        const next = new Map(prev);
        next.set(replyId, [...(prev.get(replyId) ?? []), { role: 'error', text: '抱歉，發生錯誤，請稍後再試。' }]);
        return next;
      });
    } finally {
      setLoadingKeys(prev => {
        const next = new Set(prev);
        next.delete(replyId);
        return next;
      });
    }
  }, []);

  return { getMessages, isLoading, sendQuestion };
}
