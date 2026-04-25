import { useCallback, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export interface UserProfileData {
  name: string;
  bio: string;
  school?: string;
  grade?: string;
  birthday?: string;
  avatar: string;
}

const getProfileRef = (userId: string) => doc(db, 'userProfiles', userId);

export const useProfile = () => {
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string): Promise<Partial<UserProfileData> | null> => {
    setLoading(true);
    try {
      const snapshot = await getDoc(getProfileRef(userId));
      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();
      return {
        name: typeof data.name === 'string' ? data.name : '',
        bio: typeof data.bio === 'string' ? data.bio : '',
        school: typeof data.school === 'string' ? data.school : '',
        grade: typeof data.grade === 'string' ? data.grade : '',
        birthday: typeof data.birthday === 'string' ? data.birthday : '',
        avatar: typeof data.avatar === 'string' ? data.avatar : '',
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (userId: string, profileData: Partial<UserProfileData>) => {
    setLoading(true);
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        await updateAuthProfile(auth.currentUser, {
          displayName: profileData.name ?? auth.currentUser.displayName ?? undefined,
          photoURL: profileData.avatar ?? auth.currentUser.photoURL ?? undefined,
        });
      }

      await setDoc(
        getProfileRef(userId),
        {
          ...profileData,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      return profileData;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadAvatar = useCallback(async (_userId: string, avatarUri: string) => {
    setLoading(true);
    try {
      // This project does not yet have remote image storage, so we persist the picked URI directly.
      return avatarUri;
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
