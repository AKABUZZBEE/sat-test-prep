import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

function RootStack() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }
  const signedIn = !!session;
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg }, headerBackTitle: 'Back' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ title: 'SAT Prep' }} />
        <Stack.Screen name="test/[id]" options={{ title: 'Practice test', gestureEnabled: false }} />
        <Stack.Screen name="results/[id]" options={{ title: 'Results' }} />
        <Stack.Screen name="review/[id]" options={{ title: 'Review' }} />
        <Stack.Screen name="guide/[id]" options={{ title: 'Study guide' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
