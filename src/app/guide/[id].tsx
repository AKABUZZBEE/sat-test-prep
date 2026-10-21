import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { getStudyGuide } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { StudyGuide } from '../../lib/types';

export default function Guide() {
  const { id, topic } = useLocalSearchParams<{ id: string; topic: string }>();
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    getStudyGuide(id, topic).then(setGuide).catch((e) => setError(e.message));
  }, [id, topic, attempt]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: topic }} />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.body}>{error}</Text>
          <Button title="Try again" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      ) : !guide ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.body}>Writing your study guide…</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{guide.topic}</Text>
          <Text style={styles.body}>{guide.summary}</Text>
          <Section title="Key concepts" items={guide.key_concepts} />
          <Section title="How to approach it" items={guide.strategies} numbered />
          <Text style={styles.heading}>Worked example</Text>
          <View style={styles.box}>
            <Text style={styles.bodyStrong}>{guide.worked_example.problem}</Text>
            <Text style={styles.body}>{guide.worked_example.solution}</Text>
          </View>
          <Section title="Common traps" items={guide.common_traps} />
          <View style={[styles.box, { backgroundColor: '#EFF6FF', borderColor: colors.primary }]}>
            <Text style={styles.bodyStrong}>Practice tip</Text>
            <Text style={styles.body}>{guide.practice_tip}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, items, numbered }: { title: string; items: string[]; numbered?: boolean }) {
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.bullet}>{numbered ? `${i + 1}.` : '•'}</Text>
          <Text style={[styles.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 10, paddingBottom: 40 },
  center: { alignItems: 'center', gap: 12, marginTop: 48 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 10 },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontSize: 15, lineHeight: 22, color: colors.text, fontWeight: '600' },
  item: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 15, lineHeight: 22, color: colors.muted, width: 18 },
  box: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border },
});
