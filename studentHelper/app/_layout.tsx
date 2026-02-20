import { Stack } from 'expo-router';

import { SessionProvider, useSession } from '../ctx';

export default function Root() {
 
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}


function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" options={{headerShown: false}}/>
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{headerShown:false}}/>
        <Stack.Screen name="register" options={{headerShown: false}} />
      </Stack.Protected>
    </Stack>
  );
}

