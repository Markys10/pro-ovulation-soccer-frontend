import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const loadProfiles = useProfileStore(state => state.loadProfiles);

  useEffect(() => {
    loadProfiles();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#121212' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="add-profile" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
