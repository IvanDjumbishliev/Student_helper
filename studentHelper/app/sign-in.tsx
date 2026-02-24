import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useSession } from '../ctx';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SignIn() {
  const { signIn } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', isError: false });

  const handleSignIn = async () => {
    try {
      await signIn(email, password);
      console.log("Login successful, navigating to /home");
      router.replace('/home');
      console.log("Navigated to /home");
    } catch (err: any) {
      setModalConfig({
        title: 'Грешка при вход',
        message: err.message || 'Невалидно потребителско име или парола.',
        isError: true
      });
      setModalVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Здравейте, отново!</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Потребителско име"
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Парола"
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Вход</Text>
      </TouchableOpacity>

      <Text style={styles.registerText}>
        Нямате акаунт?{' '}
        <Text style={styles.registerLink} onPress={() => router.push('/register')}>
          Регистрация
        </Text>
      </Text>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.iconContainer, { backgroundColor: modalConfig.isError ? '#f1f5f9' : '#f0f4f2' }]}>
              <Ionicons
                name={modalConfig.isError ? "alert-circle" : "checkmark-circle"}
                size={40}
                color={modalConfig.isError ? "#ef4444" : "#80b48c"}
              />
            </View>
            <Text style={styles.modalTitle}>{modalConfig.title}</Text>
            <Text style={styles.modalMessage}>{modalConfig.message}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: modalConfig.isError ? "#ef4444" : "#80b48c" }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Опитай пак</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 40,
    textAlign: 'center',
    color: '#333333',
    letterSpacing: -0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c0cfd0',
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333333',
  },
  button: {
    backgroundColor: '#80b48c',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#80b48c',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  registerText: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  registerLink: {
    color: '#80b48c',
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#c0cfd0',
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});