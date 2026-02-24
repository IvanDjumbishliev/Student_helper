import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { useSession } from '../../ctx';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api';
import Animated, {
  FadeIn,
  useSharedValue, useAnimatedStyle, withSpring
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const TOP_PADDING = Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10;

function AnimatedLinkBtn({ onPress, color, icon, text }: { onPress: () => void, color: string, icon: any, text: string }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPressIn={() => scale.value = withSpring(0.95)}
      onPressOut={() => scale.value = withSpring(1)}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.actionBtn, animatedStyle]}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.actionText}>{text}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HomePage() {
  const { signOut, session } = useSession();
  const router = useRouter();
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [scores, setScores] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recents, setRecents] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchUpcomingEvents();
      fetchScores();
      fetchRecents();
    }, [session])
  );

  const fetchRecents = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/schoolwork/recents`, {
        headers: { 'Authorization': `Bearer ${session}` }
      });
      if (res.status === 401 || res.status === 422) {
        signOut();
        return;
      }
      const data = await res.json();
      if (res.ok) setRecents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUpcomingEvents = async () => {
    if (!session) return;
    try {
      const response = await fetch(`${API_URL}/events`, {
        headers: { 'Authorization': `Bearer ${session}` }
      });
      if (response.status === 401 || response.status === 422) {
        signOut();
        return;
      }
      const data = await response.json();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const formatted = Object.keys(data).flatMap(dateStr => {
        const eventDate = new Date(dateStr + "T00:00:00");

        const diffTime = eventDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          return data[dateStr].map((event: any) => ({
            ...event,
            date: dateStr,
            daysLeft: diffDays
          }));
        }
        return [];
      }).sort((a, b) => a.daysLeft - b.daysLeft);

      setUpcomingEvents(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async () => {
    if (!session) return;
    try {
      const response = await fetch(`${API_URL}/recent-scores`, {
        headers: { 'Authorization': `Bearer ${session}` }
      });
      if (response.status === 401 || response.status === 422) {
        signOut();
        return;
      }
      const data = await response.json();
      setScores(data);
    } catch (e) {
      console.error("Failed to fetch scores", e);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.replace('/sign-in');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
        <View>
          <Text style={styles.greeting}>Здравейте, отново!</Text>
          <Text style={styles.subGreeting}>Имате {upcomingEvents.length} предстоящи задачи.</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color="#80b48c" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(600).delay(200)} style={styles.mainCard}>
        <LinearGradient
          colors={['#a0bfb9', '#c0cfd0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <Text style={styles.cardLabel}>СЛЕДВАЩО СЪБИТИЕ</Text>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 20 }} />
          ) : upcomingEvents.length > 0 ? (
            <>
              <Text style={styles.countdownDays}>
                {upcomingEvents[0].daysLeft === 0 ? "ДНЕС" : `${upcomingEvents[0].daysLeft} Дена`}
              </Text>
              <Text style={styles.countdownTarget} numberOfLines={1}>{upcomingEvents[0].description}</Text>
            </>
          ) : (
            <Text style={styles.countdownTarget}>Всичко е готово!</Text>
          )}
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(600).delay(400)} style={styles.actionGrid}>
        <AnimatedLinkBtn onPress={() => router.push('/AiChat')} color="#80b48c" icon="chatbubble-ellipses" text="Задайте въпрос" />
        <AnimatedLinkBtn onPress={() => router.push({ pathname: '/schoolwork', params: { mode: 'create' } })} color="#a0bfb9" icon="sparkles" text="Анализи" />
        <AnimatedLinkBtn onPress={() => router.push('/calendar')} color="#c0cfd0" icon="calendar" text="Календар" />
      </Animated.View>

      {recents.length > 0 && (
        <Animated.View entering={FadeIn.duration(600).delay(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Насоки и статистики</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 20 }}>
            {recents.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.recentCard}
                onPress={() => router.push({ pathname: '/schoolwork', params: { analysisId: item.id } })}
              >
                <View style={styles.recentHeader}>
                  <Ionicons name="sparkles" size={16} color="#fbbf24" />
                  <Text style={styles.recentDate}>{item.date}</Text>
                </View>
                <Text style={styles.recentSubject} numberOfLines={1}>{item.subject}</Text>
                <Text style={styles.recentDesc} numberOfLines={2}>
                  {item.topic || item.type.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ width: 40 }} />
          </ScrollView>
        </Animated.View>
      )}

      <Animated.View entering={FadeIn.duration(600).delay(600)} style={styles.listSection}>
        <Text style={styles.sectionTitle}>График</Text>
        {upcomingEvents.slice(1, 4).map((item, index) => (
          <Animated.View key={index} entering={FadeIn.delay(index * 100 + 700)} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.itemDate}>{item.date}</Text>
            </View>
            <View style={styles.daysTag}>
              <Text style={styles.daysTagText}>{item.daysLeft}д</Text>
            </View>
          </Animated.View>
        ))}
      </Animated.View>


      <Animated.View entering={FadeIn.duration(600).delay(800)} style={styles.scoreSection}>
        <Text style={styles.sectionTitle}>Представяне</Text>
        <View style={styles.scoreCard}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{scores?.total_tests || 0}</Text>
            <Text style={styles.scoreLabel}>Направени тестове</Text>
          </View>
          <View style={[styles.scoreItem, styles.scoreBorder]}>
            <Text style={[styles.scoreValue, { color: (scores?.avg_percentage || 0) <= 50 ? '#ef4444' : '#10b981' }]}>
              {scores?.avg_percentage || 0}%
            </Text>
            <Text style={styles.scoreLabel}>Средна оценка</Text>
          </View>
        </View>
      </Animated.View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: TOP_PADDING },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#333333' },
  subGreeting: { color: '#666666', fontSize: 14, fontWeight: '500' },
  logoutBtn: { padding: 10, backgroundColor: '#fff', borderRadius: 14, elevation: 2 },
  mainCard: { margin: 20, borderRadius: 32, overflow: 'hidden', elevation: 8, shadowColor: '#a0bfb9', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  gradientCard: { padding: 25 },
  cardLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  countdownDays: { color: '#fff', fontSize: 42, fontWeight: '900', marginVertical: 5 },
  countdownTarget: { color: '#fff', fontSize: 18, fontWeight: '600' },
  actionGrid: { flexDirection: 'row', paddingHorizontal: 20, gap: 15 },
  actionBtn: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 24, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  actionText: { marginTop: 8, fontWeight: '700', color: '#333333', fontSize: 12 },
  section: { marginTop: 30 },
  listSection: { paddingHorizontal: 20, paddingVertical: 10, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333333', marginBottom: 15, paddingHorizontal: 20 },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#333333' },
  itemDate: { fontSize: 12, color: '#666666', marginTop: 2 },
  daysTag: { backgroundColor: '#f0f4f2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  daysTagText: { fontWeight: 'bold', color: '#80b48c', fontSize: 12 },
  scoreSection: { paddingHorizontal: 20, marginBottom: 30 },
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreBorder: { borderLeftWidth: 1, borderLeftColor: '#f5f5f5' },
  scoreValue: { fontSize: 26, fontWeight: '900', color: '#333333' },
  scoreLabel: { fontSize: 12, color: '#666666', marginTop: 4, fontWeight: '600' },
  recentCard: {
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginRight: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  recentDate: { fontSize: 10, color: '#666666', fontWeight: 'bold' },
  recentSubject: { fontSize: 14, fontWeight: 'bold', color: '#333333', marginBottom: 4 },
  recentDesc: { fontSize: 12, color: '#666666' }
});