import { useCallback, useState } from 'react';
import { auth } from '@/lib/firebase';
import { API_BASE_URL } from '@/lib/api';

export interface UserProfileData {
  name: string;
  bio: string;
  school?: string;
  grade?: string;
  birthday?: string;
  avatar: string;
}

const buildAuthedHeaders = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

export const useProfile = () => {
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async (_userId: string): Promise<Partial<UserProfileData> | null> => {
    setLoading(true);
    try {
      const headers = await buildAuthedHeaders();
      const res = await fetch(`${API_BASE_URL}/me/profile`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) return null;
      return json.data as Partial<UserProfileData> | null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (_userId: string, profileData: Partial<UserProfileData>) => {
    setLoading(true);
    try {
      const headers = await buildAuthedHeaders();
      const res = await fetch(`${API_BASE_URL}/me/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(profileData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? '更新失敗');
      return profileData;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadAvatar = useCallback(async (_userId: string, avatarUri: string): Promise<string> => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const ext = avatarUri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const form = new FormData();
      form.append('avatar', { uri: avatarUri, name: `avatar.${ext}`, type: `image/${ext}` } as any);
      const res = await fetch(`${API_BASE_URL}/me/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? '上傳失敗');
      return json.data.avatar as string;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loadProfile,
    updateProfile,
    uploadAvatar,
    loading,
  };
};
