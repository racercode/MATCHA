import { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/containers/hooks/useAuth';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import CustomButton from '@/components/CustomButton';
import Loading from '@/components/Loading';

type AuthMode = 'signin' | 'register';

const getAuthErrorMessage = (error: any) => {
  const code = error?.code as string | undefined;
  switch (code) {
    case 'auth/invalid-credential':
      return '帳號或密碼錯誤';
    case 'auth/email-already-in-use':
      return '這個 Email 已經被註冊';
    case 'auth/weak-password':
      return '密碼至少需要 6 個字元';
    case 'auth/user-not-found':
      return '找不到此帳號';
    case 'auth/wrong-password':
      return '密碼錯誤';
    case 'auth/invalid-email':
      return 'Email 格式不正確';
    case 'auth/too-many-requests':
      return '嘗試次數過多，請稍後再試';
    case 'auth/network-request-failed':
      return '網路連線失敗，請確認網路後重試';
    case 'auth/operation-not-allowed':
      return 'Firebase 尚未啟用此登入方式';
    default:
      return error?.message ?? '請稍後再試';
  }
};

const LoginScreen = () => {
  const { user, isInitialized, loadingMessage, isGoogleSignInAvailable, register, signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  useEffect(() => {
    if (isInitialized && user) {
      router.replace('/');
    }
  }, [isInitialized, user, router]);

  if (!isInitialized) return <Loading />;

  const handleSignIn = async () => {
    if (submitLockRef.current || isSubmitting) return;

    if (!email || !password) {
      Alert.alert('請輸入 Email 和密碼');
      return;
    }

    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('登入失敗', 'Email 格式不正確');
      return;
    }

    Keyboard.dismiss();
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await signIn(normalizedEmail, password);
    } catch (e: any) {
      Alert.alert('登入失敗', getAuthErrorMessage(e));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (submitLockRef.current || isSubmitting) return;

    if (!email || !password || !confirmPassword) {
      Alert.alert('請完整輸入註冊資訊');
      return;
    }

    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('註冊失敗', 'Email 格式不正確');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('註冊失敗', '兩次輸入的密碼不一致');
      return;
    }

    if (password.length < 6) {
      Alert.alert('註冊失敗', '密碼至少需要 6 個字元');
      return;
    }

    Keyboard.dismiss();
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await register(normalizedEmail, password);
    } catch (e: any) {
      Alert.alert('註冊失敗', getAuthErrorMessage(e));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (submitLockRef.current || isSubmitting) return;

    Keyboard.dismiss();
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Google 登入失敗', getAuthErrorMessage(e));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    Keyboard.dismiss();
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <>
      {loadingMessage != null && <Loading text={loadingMessage} opacity={false} />}
      <LinearGradient
        colors={['#65A1FB', '#F9FBFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.container}
      >
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            bounces={false}
            contentInsetAdjustmentBehavior="always"
          >
            <View style={styles.inner}>
              <Text style={styles.logo}>🍵 Matcha</Text>

              <View style={styles.modeRow}>
                <View style={styles.segmentedControl}>
                  <Pressable
                    onPress={() => switchMode('signin')}
                    style={[styles.segmentButton, mode === 'signin' && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentText, mode === 'signin' && styles.segmentTextActive]}>Login</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => switchMode('register')}
                    style={[styles.segmentButton, mode === 'register' && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>Signup</Text>
                  </Pressable>
                </View>
              </View>

              <ThemedTextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                inputMode="email"
                autoComplete="email"
                textContentType="emailAddress"
                autoCorrect={false}
                returnKeyType="next"
              />
              <ThemedTextInput
                style={styles.input}
                placeholder="密碼"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                secureTextEntry
                returnKeyType={mode === 'register' ? 'next' : 'done'}
              />
              {mode === 'register' ? (
                <ThemedTextInput
                  style={styles.input}
                  placeholder="確認密碼"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              ) : null}

              <CustomButton
                title={mode === 'signin' ? '登入' : '註冊'}
                onPress={mode === 'signin' ? handleSignIn : handleRegister}
                state={isSubmitting ? 'disabled' : 'default'}
                style={{ width: 120, height: 56, marginTop: 8 }}
                textStyle={{ fontSize: 16 }}
                paddingHorizontal={10}
                paddingVertical={8}
              />
              <CustomButton
                title="使用 Google 登入"
                onPress={handleGoogleSignIn}
                state={isGoogleSignInAvailable && !isSubmitting ? 'default' : 'disabled'}
                style={{ width: 200, height: 48, marginTop: 4, backgroundColor: '#fff' }}
                textStyle={{ fontSize: 14, color: '#333' }}
                paddingHorizontal={10}
                paddingVertical={8}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  keyboardContainer: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 24,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  modeRow: {
    marginBottom: 10,
  },
  segmentedControl: {
    width: 280,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7DEEA',
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#8CCBFF',
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  segmentTextActive: {
    color: '#0B3A63',
  },
  input: {
    width: 280,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 0,
  },
});
