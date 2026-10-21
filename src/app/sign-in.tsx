import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { signInWithApple, signInWithGoogle } from '../lib/auth';
import { colors } from '../lib/theme';

export default function SignIn() {
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);

  const run = async (provider: 'google' | 'apple') => {
    setBusy(provider);
    try {
      await (provider === 'google' ? signInWithGoogle() : signInWithApple());
    } catch (e) {
      Alert.alert('Sign-in failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.title}>SAT Prep</Text>
        <Text style={styles.subtitle}>
          Fresh practice tests, one question at a time, with a study guide for every topic you miss.
        </Text>
      </View>
      <View style={styles.buttons}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.apple}
            onPress={() => run('apple')}
          />
        ) : (
          <Button title="Sign in with Apple" variant="secondary" loading={busy === 'apple'} onPress={() => run('apple')} />
        )}
        <Button title="Sign in with Google" loading={busy === 'google'} onPress={() => run('google')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, justifyContent: 'space-between', backgroundColor: colors.bg },
  hero: { marginTop: 80, gap: 12 },
  title: { fontSize: 36, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 17, lineHeight: 24, color: colors.muted },
  buttons: { gap: 12, marginBottom: 24 },
  apple: { height: 48, width: '100%' },
});
