import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform, StatusBar, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Calendar } from 'react-native-calendars';
import { API_URL } from '../../config/api';
import { useSession } from '../../ctx';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Layout, FadeIn } from 'react-native-reanimated';

const { height } = Dimensions.get('window');
const TOP_PADDING = Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10;

type EventType = 'homework' | 'test' | 'project';

interface CalendarEvent {
  id: number;
  type: EventType;
  description: string;
}

export default function CalendarScreen() {
  const { session } = useSession();
  const [isScanning, setIsScanning] = useState(false);
  const [markedDates, setMarkedDates] = useState({});
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventType, setEventType] = useState<EventType>('homework');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [extractedResults, setExtractedResults] = useState<any[]>([]);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [session]);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/events`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session}`
        }
      });
      const data = await response.json();
      setEvents(data || {});
      updateMarkedDates(data || {});
    } catch (error) {
      console.error(error);
    }
  };

  const updateMarkedDates = (eventsData: Record<string, CalendarEvent[]>) => {
    const marked: Record<string, any> = {};
    Object.keys(eventsData).forEach(date => {
      const dayEvents = eventsData[date];
      let dotColor = '#4A90E2';
      if (dayEvents.some(e => e.type === 'test')) dotColor = '#FF6B6B';
      else if (dayEvents.some(e => e.type === 'project')) dotColor = '#FFA500';
      marked[date] = { marked: true, dotColor };
    });
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: '#a0bfb9',
    };
    setMarkedDates(marked);
  };

  const handleAIScan = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (Platform.OS === 'web') alert('Camera access required.');
      else Alert.alert('Отказ', 'Нужен е достъп до камерата.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.4,
    });

    if (!result.canceled && result.assets[0].base64) {
      setIsScanning(true);
      try {
        const response = await fetch(`${API_URL}/chat/extract-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session}`,
          },
          body: JSON.stringify({ image: result.assets[0].base64 }),
        });
        const data = await response.json();
        if (response.ok) {
          setExtractedResults(data.events || []);
          setShowSuccessPopup(true);
          fetchEvents();
        } else {
          Alert.alert("Грешка", "Не успяхме да разчетем снимката.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const processDeletion = async (eventToDelete: CalendarEvent) => {
    try {
      const response = await fetch(`${API_URL}/events/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session}`
        },
        body: JSON.stringify({
          id: eventToDelete.id,
          date: selectedDate,
          description: eventToDelete.description
        }),
      });
      if (response.ok) {
        fetchEvents();
        if (editingEvent?.id === eventToDelete.id) handleCloseForm();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteEvent = async (eventToDelete: CalendarEvent) => {
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm("Сигурни ли сте, че искате да изтриете това събитие?");
      if (confirmDelete) await processDeletion(eventToDelete);
    } else {
      Alert.alert("Изтриване", "Сигурни ли сте?", [
        { text: "Отказ", style: "cancel" },
        { text: "Изтрий", style: "destructive", onPress: () => processDeletion(eventToDelete) }
      ]);
    }
  };

  const handleAddEvent = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate < today) return;
    if (!description.trim()) return;

    try {
      if (editingEvent && editingDate) {
        await fetch(`${API_URL}/events/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session}`
          },
          body: JSON.stringify({
            id: editingEvent.id,
            date: editingDate,
            description: editingEvent.description
          }),
        });
      }

      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session}`
        },
        body: JSON.stringify({
          date: selectedDate,
          type: eventType,
          description: description.trim(),
        }),
      });

      if (response.ok) {
        handleCloseForm();
        fetchEvents();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditingDate(selectedDate);
    setDescription(event.description);
    setEventType(event.type);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEvent(null);
    setEditingDate(null);
    setDescription('');
    setEventType('homework');
  };

  const handleDateSelect = (day: any) => {
    setSelectedDate(day.dateString);
    updateMarkedDates(events);
  };

  const getEventColor = (type: EventType) => {
    const colors = { test: '#80b48c', project: '#a0bfb9', homework: '#c0cfd0' };
    return colors[type] || '#a0bfb9';
  };

  const dayEvents = events[selectedDate] || [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <Animated.View entering={FadeIn.duration(600)}>
          <Calendar
            markedDates={markedDates}
            onDayPress={handleDateSelect}
            theme={{
              todayTextColor: '#80b48c',
              selectedDayBackgroundColor: '#a0bfb9',
              arrowColor: '#80b48c',
              calendarBackground: '#fff',
              textSectionTitleColor: '#333333',
              selectedDayTextColor: '#ffffff',
              dayTextColor: '#333333',
              textDisabledColor: '#d9e1e8',
              dotColor: '#a0bfb9',
              selectedDotColor: '#ffffff',
              monthTextColor: '#333333',
              indicatorColor: '#80b48c',
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: 'bold',
            }}
          />
        </Animated.View>

        {showForm ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.formContainer}>
            <Text style={styles.label}>Дата: {selectedDate}</Text>
            <View style={styles.typeButtonsContainer}>
              {(['homework', 'test', 'project'] as EventType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, { backgroundColor: eventType === type ? getEventColor(type) : '#e0e0e0' }]}
                  onPress={() => setEventType(type)}
                >
                  <Text style={{ color: eventType === type ? '#fff' : '#333', fontWeight: 'bold' }}>
                    {type === 'homework' ? 'Домашно' : type === 'test' ? 'Тест' : 'Проект'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Описание на задачата..."
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleAddEvent}>
              <Text style={styles.submitButtonText}>{editingEvent ? 'Промени' : 'Запази'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCloseForm}>
              <Text style={styles.cancelButtonText}>Отказ</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#80b48c' }]} onPress={() => setShowForm(true)}>
                <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.buttonText}>Ръчно добавяне</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#a0bfb9' }]} onPress={handleAIScan} disabled={isScanning}>
                {isScanning ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="camera" size={20} color="#fff" style={{ marginRight: 5 }} />
                    <Text style={styles.buttonText}>Снимка на графика</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {dayEvents.length > 0 && (
              <View style={styles.eventsListContainer}>
                <Text style={styles.eventsTitle}>Събития за {selectedDate}:</Text>
                {dayEvents.map((event, index) => (
                  <Animated.View key={event.id} entering={FadeIn.delay(index * 100)} layout={Layout.springify()} style={[styles.eventItem, { borderLeftColor: getEventColor(event.type) }]}>
                    <View style={styles.eventContent}>
                      <View style={styles.eventTextContainer}>
                        <Text style={[styles.eventType, { color: getEventColor(event.type) }]}>{event.type.toUpperCase()}</Text>
                        <Text style={styles.eventDescription}>{event.description}</Text>
                      </View>
                      <View style={styles.eventActions}>
                        <TouchableOpacity onPress={() => handleEdit(event)} style={styles.actionIconButton}>
                          <Ionicons name="pencil" size={18} color="#666" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteEvent(event)} style={[styles.actionIconButton, { backgroundColor: '#FFF5F5' }]}>
                          <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {showSuccessPopup && (
        <Animated.View entering={FadeIn} style={styles.popupOverlay}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.popupCard}>
            <View style={styles.popupHeader}>
              <Ionicons name="checkmark-circle" size={28} color="#10b981" />
              <Text style={styles.popupTitle}>Успешно извличане!</Text>
            </View>
            <Text style={styles.popupSubtitle}>
              {extractedResults.length > 0
                ? `Открихме ${extractedResults.length} нови събития в графика:`
                : "Не бяха открити събития в тази снимка."}
            </Text>
            <ScrollView style={styles.popupList} showsVerticalScrollIndicator={false}>
              {extractedResults.map((item, idx) => (
                <View key={idx} style={styles.popupItem}>
                  <View style={[styles.typeIndicator, { backgroundColor: getEventColor(item.type) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.popupItemDate}>{item.date}</Text>
                    <Text style={styles.popupItemDesc}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.popupButton} onPress={() => setShowSuccessPopup(false)}>
              <Text style={styles.popupButtonText}>Разбрах</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: TOP_PADDING },
  buttonRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 20, gap: 12 },
  actionButton: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
  formContainer: { padding: 25, backgroundColor: '#fff', marginTop: 20, marginHorizontal: 20, borderRadius: 24, elevation: 5, borderWidth: 1, borderColor: '#c0cfd0' },
  label: { fontSize: 16, fontWeight: '900', marginBottom: 15, color: '#333333' },
  typeButtonsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#c0cfd0', borderRadius: 14, padding: 15, backgroundColor: '#f1f5f9', minHeight: 100, textAlignVertical: 'top', color: '#333333', fontSize: 16 },
  submitButton: { backgroundColor: '#80b48c', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 15, elevation: 3 },
  submitButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancelButton: { backgroundColor: '#fff', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#c0cfd0' },
  cancelButtonText: { color: '#666666', fontWeight: '900', fontSize: 16 },
  eventsListContainer: { marginTop: 25, paddingHorizontal: 20, paddingBottom: 60 },
  eventsTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, color: '#333333' },
  eventItem: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, borderLeftWidth: 6, elevation: 3, shadowOpacity: 0.05, shadowRadius: 10, overflow: 'hidden' },
  eventContent: { flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  eventTextContainer: { flex: 1 },
  eventType: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  eventDescription: { fontSize: 15, color: '#333333', fontWeight: '600', marginTop: 2 },
  eventActions: { flexDirection: 'row', gap: 10 },
  actionIconButton: { padding: 10, borderRadius: 14, backgroundColor: '#f1f5f9' },
  popupOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 20 },
  popupCard: { backgroundColor: '#ffffff', width: '100%', borderRadius: 32, padding: 25, maxHeight: height * 0.7, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15, borderWidth: 1, borderColor: '#c0cfd0' },
  popupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  popupTitle: { fontSize: 24, fontWeight: '900', color: '#333333' },
  popupSubtitle: { color: '#666666', fontSize: 15, marginBottom: 20, lineHeight: 22, fontWeight: '500' },
  popupList: { marginBottom: 20 },
  popupItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 15 },
  typeIndicator: { width: 5, height: 40, borderRadius: 3 },
  popupItemDate: { fontSize: 12, color: '#666666', fontWeight: 'bold', marginBottom: 2 },
  popupItemDesc: { fontSize: 15, color: '#333333', fontWeight: '700' },
  popupButton: { backgroundColor: '#80b48c', paddingVertical: 18, borderRadius: 18, alignItems: 'center', elevation: 4 },
  popupButtonText: { color: '#fff', fontWeight: '900', fontSize: 18 }
});