import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, Platform, KeyboardAvoidingView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../ctx';
import { API_URL } from '../../config/api';
import Markdown from 'react-native-markdown-display';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function SchoolworkAnalysisScreen() {
    const { session } = useSession();
    const params = useLocalSearchParams();
    const router = useRouter();

    const [mode, setMode] = useState<'create' | 'view'>('create');

    // Create Mode State
    const [type, setType] = useState<'past_exam' | 'project' | 'homework'>('past_exam');
    const [subject, setSubject] = useState('');
    const [grade, setGrade] = useState('');
    const [mistakes, setMistakes] = useState('');
    const [notes, setNotes] = useState('');
    const [topic, setTopic] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // View Mode State
    const [analysisContent, setAnalysisContent] = useState<string | null>(null);
    const [viewTitle, setViewTitle] = useState('');
    const [viewSubtitle, setViewSubtitle] = useState('');
    const [loadingView, setLoadingView] = useState(false);

    const resetForm = useCallback(() => {
        setMode('create');
        setAnalysisContent(null);
        setSubject('');
        setGrade('');
        setMistakes('');
        setNotes('');
        setTopic('');
        setImages([]);
        router.setParams({ analysisId: '' });
    }, [router]);

    useEffect(() => {
        const loadAnalysis = async (id: string) => {
            setMode('view');
            setLoadingView(true);
            try {
                const res = await fetch(`${API_URL}/schoolwork/${id}`, {
                    headers: { 'Authorization': `Bearer ${session}` }
                });
                const data = await res.json();
                if (res.ok) {
                    setAnalysisContent(data.content);
                    setViewTitle(data.subject);
                    setViewSubtitle(data.topic || (data.type === 'past_exam' ? 'Преглед на изпит' : 'Помощ за домашно'));
                } else {
                    Alert.alert("Грешка", "Неуспешно зареждане на анализа.");
                    resetForm();
                }
            } catch (e) {
                console.log(e);
                Alert.alert("Грешка", "Проблем с мрежата.");
                resetForm();
            } finally {
                setLoadingView(false);
            }
        };

        if (params.analysisId) {
            loadAnalysis(params.analysisId as string);
        } else {
            // If coming from "Analysis" button on Home, we are in create mode by default
            if (params.mode === 'create') {
                resetForm();
            }
        }
    }, [params.analysisId, resetForm, session, params.mode]);

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert('Отказ', 'Нужен е достъп до камерата.');

        const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
        if (!result.canceled && result.assets[0].base64) {
            setImages([...images, result.assets[0].base64]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);
    };

    const submitAnalysis = async () => {
        if (!subject) return Alert.alert("Липсваща информация", "Моля въведете предмет.");

        setLoading(true);
        try {
            const payload = { type, subject, grade, mistakes, notes, topic, images };
            const response = await fetch(`${API_URL}/chat/analyze-schoolwork`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session}` },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                setAnalysisContent(data.analysis);
                setViewTitle(subject);
                setViewSubtitle("Резултат от анализа");
                setMode('view');
            } else {
                Alert.alert("Грешка", data.error || "Анализа беше неуспешен.");
            }
        } catch (e) {
            console.log(e);
            Alert.alert("Грешка", "Неуспешна заявка.");
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'view') {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#a0bfb9', '#c0cfd0']} style={styles.headerGradient}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity onPress={resetForm} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.viewTitle} numberOfLines={1}>{viewTitle}</Text>
                            <Text style={styles.viewSubtitle} numberOfLines={1}>{viewSubtitle}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {loadingView ? <ActivityIndicator size="large" color="#80b48c" style={{ marginTop: 50 }} /> : (
                    <View style={styles.resultContainer}>
                        <ScrollView style={styles.resultScroll} contentContainerStyle={{ paddingBottom: 40 }}>
                            <Animated.View entering={FadeIn.duration(600)} style={styles.markdownBox}>
                                <Markdown style={markdownStyles}>{analysisContent}</Markdown>
                            </Animated.View>
                        </ScrollView>
                    </View>
                )}
            </View>
        )
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
                <Animated.View entering={FadeIn.duration(600)} style={styles.heroSection}>
                    <Text style={styles.heroTitle}>ИА Училищна Помощ</Text>
                    <Text style={styles.heroSubtitle}>Получете експертни оценки моментално.</Text>
                </Animated.View>

                <Animated.View entering={FadeIn.duration(500).delay(100)} style={styles.card}>
                    <View style={styles.typeSelector}>
                        {(['past_exam', 'project', 'homework'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.typeBtn, type === t && styles.typeBtnSelected]}
                                onPress={() => setType(t)}
                            >
                                {type === t && <View style={styles.activeDot} />}
                                <Text style={[styles.typeText, type === t && styles.typeTextSelected]}>
                                    {t === 'past_exam' ? 'Стар изпит' : t === 'project' ? 'Проект' : 'Домашно'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Предмет</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="напр. Математика"
                        placeholderTextColor="#94a3b8"
                        value={subject}
                        onChangeText={setSubject}
                    />

                    {type === 'past_exam' && (
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.label}>Оценка (ако е имало)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="напр. B+ или 5"
                                    placeholderTextColor="#94a3b8"
                                    value={grade}
                                    onChangeText={setGrade}
                                />
                            </View>
                        </View>
                    )}

                    {(type === 'project' || type === 'homework') && (
                        <>
                            <Text style={styles.label}>Тема</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Специфична тема или заглавие..."
                                placeholderTextColor="#94a3b8"
                                value={topic}
                                onChangeText={setTopic}
                            />
                        </>
                    )}

                    <Text style={styles.label}>
                        {type === 'past_exam' ? 'Грешки и Контекст' : 'Детайли и Изисквания'}
                    </Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Напишете вашите бележки тук..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        value={type === 'past_exam' ? mistakes : notes}
                        onChangeText={type === 'past_exam' ? setMistakes : setNotes}
                    />

                    <Text style={styles.label}>Прикачени файлове</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachScroll}>
                        <TouchableOpacity style={styles.addImgBtn} onPress={takePhoto}>
                            <Ionicons name="camera" size={24} color="#64748b" />
                        </TouchableOpacity>
                        {images.map((img, i) => (
                            <View key={i} style={styles.imgPreview}>
                                <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={styles.previewImage} />
                                <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(i)}>
                                    <Ionicons name="close" size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        onPress={submitAnalysis}
                        disabled={loading}
                        style={{ marginTop: 20 }}
                    >
                        <LinearGradient
                            colors={['#80b48c', '#a0bfb9']}
                            style={styles.gradientBtn}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.submitText}>Анализирай с ИА</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const markdownStyles = StyleSheet.create({
    body: { fontSize: 16, color: '#333333', lineHeight: 26 },
    heading1: { fontSize: 28, fontWeight: '900', color: '#333333', marginTop: 24, marginBottom: 12, letterSpacing: -0.5 },
    heading2: { fontSize: 22, fontWeight: '800', color: '#80b48c', marginTop: 20, marginBottom: 10, letterSpacing: -0.3 },
    heading3: { fontSize: 18, fontWeight: '700', color: '#444444', marginTop: 16, marginBottom: 8 },
    strong: { fontWeight: '700', color: '#111111' },
    link: { color: '#80b48c', textDecorationLine: 'underline' },
    list_item: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start' },
    bullet_list_icon: { color: '#80b48c', fontSize: 22, marginRight: 8, marginTop: -2 },
    blockquote: { backgroundColor: '#f1f5f9', padding: 16, borderLeftWidth: 4, borderLeftColor: '#80b48c', marginVertical: 12, borderRadius: 8 },
    code_inline: { backgroundColor: '#f1f5f9', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, color: '#ef4444', fontSize: 14, overflow: 'hidden' },
    code_block: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginVertical: 12 },
    fence: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginVertical: 12, color: '#f8fafc' },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    headerGradient: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15 },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 14, marginRight: 15 },
    viewTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
    viewSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontWeight: '500' },

    resultContainer: { flex: 1, backgroundColor: '#f5f5f5' },
    resultScroll: { flex: 1, padding: 20 },
    markdownBox: { backgroundColor: '#fff', borderRadius: 28, padding: 25, minHeight: 400, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 4, marginBottom: 40 },

    heroSection: { paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingHorizontal: 25, paddingBottom: 30 },
    heroTitle: { fontSize: 34, fontWeight: '900', color: '#333333', letterSpacing: -1 },
    heroSubtitle: { fontSize: 16, color: '#666666', marginTop: 5, fontWeight: '500' },

    card: { backgroundColor: '#fff', borderRadius: 32, padding: 25, marginHorizontal: 20, shadowColor: '#a0bfb9', shadowOpacity: 0.15, shadowRadius: 20, elevation: 12, marginBottom: 40 },

    typeSelector: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 18, padding: 6, marginBottom: 25 },
    typeBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'center' },
    typeBtnSelected: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
    typeText: { fontWeight: '700', color: '#666666', fontSize: 13 },
    typeTextSelected: { color: '#333333', fontWeight: '900' },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#80b48c', marginRight: 8 },

    label: { fontSize: 12, fontWeight: '900', color: '#666666', marginBottom: 10, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#c0cfd0', borderRadius: 18, padding: 18, fontSize: 16, color: '#333333' },
    textArea: { height: 140, textAlignVertical: 'top' },
    row: { flexDirection: 'row' },

    attachScroll: { flexDirection: 'row', marginTop: 10, marginBottom: 20 },
    addImgBtn: { width: 85, height: 85, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#c0cfd0', borderStyle: 'dashed', marginRight: 12 },
    imgPreview: { width: 85, height: 85, borderRadius: 18, overflow: 'hidden', marginRight: 12, borderWidth: 1, borderColor: '#c0cfd0' },
    previewImage: { width: '100%', height: '100%' },
    removeBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: '#ef4444', borderRadius: 10, padding: 5 },

    gradientBtn: { padding: 20, borderRadius: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 6, shadowColor: '#80b48c', shadowOpacity: 0.3, shadowRadius: 10 },
    submitText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
});
