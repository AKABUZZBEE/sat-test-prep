import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { QuestionView } from '../../components/QuestionView';
import { getTest } from '../../lib/api';
import { colors } from '../../lib/theme';
import { outcomeOf, type Test } from '../../lib/types';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Go back to a wrong or skipped question, try it again, then see the explanation. */
export default function Review() {
  const { id, q } = useLocalSearchParams<{ id: string; q: string }>();
  const [test, setTest] = useState<Test | null>(null);
  const [retry, setRetry] = useState<number | null>(null);

  useEffect(() => {
    getTest(id).then(setTest).catch((e) => Alert.alert('Could not load question', e.message));
  }, [id]);

  useEffect(() => setRetry(null), [q]);

  if (!test) return <ActivityIndicator style={{ marginTop: 48 }} />;

  const missed = test.questions.filter((x) => outcomeOf(x, test.answers[x.id]) !== 'correct');
  const pos = missed.findIndex((x) => x.id === q);
  const question = missed[pos];
  if (!question) return null;

  const original = test.answers[question.id]?.choice ?? null;
  const number = test.questions.indexOf(question) + 1;
  const go = (p: number) => router.setParams({ q: missed[p].id });

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ title: `Question ${number}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>
          {original === null ? 'You skipped this one.' : `You answered ${LETTERS[original]}.`}{' '}
          {retry === null ? 'Try it again.' : ''}
        </Text>
        <QuestionView question={question} selected={retry} onSelect={retry === null ? setRetry : undefined} reveal={retry !== null} />
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Previous" variant="secondary" disabled={pos <= 0} onPress={() => go(pos - 1)} style={styles.flex} />
        <Button title="Next" disabled={pos >= missed.length - 1} onPress={() => go(pos + 1)} style={styles.flex} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  note: { fontSize: 15, color: colors.muted },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  flex: { flex: 1 },
});
