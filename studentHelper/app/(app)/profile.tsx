import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useSession } from '../../ctx';
import { API_URL } from '../../config/api';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

const { width } = Dimensions.get('window');

interface Stats {
  total_tests: number;
  avg_percentage: number;
  total_analyses: number;
  total_events: number;
}

interface Activity {
  id: string | number;
  type: string;
  subject: string;
  date: string;
}

export default function Profile() {
  const { session, signOut } = useSession();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ total_tests: 0, avg_percentage: 0, total_analyses: 0, total_events: 0 });
  const [activities, setActivities] = useState<Activity[]>([]);

  const fetchProfileData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${session}` };

      // 1. Fetch User Info
      const infoRes = await fetch(`${API_URL}/auth/myInfo`, { headers });
      if (infoRes.status === 401 || infoRes.status === 422) {
        signOut();
        return;
      }
      const infoData = await infoRes.json();
      if (infoRes.ok) {
        setEmail(infoData.email);
        setProfilePic(infoData.profile_pic);
      }

      // 2. Fetch Stats
      const statsRes = await fetch(`${API_URL}/recent-scores`, { headers });
      const statsData = await statsRes.json();

      // 3. Fetch Recent Analyses
      const analysesRes = await fetch(`${API_URL}/schoolwork/recents`, { headers });
      const analysesData = await analysesRes.json();

      // 4. Fetch Events for count
      const eventsRes = await fetch(`${API_URL}/events`, { headers });
      const eventsData = await eventsRes.json();
      let eventCount = 0;
      Object.values(eventsData).forEach((dayEvents: any) => eventCount += dayEvents.length);

      setStats({
        total_tests: statsData.total_tests || 0,
        avg_percentage: statsData.avg_percentage || 0,
        total_analyses: analysesData.length || 0,
        total_events: eventCount,
      });

      setActivities(analysesData.slice(0, 3));
    } catch (err) {
      console.log("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Грешка', 'Моля попълнете двете полета за парола');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Грешка', 'Паролите не съвпадат');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/change_password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.status === 401 || res.status === 422) {
        signOut();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      Alert.alert('Success', 'Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change password');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setUploading(true);
      try {
        const res = await fetch(`${API_URL}/auth/update_profile_pic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
          body: JSON.stringify({ profile_pic: base64Image }),
        });

        if (res.status === 401 || res.status === 422) {
          signOut();
          return;
        }

        if (res.ok) {
          setProfilePic(base64Image);
          Alert.alert('Success', 'Profile picture updated successfully');
        } else {
          throw new Error('Upload failed');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to upload profile picture');
      } finally {
        setUploading(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a0bfb9" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#a0bfb9', '#c0cfd0']} style={styles.header}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.headerContent}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={pickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#a0bfb9" />
            ) : profilePic ? (
              <Image source={{ uri: profilePic! }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={40} color="#c0cfd0" />
            )}
            <View style={styles.editIconContainer}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userEmail}>{email}</Text>
          <Text style={styles.userBadge}>Ученик</Text>
        </Animated.View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Stats Grid */}
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.statsGrid}>
          <StatCard title="Тестове" value={stats.total_tests} icon="document-text" color="#80b48c" />
          <StatCard title="Ср. Оценка" value={`${stats.avg_percentage}%`} icon="trending-up" color="#a0bfb9" />
          <StatCard title="Анализи" value={stats.total_analyses} icon="sparkles" color="#c0cfd0" />
          <StatCard title="Събития" value={stats.total_events} icon="calendar" color="#a0bfb9" />
        </Animated.View>

        {/* Recent Activity */}
        <Animated.Text entering={FadeIn.delay(300).duration(600)} style={styles.sectionTitle}>Скорошна дейност</Animated.Text>
        {activities.length > 0 ? (
          <View style={styles.activityList}>
            {activities.map((act, index) => (
              <Animated.View key={act.id} entering={FadeIn.delay(400 + index * 100)}>
                <View style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: '#f0f4f2' }]}>
                    <Ionicons name="book" size={20} color="#80b48c" />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityType}>{act.type.replace('_', ' ').toUpperCase() === 'ESSAY' ? 'ЕСЕ' : act.type.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.activitySubject}>{act.subject}</Text>
                  </View>
                  <Text style={styles.activityDate}>{act.date}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Няма скорошна дейност.</Text>
        )}

        {/* Settings */}
        <Animated.Text entering={FadeIn.delay(500).duration(600)} style={styles.sectionTitle}>Настройки на акаунта</Animated.Text>
        <Animated.View entering={FadeIn.delay(600).duration(600)} style={styles.settingsCard}>
          <Text style={styles.label}>Промяна на паролата</Text>
          <TextInput
            placeholder="Нова парола"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={styles.input}
          />
          <TextInput
            placeholder="Потвърдете парола"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
          />
          <TouchableOpacity style={styles.button} onPress={changePassword}>
            <Text style={styles.buttonText}>Промяна на паролата</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.logout} onPress={signOut}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>Изход</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 80,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editIconContainer: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: '#80b48c',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userEmail: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userBadge: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    padding: 20,
    marginTop: -20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    backgroundColor: '#fff',
    width: (width - 60) / 2,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
  },
  statTitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginTop: 10,
    marginBottom: 15,
  },
  activityList: {
    marginBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 0.5,
  },
  activitySubject: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  activityDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  settingsCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c0cfd0',
    borderRadius: 14,
    padding: 15,
    marginBottom: 15,
    fontSize: 15,
    color: '#333333',
  },
  button: {
    backgroundColor: '#80b48c',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 5,
    elevation: 4,
    shadowColor: '#80b48c',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 20,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 16,
  },
});