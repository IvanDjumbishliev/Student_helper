import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
  Alert, Modal, FlatList, StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api';
import { useSession } from '../../ctx';
import Markdown from 'react-native-markdown-display'
import Animated, { FadeIn, Layout } from 'react-native-reanimated';

const TOP_PADDING = Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  date: string;
}

export default function ExamTutorScreen() {
  const { session } = useSession();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const currentChat = Array.isArray(sessions) ? sessions.find(s => s.id === currentSessionId) : null;

  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/chat/history`, {
        headers: { 'Authorization': `Bearer ${session}` }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setSessions(data);
      }
    } catch (e) {
      setSessions([]);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setSelectedImage(null);
    setInputText('');
    setMessagesForNewChat();
  };

  const setMessagesForNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: `New Chat ${sessions.length + 1}`,
      date: new Date().toLocaleDateString(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setIsHistoryVisible(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;

    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      targetSessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: targetSessionId,
        title: inputText.substring(0, 20) || "Image Analysis",
        date: new Date().toLocaleDateString(),
        messages: []
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(targetSessionId);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      image: selectedImage?.uri
    };

    updateLocalMessages(targetSessionId, userMsg);
    const b64 = selectedImage?.base64;
    const textToSend = inputText;

    setInputText('');
    setSelectedImage(null);

    await sendToAI(targetSessionId, b64, textToSend);
  };

  const sendToAI = async (sessionId: string, imageB64?: string | null, text?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/chat/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId, image: imageB64, message: text }),
      });

      const data = await response.json();
      if (response.ok) {
        const aiMsg: Message = {
          id: data.id.toString(),
          role: 'assistant',
          content: data.reply
        };
        updateLocalMessages(sessionId, aiMsg);
      }
    } catch (error) {
      Alert.alert("Error", "Server unreachable");
    } finally {
      setLoading(false);
    }
  };

  const updateLocalMessages = (sessionId: string, newMessage: Message) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, newMessage] } : s));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsHistoryVisible(true)}>
          <Ionicons name="menu-outline" size={30} color="#333333" />
        </TouchableOpacity>
        <TouchableOpacity onPress={startNewChat}>
          <Ionicons name="add-circle-outline" size={30} color="#80b48c" />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })} contentContainerStyle={styles.chatList}>
          {!currentChat || currentChat.messages.length === 0 ? (
            <Animated.View entering={FadeIn.duration(600)} style={styles.welcomeContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color="#cbd5e1" />
              <Text style={styles.welcomeTitle}>Нов разговор</Text>
              <Text style={styles.welcomeSub}>Изпратете съобщение!</Text>
            </Animated.View>
          ) : (
            currentChat.messages.map((msg) => (
              <Animated.View
                key={msg.id}
                entering={FadeIn.duration(400)}
                layout={Layout.springify()}
                style={[styles.msgWrapper, msg.role === 'user' ? styles.userRow : styles.aiRow]}
              >
                <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  {msg.image && <Image source={{ uri: msg.image }} style={styles.chatImage} />}
                  <Text style={[styles.msgText, msg.role === 'user' ? styles.userText : styles.aiText]}>
                    <Markdown>{msg.content}</Markdown>
                  </Text>
                </View>
              </Animated.View>
            ))
          )}
          {loading && <ActivityIndicator color="#80b48c" style={{ alignSelf: 'flex-start', marginLeft: 20, marginTop: 10 }} />}
        </ScrollView>

        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage.uri }} style={styles.smallPreview} />
            <TouchableOpacity style={styles.removeImage} onPress={() => setSelectedImage(null)}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        <Animated.View entering={FadeIn.duration(500).delay(200)} style={styles.inputContainer}>
          <TouchableOpacity onPress={handlePickImage} style={styles.attachBtn}>
            <Ionicons name="image-outline" size={28} color="#64748b" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Въведете съобщение..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity style={styles.sendIcon} onPress={handleSendMessage}>
            <Ionicons name="paper-plane" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>

      <Modal visible={isHistoryVisible} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sidebar}>
            <Text style={styles.sidebarHeader}>История</Text>
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.historyCard, currentSessionId === item.id && styles.activeCard]}
                  onPress={() => { setCurrentSessionId(item.id); setIsHistoryVisible(false); }}
                >
                  <Ionicons name="chatbox-ellipses-outline" size={20} color="#80b48c" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{item.title === 'New Chat' ? 'Нов разговор' : item.title}</Text>
                    <Text style={styles.historyDate}>{item.date}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeSidebar} onPress={() => setIsHistoryVisible(false)}>
              <Text style={styles.closeText}>Затвори</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsHistoryVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: TOP_PADDING },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: '#c0cfd0', backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333333' },
  chatList: { padding: 15, paddingBottom: 30 },
  msgWrapper: { marginBottom: 15, width: '100%' },
  userRow: { alignItems: 'flex-end' },
  aiRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 20 },
  userBubble: { backgroundColor: '#80b48c' },
  aiBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, borderWidth: 1, borderColor: '#f0f4f2' },
  msgText: { fontSize: 16, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: '#333333' },
  chatImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 8 },
  imagePreviewContainer: { padding: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  smallPreview: { width: 60, height: 60, borderRadius: 8 },
  removeImage: { position: 'absolute', top: 5, left: 65 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#c0cfd0' },
  attachBtn: { marginRight: 10 },
  textInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 24, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, maxHeight: 100, borderWidth: 1, borderColor: '#c0cfd0', color: '#333333' },
  sendIcon: { backgroundColor: '#80b48c', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  welcomeContainer: { alignItems: 'center', marginTop: 120, paddingHorizontal: 40 },
  welcomeTitle: { fontSize: 24, fontWeight: '900', color: '#333333', marginTop: 15 },
  welcomeSub: { textAlign: 'center', color: '#666666', marginTop: 8, fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  sidebar: { width: '75%', backgroundColor: '#f5f5f5', padding: 25, paddingTop: 50 },
  sidebarHeader: { fontSize: 24, fontWeight: '900', marginBottom: 20, color: '#333333' },
  historyCard: { flexDirection: 'row', padding: 15, borderRadius: 16, marginBottom: 8, backgroundColor: '#fff', elevation: 1 },
  activeCard: { backgroundColor: '#c0cfd0', borderWidth: 1, borderColor: '#80b48c' },
  historyTitle: { fontWeight: '700', color: '#333333' },
  historyDate: { fontSize: 11, color: '#666666' },
  closeSidebar: { marginTop: 'auto', alignSelf: 'center', padding: 15 },
  closeText: { color: '#80b48c', fontWeight: '900', fontSize: 16 }
});