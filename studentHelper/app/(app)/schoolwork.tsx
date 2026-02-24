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
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

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
                    setViewSubtitle(data.topic || (data.type === 'past_exam' ? 'Exam Review' : 'Homework Help'));
                } else {
                    Alert.alert("Error", "Could not load analysis.");
                    resetForm();
                }
            } catch (e) {
                console.log(e);
                Alert.alert("Error", "Network error.");
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
        if (!permission.granted) return Alert.alert('Permission Denied', 'Camera access is needed.');

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
        if (!subject) return Alert.alert("Missing Info", "Please enter a subject.");

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
                setViewSubtitle("Analysis Result");
                setMode('view');
            } else {
                Alert.alert("Error", data.error || "Analysis failed.");
            }
        } catch (e) {
            console.log(e);
            Alert.alert("Error", "Network request failed.");
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'view') {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#2563eb', '#1e40af']} style={styles.headerGradient}>
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

                {loadingView ? <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 50 }} /> : (
                    <View style={styles.resultContainer}>
                        <ScrollView style={styles.resultScroll} contentContainerStyle={{ paddingBottom: 40 }}>
                            <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.markdownBox}>
                                <Markdown style={markdownStyles}>{analysisContent}</Markdown>
                            </Animated.View>
                        </ScrollView>
                    </View>
                )}
            </View>
        )
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
                <Animated.View entering={FadeInDown.duration(600)} style={styles.heroSection}>
                    <Text style={styles.heroTitle}>Schoolwork AI</Text>
                    <Text style={styles.heroSubtitle}>Get expert insights instantly.</Text>
                </Animated.View>

                <Animated.View entering={ZoomIn.duration(500).delay(100)} style={styles.card}>
                    <View style={styles.typeSelector}>
                        {(['past_exam', 'project', 'homework'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.typeBtn, type === t && styles.typeBtnSelected]}
                                onPress={() => setType(t)}
                            >
                                {type === t && <View style={styles.activeDot} />}
                                <Text style={[styles.typeText, type === t && styles.typeTextSelected]}>
                                    {t === 'past_exam' ? 'Exam Review' : t.charAt(0).toUpperCase() + t.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Subject</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Mathematics"
                        placeholderTextColor="#94a3b8"
                        value={subject}
                        onChangeText={setSubject}
                    />

                    {type === 'past_exam' && (
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.label}>Grade Evaluated</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. B+"
                                    placeholderTextColor="#94a3b8"
                                    value={grade}
                                    onChangeText={setGrade}
                                />
                            </View>
                        </View>
                    )}

                    {(type === 'project' || type === 'homework') && (
                        <>
                            <Text style={styles.label}>Topic</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Specific topic or title..."
                                placeholderTextColor="#94a3b8"
                                value={topic}
                                onChangeText={setTopic}
                            />
                        </>
                    )}

                    <Text style={styles.label}>
                        {type === 'past_exam' ? 'Mistakes & Context' : 'Details & Requirements'}
                    </Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Type your notes here..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        value={type === 'past_exam' ? mistakes : notes}
                        onChangeText={type === 'past_exam' ? setMistakes : setNotes}
                    />

                    <Text style={styles.label}>Attachments</Text>
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
                            colors={['#2563eb', '#1d4ed8']}
                            style={styles.gradientBtn}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.submitText}>Analyze with AI</Text>
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
    body: { fontSize: 16, color: '#334155', lineHeight: 26 },
    heading1: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 24, marginBottom: 12, letterSpacing: -0.5 },
    heading2: { fontSize: 22, fontWeight: '700', color: '#2563eb', marginTop: 20, marginBottom: 10, letterSpacing: -0.3 },
    heading3: { fontSize: 18, fontWeight: '700', color: '#475569', marginTop: 16, marginBottom: 8 },
    strong: { fontWeight: '700', color: '#0f172a' },
    link: { color: '#2563eb', textDecorationLine: 'underline' },
    list_item: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start' },
    bullet_list_icon: { color: '#2563eb', fontSize: 22, marginRight: 8, marginTop: -2 },
    blockquote: { backgroundColor: '#f0f9ff', padding: 16, borderLeftWidth: 4, borderLeftColor: '#2563eb', marginVertical: 12, borderRadius: 8 },
    code_inline: { backgroundColor: '#f1f5f9', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, color: '#e11d48', fontSize: 14, overflow: 'hidden' },
    code_block: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginVertical: 12 },
    fence: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginVertical: 12, color: '#f8fafc' },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerGradient: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 5 },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, marginRight: 15 },
    viewTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    viewSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    resultContainer: { flex: 1, backgroundColor: '#f1f5f9' },
    resultScroll: { flex: 1, padding: 20 },
    markdownBox: { backgroundColor: '#fff', borderRadius: 24, padding: 24, minHeight: 400, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 40 },

    heroSection: { paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingHorizontal: 25, paddingBottom: 30 },
    heroTitle: { fontSize: 32, fontWeight: '900', color: '#1e293b', letterSpacing: -1 },
    heroSubtitle: { fontSize: 16, color: '#64748b', marginTop: 5 },

    card: { backgroundColor: '#fff', borderRadius: 30, padding: 25, marginHorizontal: 20, shadowColor: '#64748b', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, marginBottom: 20 },

    typeSelector: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 16, padding: 5, marginBottom: 25 },
    typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, flexDirection: 'row', justifyContent: 'center' },
    typeBtnSelected: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    typeText: { fontWeight: '600', color: '#94a3b8', fontSize: 13 },
    typeTextSelected: { color: '#1e293b', fontWeight: '800' },
    activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb', marginRight: 6 },

    label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, fontSize: 16, color: '#1e293b' },
    textArea: { height: 120, textAlignVertical: 'top' },
    row: { flexDirection: 'row' },

    attachScroll: { flexDirection: 'row', marginTop: 5, marginBottom: 15 },
    addImgBtn: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', marginRight: 10 },
    imgPreview: { width: 80, height: 80, borderRadius: 16, overflow: 'hidden', marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    previewImage: { width: '100%', height: '100%' },
    removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', borderRadius: 8, padding: 4 },

    gradientBtn: { padding: 18, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    submitText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});
