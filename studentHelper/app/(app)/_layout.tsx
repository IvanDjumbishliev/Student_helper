import { Tabs } from 'expo-router';
import CustomTabBar from '../../components/CustomTabBar';

export default function AppLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="AiChat" options={{ title: "AI Chat" }} />
      <Tabs.Screen name="schoolwork" options={{ title: "Analysis" }} />
      <Tabs.Screen name="testGenerator" options={{ title: "Quiz" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
