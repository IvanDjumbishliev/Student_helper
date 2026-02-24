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
      <Tabs.Screen name="home" options={{ title: "Начало" }} />
      <Tabs.Screen name="AiChat" options={{ title: "ИА Чат" }} />
      <Tabs.Screen name="schoolwork" options={{ title: "Анализ" }} />
      <Tabs.Screen name="testGenerator" options={{ title: "Тест" }} />
      <Tabs.Screen name="calendar" options={{ title: "Календар" }} />
      <Tabs.Screen name="profile" options={{ title: "Профил" }} />
    </Tabs>
  );
}
