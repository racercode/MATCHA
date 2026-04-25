import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useProfile, type UserProfileData } from '@/containers/hooks/useProfile';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userData: UserProfileData;
  onProfileUpdated: (updatedData: UserProfileData) => void;
  userId: string;
}

export default function EditProfileModal({
  visible,
  onClose,
  userData,
  onProfileUpdated,
  userId,
}: EditProfileModalProps) {
  const [name, setName] = useState(userData.name);
  const [bio, setBio] = useState(userData.bio);
  const [school, setSchool] = useState(userData.school || '');
  const [grade, setGrade] = useState(userData.grade || '');
  const [birthday, setBirthday] = useState(userData.birthday || '');
  const [avatarUri, setAvatarUri] = useState(userData.avatar);
  const { updateProfile, uploadAvatar, loading } = useProfile();

  useEffect(() => {
    if (!visible) return;
    setName(userData.name);
    setBio(userData.bio);
    setSchool(userData.school || '');
    setGrade(userData.grade || '');
    setBirthday(userData.birthday || '');
    setAvatarUri(userData.avatar);
  }, [userData, visible]);

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('權限不足', '需要相簿權限才能選擇照片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[EditProfileModal] 選擇圖片失敗', error);
      Alert.alert('錯誤', '選擇圖片失敗');
    }
  };

  const handleCancel = () => {
    setName(userData.name);
    setBio(userData.bio);
    setSchool(userData.school || '');
    setGrade(userData.grade || '');
    setBirthday(userData.birthday || '');
    setAvatarUri(userData.avatar);
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('錯誤', '名字不能為空');
      return;
    }

    try {
      let nextAvatar = avatarUri;
      if (avatarUri && avatarUri !== userData.avatar) {
        nextAvatar = await uploadAvatar(userId, avatarUri);
      }

      await updateProfile(userId, {
        name: name.trim(),
        bio: bio.trim(),
        school: school.trim(),
        grade: grade.trim(),
        birthday: birthday.trim(),
        avatar: nextAvatar,
      });

      const updatedData: UserProfileData = {
        name: name.trim(),
        bio: bio.trim(),
        school: school.trim(),
        grade: grade.trim(),
        birthday: birthday.trim(),
        avatar: nextAvatar,
      };

      onProfileUpdated(updatedData);
      Alert.alert('成功', '資料已更新');
      onClose();
    } catch (error: any) {
      Alert.alert('錯誤', error?.message || '更新失敗，請稍後再試');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCancel}>
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBanner} />

          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer} activeOpacity={0.85}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>顯示名稱</ThemedText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="輸入顯示名稱"
                  placeholderTextColor="#CCC"
                />
                <ThemedText style={styles.helperText}>這個版本先直接儲存，不做 30 天限制</ThemedText>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>自我介紹</ThemedText>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="介紹一下你自己..."
                placeholderTextColor="#CCC"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>學校</ThemedText>
              <TextInput
                style={styles.input}
                value={school}
                onChangeText={setSchool}
                placeholder="輸入學校"
                placeholderTextColor="#CCC"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>年級</ThemedText>
              <TextInput
                style={styles.input}
                value={grade}
                onChangeText={setGrade}
                placeholder="輸入年級"
                placeholderTextColor="#CCC"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>生日</ThemedText>
              <TextInput
                style={styles.input}
                value={birthday}
                onChangeText={setBirthday}
                placeholder="輸入生日 (例：2000/01/01)"
                placeholderTextColor="#CCC"
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel} disabled={loading}>
              <ThemedText style={styles.cancelButtonText}>取消</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave} disabled={loading}>
              <ThemedText style={styles.saveButtonText}>{loading ? '儲存中⋯⋯' : '儲存'}</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topBanner: {
    height: 120,
    backgroundColor: '#E0F7FA',
  },
  avatarSection: {
    paddingHorizontal: 20,
    marginTop: -40,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D3D3D3',
  },
  formSection: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  label: {
    width: 80,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#000',
    marginTop: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    flex: 1,
    backgroundColor: '#FDF6E3',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#888',
    marginTop: 4,
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginTop: 40,
    marginBottom: 20,
    gap: 12,
  },
  button: {
    width: '45%',
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#D9E2FF',
  },
  saveButton: {
    backgroundColor: '#2B6CB0',
  },
  cancelButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#5C80B8',
  },
  saveButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#FFF',
  },
});
