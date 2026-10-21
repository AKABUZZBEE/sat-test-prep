import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { getLatestTest, startTest } from '../lib/api';
import { signOut, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';
import type { Test } from '../lib/types';

export default function Home() {
  const { session } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getLatestTest()
        .then(setTest)
        .catch((e) => Alert.alert('Could not load your test', e.message))
        .finally(() => setLoading(false));
    }, []),
  );

  const begin = async (retake: boolean) => {
    setGenerating(true);
    try {
      const t = await startTest(retake);
      setTest(t);
      router.push({ pathname: '/test/[id]', params: { id: t.id } });
    } catch (e) {
      Alert.alert('Could not create a test', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const confirmRetake = () =>
    Alert.alert('Start a new test?', 'You will get a brand-new set of questions. Your past results stay saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New test', onPress: () => begin(true) },
    ]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 48 }} />;
  }

  const answered = test ? Object.values(test.answers).filter((a) => a.choice !== null).length : 0;
  const name = session?.user.user_metadata?.full_name ?? session?.user.email ?? '';

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.greeting}>Hi{name ? `, ${name.split(' ')[0]}` : ''}</Text>

      {generating ? (
        <View style={styles.card}>
          <ActivityIndicator />
          <Text style={styles.body}>Writing your questions. This can take up to a minute.</Text>
        </View>
      ) : !test ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ready for your first practice test?</Text>
          <Text style={styles.body}>
            You'll get a fresh set of Reading & Writing and Math questions. Answer one at a time, skip any you want to
            come back to.
          </Text>
          <Button title="Generate my test" onPress={() => begin(false)} />
        </View>
      ) : test.status === 'in_progress' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Test in progress</Text>
          <Text style={styles.body}>
            {answered} of {test.questions.length} answered
          </Text>
          <Button title="Continue test" onPress={() => router.push({ pathname: '/test/[id]', params: { id: test.id } })} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last test</Text>
          <Text style={styles.score}>
            {test.score} / {test.questions.length}
          </Text>
          <Button title="View results & study guides" onPress={() => router.push({ pathname: '/results/[id]', params: { id: test.id } })} />
          <Button title="Retake with a new test" variant="secondary" onPress={confirmRetake} />
        </View>
      )}

      <Button title="Sign out" variant="secondary" onPress={signOut} style={{ marginTop: 'auto' }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 20, gap: 16 },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.muted },
  score: { fontSize: 40, fontWeight: '800', color: colors.primary },
});
