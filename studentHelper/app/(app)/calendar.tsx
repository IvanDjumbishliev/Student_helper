import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform, StatusBar } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Calendar } from 'react-native-calendars';
import { API_URL } from '../../config/api';
import { useSession } from '../../ctx';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn, FadeInRight, Layout } from 'react-native-reanimated';

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
      selectedColor: '#00adf5',
    };
    setMarkedDates(marked);
  };

  const handleAIScan = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (Platform.OS === 'web') alert('Camera access required.');
      else Alert.alert('Permission Denied', 'Camera access required.');
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
        if (response.ok) {
          fetchEvents();
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
      const confirmDelete = window.confirm("Are you sure you want to remove this event?");
      if (confirmDelete) {
        await processDeletion(eventToDelete);
      }
    } else {
      Alert.alert("Delete Event", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => processDeletion(eventToDelete) }
      ]);
    }
  };

  const handleAddEvent = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate < today) {
      return;
    }
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
    const colors = { test: '#FF6B6B', project: '#FFA500', homework: '#4A90E2' };
    return colors[type] || '#999';
  };

  const dayEvents = events[selectedDate] || [];

  return (
    <ScrollView style={styles.container}>
      <Animated.View entering={ZoomIn.duration(600)}>
        <Calendar
          markedDates={markedDates}
          onDayPress={handleDateSelect}
          theme={{
            todayTextColor: '#00adf5',
            selectedDayBackgroundColor: '#00adf5',
            arrowColor: '#00adf5',
          }}
        />
      </Animated.View>

      {showForm ? (
        <Animated.View entering={FadeInDown} style={styles.formContainer}>
          <Text style={styles.label}>Дата: {selectedDate}</Text>
          <View style={styles.typeButtonsContainer}>
            {(['homework', 'test', 'project'] as EventType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, { backgroundColor: eventType === type ? getEventColor(type) : '#e0e0e0' }]}
                onPress={() => setEventType(type)}
              >
                <Text style={{ color: eventType === type ? '#fff' : '#333', fontWeight: 'bold' }}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Описание..."
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
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#00adf5' }]} onPress={() => setShowForm(true)}>
              <Text style={styles.buttonText}>Ръчно добавяне</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#6200ee' }]} onPress={handleAIScan} disabled={isScanning}>
              {isScanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Снимка на графика</Text>}
            </TouchableOpacity>
          </View>

          {dayEvents.length > 0 && (
            <View style={styles.eventsListContainer}>
              <Text style={styles.eventsTitle}>Събития за {selectedDate}:</Text>
              {dayEvents.map((event, index) => (
                <Animated.View key={event.id} entering={FadeInRight.delay(index * 100)} layout={Layout.springify()} style={[styles.eventItem, { borderLeftColor: getEventColor(event.type) }]}>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: TOP_PADDING },
  buttonRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 20, gap: 10 },
  actionButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  formContainer: { padding: 20, backgroundColor: '#f5f5f5', marginTop: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  typeButtonsContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  typeButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#fff', minHeight: 80, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#00adf5', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#fff', fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#ccc', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  cancelButtonText: { color: '#333', fontWeight: 'bold' },
  eventsListContainer: { marginTop: 20, paddingHorizontal: 20, paddingBottom: 40 },
  eventsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  eventItem: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderLeftWidth: 5, elevation: 2, shadowOpacity: 0.1, overflow: 'hidden' },
  eventContent: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  eventTextContainer: { flex: 1 },
  eventType: { fontSize: 10, fontWeight: '800' },
  eventDescription: { fontSize: 15, color: '#2d3748' },
  eventActions: { flexDirection: 'row', gap: 8 },
  actionIconButton: { padding: 8, borderRadius: 20, backgroundColor: '#f7fafc' }
});