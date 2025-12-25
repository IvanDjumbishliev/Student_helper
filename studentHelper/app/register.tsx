import { useState } from 'react';
import { View, TextInput, Button, Text, Alert } from 'react-native';
import { useSession } from '../ctx';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const { register } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    try {
      await register(email, password);
      Alert.alert('Success', 'Account created! You can now log in.');
      router.push('/sign-in');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ marginBottom: 5 }}>Email:</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Enter your email"
        style={{ borderWidth: 1, padding: 8, marginBottom: 15 }}
      />

      <Text style={{ marginBottom: 5 }}>Password:</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Enter your password"
        style={{ borderWidth: 1, padding: 8, marginBottom: 20 }}
      />

      <Button title="Register" onPress={handleRegister} />

      <Text style={{ marginTop: 15, textAlign: 'center' }}>
        Already have an account?{' '}
        <Text
          style={{ color: 'blue' }}
          onPress={() => router.push('/sign-in')}
        >
          Sign In
        </Text>
      </Text>
    </View>
  );
}
