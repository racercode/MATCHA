import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { AuthUser } from '@matcha/shared-types';
import { auth } from '@/lib/firebase';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  user: AuthUser | null;
  isInitialized: boolean;
  loadingMessage: string | undefined;
  isGoogleSignInAvailable: boolean;
  register: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const readEnv = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const getGoogleConfig = () => {
  const expoClientId = readEnv(process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID);
  const webClientId = readEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ?? expoClientId;
  const iosClientId = readEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) ?? expoClientId;
  const androidClientId = readEnv(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ?? expoClientId;

  return {
    expoClientId,
    webClientId,
    iosClientId,
    androidClientId,
  };
};

type AuthProviderInnerProps = {
  children: React.ReactNode;
  googleRequest: Google.AuthRequest | null;
  googlePromptAsync?: ReturnType<typeof Google.useAuthRequest>[2];
  isGoogleSignInAvailable: boolean;
};

const AuthProviderInner = ({
  children,
  googleRequest,
  googlePromptAsync,
  isGoogleSignInAvailable,
}: AuthProviderInnerProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // role 先 hardcode 'citizen'；之後 Milestone 2 查 Firestore /gov_staff/{uid}
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? undefined,
          displayName: firebaseUser.displayName ?? undefined,
          photoURL: firebaseUser.photoURL ?? undefined,
          role: 'citizen',
        });
      } else {
        setUser(null);
      }
      setIsInitialized(true);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoadingMessage('登入中...');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('[Auth] 登入成功', result.user.uid, result.user.email);
    } catch (e: any) {
      console.error('[Auth] 登入失敗', e.code, e.message);
      throw e;
    } finally {
      setLoadingMessage(undefined);
    }
  };

  const signInWithGoogle = async () => {
    setLoadingMessage('Google 登入中...');
    try {
      let result;

      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        result = await signInWithPopup(auth, provider);
      } else {
        if (!isGoogleSignInAvailable || !googlePromptAsync) {
          const platformEnvName =
            Platform.OS === 'ios'
              ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
              : 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID';
          throw new Error(`缺少 ${platformEnvName}`);
        }

        if (!googleRequest) {
          throw new Error('Google 登入尚未初始化，請稍後再試');
        }

        const authResult = await googlePromptAsync();
        if (authResult.type !== 'success') {
          throw new Error('Google 登入已取消或失敗');
        }

        const idToken = authResult.authentication?.idToken ?? authResult.params?.id_token;
        if (!idToken) {
          throw new Error('Google 登入失敗：無法取得 idToken');
        }

        const credential = GoogleAuthProvider.credential(idToken);
        result = await signInWithCredential(auth, credential);
      }

      console.log('[Auth] Google 登入成功', result.user.uid, result.user.email);
    } catch (e: any) {
      console.error('[Auth] Google 登入失敗', e.code, e.message);
      throw e;
    } finally {
      setLoadingMessage(undefined);
    }
  };

  const signOut = async () => {
    setLoadingMessage('登出中...');
    try {
      await firebaseSignOut(auth);
    } finally {
      setLoadingMessage(undefined);
    }
  };

  const register = async (email: string, password: string) => {
    setLoadingMessage('註冊中...');
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log('[Auth] 註冊成功', result.user.uid, result.user.email);
    } catch (e: any) {
      console.error('[Auth] 註冊失敗', e.code, e.message);
      throw e;
    } finally {
      setLoadingMessage(undefined);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isInitialized,
        loadingMessage,
        isGoogleSignInAvailable,
        register,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const AuthProviderWithGoogle = ({ children }: { children: React.ReactNode }) => {
  const googleConfig = getGoogleConfig();
  const [googleRequest, , googlePromptAsync] = Google.useAuthRequest({
    clientId: googleConfig.expoClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    webClientId: googleConfig.webClientId,
  });

  return (
    <AuthProviderInner googleRequest={googleRequest} googlePromptAsync={googlePromptAsync} isGoogleSignInAvailable>
      {children}
    </AuthProviderInner>
  );
};

const AuthProviderWithoutGoogle = ({ children }: { children: React.ReactNode }) => (
  <AuthProviderInner googleRequest={null} isGoogleSignInAvailable={false}>
    {children}
  </AuthProviderInner>
);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const googleConfig = getGoogleConfig();
  const isGoogleSignInAvailable =
    Platform.OS === 'web'
      ? Boolean(googleConfig.webClientId)
      : Platform.OS === 'ios'
        ? Boolean(googleConfig.iosClientId)
        : Boolean(googleConfig.androidClientId);

  if (isGoogleSignInAvailable) {
    return <AuthProviderWithGoogle>{children}</AuthProviderWithGoogle>;
  }

  return <AuthProviderWithoutGoogle>{children}</AuthProviderWithoutGoogle>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
