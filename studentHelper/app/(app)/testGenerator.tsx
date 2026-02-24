import React, { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  TextInput, ActivityIndicator, Alert, Platform, StatusBar, KeyboardAvoidingView
} from 'react-native';
import { useSession } from '../../ctx';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '../../config/api';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Layout, FadeIn } from 'react-native-reanimated';

const TOP_PADDING = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 10;

export default function TestGeneratorScreen() {
  const { session, signOut } = useSession();

  const [upcomingTests, setUpcomingTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [context, setContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [images, setImages] = useState<string[]>([]);


  const [quiz, setQuiz] = useState<any[] | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchTests();
    }, [])
  );

  const fetchTests = async () => {
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

      const tests = Object.keys(data).flatMap(date =>
        data[date].filter((e: any) => e.type === 'test')
          .map((e: any) => ({ ...e, date }))
      );
      setUpcomingTests(tests);
    } catch (e) {
      Alert.alert("Грешка", "Неуспешно зареждане на предстоящите тестове.");
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    if (images.length >= 2) {
      return Alert.alert("Лимит достигнат", "Може да качите максимум 2 снимки.");
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Отказ', 'Нуждаем се от достъп до камерата за сканиране.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.4,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImages([...images, result.assets[0].base64]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const generateQuiz = async () => {
    if (!context.trim() && images.length === 0) return Alert.alert("Нужен контекст", "Моля поставете вашите бележки първо.");

    setIsGenerating(true);
    try {
      const response = await fetch(`${API_URL}/chat/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session}`
        },
        body: JSON.stringify({
          subject: selectedTest.description,
          context: context,
          questionsCount: numQuestions,
          images: images
        }),
      });

      if (response.status === 401 || response.status === 422) {
        signOut();
        return;
      }

      const data = await response.json();
      setQuiz(data.questions);
    } catch (e) {
      Alert.alert("ИА Грешка", "Не успяхме да генерираме теста. Проверете връзката си.");
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateScore = async () => {
    if (Object.keys(userAnswers).length < (quiz?.length || 0)) {
      return Alert.alert("Недовършен тест", "Моля отговорете на всички въпроси.");
    }
    let correctCount = 0;
    quiz?.forEach((q, index) => {
      if (userAnswers[index] === q.correct) correctCount++;
    });
    setScore(correctCount);

    try {
      const response = await fetch(`${API_URL}/save-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session}`
        },
        body: JSON.stringify({
          subject: selectedTest.description,
          score: correctCount,
          total: quiz?.length
        })
      });
      if (response.status === 401 || response.status === 422) {
        signOut();
        return;
      }
    } catch (error) {
      console.error("Failed to save score:", error);
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
    setScore(null);
    setSelectedTest(null);
    setContext('');
    setImages([]);
    setUserAnswers({});
  };

  if (quiz) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity style={styles.backLink} onPress={resetQuiz}>
          <Ionicons name="arrow-back" size={20} color="#80b48c" />
          <Text style={styles.backLinkText}>Отказ</Text>
        </TouchableOpacity>

        <Animated.View entering={FadeIn.duration(500)}>
          <Text style={styles.headerTitle}>Упражнение: {selectedTest.description}</Text>
          <Text style={styles.subTitle}>Отбележете верният отговор на всеки от въпросите.</Text>
        </Animated.View>

        {quiz.map((q, index) => (
          <Animated.View
            key={index}
            entering={FadeIn.delay(index * 150).duration(400)}
            style={styles.quizCard}
          >
            <Text style={styles.questionText}>{index + 1}. {q.question}</Text>
            {q.options.map((opt: string) => {
              let buttonStyle: any[] = [styles.optionBtn];
              let textStyle: any = { color: '#1e293b' };

              if (score !== null) {
                if (opt === q.correct) {
                  buttonStyle.push(styles.optionCorrect);
                  textStyle = { color: '#fff' };
                } else if (opt === userAnswers[index] && opt !== q.correct) {
                  buttonStyle.push(styles.optionWrong);
                  textStyle = { color: '#fff' };
                }
              } else if (userAnswers[index] === opt) {
                buttonStyle.push(styles.optionSelected);
                textStyle = { color: '#fff' };
              }

              return (
                <TouchableOpacity
                  key={opt}
                  style={buttonStyle}
                  onPress={() => score === null && setUserAnswers({ ...userAnswers, [index]: opt })}
                  disabled={score !== null}
                >
                  <Text style={textStyle}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        ))}

        {score === null ? (
          <TouchableOpacity style={styles.submitBtn} onPress={calculateScore}>
            <Text style={styles.btnText}>Приключи и покажи резултата</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View entering={FadeIn.duration(600).delay(200)} style={styles.resultCard}>
            <Text style={styles.scoreText}>Резултат: {score} / {quiz.length}</Text>
            <Text style={styles.scoreSubText}>
              {score === quiz.length ? "Перфектно! Готови сте!" : "Прегледайте грешките си в червено горе."}
            </Text>
            <TouchableOpacity style={styles.resetBtn} onPress={resetQuiz}>
              <Text style={styles.btnText}>Опитайте друга тема</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <Animated.View entering={FadeIn.duration(600)}>
          <Text style={styles.headerTitle}>Учител Помощник</Text>
          <Text style={styles.subTitle}>Изберете някой от предстоящите ви тестове, за да се подготвите.</Text>
        </Animated.View>

        {loading ? (
          <ActivityIndicator size="large" color="#80b48c" style={{ marginTop: 50 }} />
        ) : upcomingTests.length > 0 ? (
          upcomingTests.map((test, i) => (
            <Animated.View
              key={i}
              entering={FadeIn.delay(i * 100).duration(500)}
              layout={Layout.springify()}
            >
              <TouchableOpacity
                style={[styles.testItem, selectedTest === test && styles.testSelected]}
                onPress={() => setSelectedTest(test)}
              >
                <Ionicons name="school" size={24} color={selectedTest === test ? "#fff" : "#80b48c"} />
                <View style={{ marginLeft: 15 }}>
                  <Text style={[styles.testName, selectedTest === test && { color: '#fff' }]}>{test.description}</Text>
                  <Text style={[styles.testDate, selectedTest === test && { color: 'rgba(255,255,255,0.8)' }]}>{test.date}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Няма предстоящи тестове във вашият календар.</Text>
          </View>
        )}

        {selectedTest && (
          <Animated.View entering={FadeIn.duration(500)} style={styles.contextArea}>
            <Text style={styles.label}>Поставете записки или теми:</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Пример:Теста е върху Цикълът на водата..."
              multiline
              value={context}
              onChangeText={setContext}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>Снимайте записки (Макс 2):</Text>
            <View style={styles.imageRow}>
              {images.map((img, index) => (
                <View key={index} style={styles.imagePreviewContainer}>
                  <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {images.length < 2 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={30} color="#80b48c" />
                  <Text style={styles.addImageText}>Направете снимка</Text>
                </TouchableOpacity>
              )}
            </View>


            <Text style={[styles.label, { marginTop: 20 }]}>Брой въпроси:</Text>
            <View style={styles.countRow}>
              {[5, 7, 10].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.countBtn,
                    numQuestions === num && styles.countBtnSelected
                  ]}
                  onPress={() => setNumQuestions(num)}
                >
                  <Text style={[
                    styles.countBtnText,
                    numQuestions === num && styles.countBtnTextSelected
                  ]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={generateQuiz}
              disabled={isGenerating}
            >
              {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Генерирай тест за подготовка</Text>}
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: TOP_PADDING, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#333333', marginBottom: 5, letterSpacing: -0.5 },
  subTitle: { fontSize: 16, color: '#666666', marginBottom: 25, fontWeight: '500' },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backLinkText: { color: '#80b48c', marginLeft: 5, fontWeight: '900', fontSize: 16 },
  testItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  testSelected: { backgroundColor: '#80b48c' },
  testName: { fontSize: 16, fontWeight: '800', color: '#333333' },
  testDate: { fontSize: 13, color: '#666666', marginTop: 2 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#666666', textAlign: 'center', fontWeight: '500' },
  contextArea: { marginTop: 10, padding: 25, backgroundColor: '#fff', borderRadius: 32, elevation: 8, shadowColor: '#a0bfb9', shadowOpacity: 0.15, shadowRadius: 20, marginBottom: 40, borderWidth: 1, borderColor: '#c0cfd0' },
  label: { fontWeight: '900', marginBottom: 12, color: '#333333', textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.8 },
  textArea: { backgroundColor: '#f1f5f9', borderRadius: 18, padding: 18, height: 140, textAlignVertical: 'top', fontSize: 16, color: '#333333', borderWidth: 1, borderColor: '#c0cfd0' },
  generateBtn: { backgroundColor: '#80b48c', padding: 20, borderRadius: 18, marginTop: 25, alignItems: 'center', elevation: 4, shadowColor: '#80b48c', shadowOpacity: 0.3, shadowRadius: 10 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },
  quizCard: { backgroundColor: '#fff', padding: 25, borderRadius: 28, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, borderWidth: 1, borderColor: '#c0cfd0' },
  questionText: { fontSize: 18, fontWeight: '900', color: '#333333', marginBottom: 20, lineHeight: 26 },
  optionBtn: { padding: 18, borderWidth: 2, borderColor: '#f1f5f9', borderRadius: 16, marginBottom: 12, backgroundColor: '#f1f5f9' },
  optionSelected: { backgroundColor: '#80b48c', borderColor: '#80b48c' },
  optionCorrect: { backgroundColor: '#80b48c', borderColor: '#80b48c' },
  optionWrong: { backgroundColor: '#c0cfd0', borderColor: '#c0cfd0' },
  submitBtn: { backgroundColor: '#80b48c', padding: 22, borderRadius: 20, alignItems: 'center', marginBottom: 30, elevation: 6, shadowColor: '#80b48c', shadowOpacity: 0.3 },
  resultCard: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 32, marginBottom: 40, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, borderWidth: 1, borderColor: '#c0cfd0' },
  scoreText: { fontSize: 36, fontWeight: '900', color: '#333333', marginBottom: 8 },
  scoreSubText: { fontSize: 16, color: '#666666', marginBottom: 30, textAlign: 'center', fontWeight: '500' },
  resetBtn: { backgroundColor: '#333333', padding: 20, borderRadius: 18, width: '100%', alignItems: 'center' },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  countBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 16,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#c0cfd0',
  },
  countBtnSelected: {
    backgroundColor: '#80b48c',
    borderColor: '#80b48c',
  },
  countBtnText: {
    fontWeight: '900',
    color: '#80b48c',
    fontSize: 16
  },
  countBtnTextSelected: {
    color: '#fff',
  },
  imageRow: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 12,
    alignItems: 'center'
  },
  imagePreviewContainer: {
    width: 90,
    height: 90,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9'
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  removeImgBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  addImageBtn: {
    width: 90,
    height: 90,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#80b48c',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  addImageText: {
    fontSize: 11,
    color: '#80b48c',
    marginTop: 6,
    fontWeight: '900'
  },
});