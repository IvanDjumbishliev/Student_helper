import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useSession } from '../ctx';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const { register } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', isError: false });

  const handleRegister = async () => {
    try {
      await register(email, password);
      setModalConfig({
        title: 'Успешна регистрация',
        message: 'Вашият акаунт беше създаден успешно! Сега можете да влезете.',
        isError: false
      });
      setModalVisible(true);
    } catch (err: any) {
      setModalConfig({
        title: 'Грешка при регистрация',
        message: err.message || 'Възникна проблем при създаването на акаунта.',
        isError: true
      });
      setModalVisible(true);
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    if (!modalConfig.isError) {
      router.push('/sign-in');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Създаване на акаунт</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Потребителско име"
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Парола"
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Регистрация</Text>
      </TouchableOpacity>

      <Text style={styles.signInText}>
        Вече имате акаунт?{' '}
        <Text style={styles.signInLink} onPress={() => router.push('/sign-in')}>
          Вход
        </Text>
      </Text>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.iconContainer, { backgroundColor: modalConfig.isError ? '#FEE2E2' : '#ECFDF5' }]}>
              <Ionicons 
                name={modalConfig.isError ? "alert-circle" : "checkmark-circle"} 
                size={40} 
                color={modalConfig.isError ? "#EF4444" : "#10B981"} 
              />
            </View>
            <Text style={styles.modalTitle}>{modalConfig.title}</Text>
            <Text style={styles.modalMessage}>{modalConfig.message}</Text>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: modalConfig.isError ? "#EF4444" : "#4F46E5" }]} 
              onPress={handleModalClose}
            >
              <Text style={styles.modalButtonText}>
                {modalConfig.isError ? "Опитай пак" : "Към вход"}
              </Text>
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
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signInText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  signInLink: {
    color: '#4f46e5',
    fontWeight: 'bold',
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
    color: '#1F2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
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