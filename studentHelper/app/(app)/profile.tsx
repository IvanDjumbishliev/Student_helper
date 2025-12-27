import { View, Text, Button } from 'react-native';
import { useSession } from '../../ctx';
import { router } from 'expo-router';

export default function ProfilePage() {
  const { signOut } = useSession();

  const handleSignOut = () => {
    signOut();        
    router.replace('/sign-in');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Profile Page</Text>
      <Button title="Sign Out" onPress={handleSignOut} />
    </View>
  );
}
