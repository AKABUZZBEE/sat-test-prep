import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getTest } from '../../lib/api';
import { colors } from '../../lib/theme';
import { outcomeOf, SECTION_LABEL, type Section, type Test } from '../../lib/types';

export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [test, setTest] = useState<Test | null>(null);

  useEffect(() => {
    getTest(id).then(setTest).catch((e) => Alert.alert('Could not load results', e.message));
  }, [id]);

  const summary = useMemo(() => {
    if (!test) return null;
    const rows = test.questions.map((q, i) => ({ q, i, outcome: outcomeOf(q, test.answers[q.id]) }));
    const missed = rows.filter((r) => r.outcome !== 'correct');
    const sections = (['reading_writing', 'math'] as Section[]).map((s) => {
      const inSection = rows.filter((r) => r.q.section === s);
      return { section: s, correct: inSection.filter((r) => r.outcome === 'correct').length, total: inSection.length };
    });
    const topics = new Map<string, number>();
    for (const r of missed) topics.set(r.q.topic, (topics.get(r.q.topic) ?? 0) + 1);
    const weakTopics = [...topics.entries()].sort((a, b) => b[1] - a[1]);
    return { rows, missed, sections, weakTopics };
  }, [test]);

  if (!test || !summary) return <ActivityIndicator style={{ marginTop: 48 }} />;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.label}>Score</Text>
        <Text style={styles.score}>
          {test.score} / {test.questions.length}
        </Text>
        {summary.sections.map((s) => (
          <Text key={s.section} style={styles.body}>
            {SECTION_LABEL[s.section]}: {s.correct} / {s.total}
          </Text>
        ))}
      </View>

      <Text style={styles.heading}>Topics to study</Text>
      {summary.weakTopics.length === 0 ? (
        <Text style={styles.body}>Nothing missed. Nice work!</Text>
      ) : (
        summary.weakTopics.map(([topic, count]) => (
          <Pressable
            key={topic}
            style={styles.row}
            onPress={() => router.push({ pathname: '/guide/[id]', params: { id: test.id, topic } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{topic}</Text>
              <Text style={styles.rowSub}>{count} missed · open one-page guide</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))
      )}

      <Text style={styles.heading}>Wrong or skipped questions</Text>
      {summary.missed.map(({ q, i, outcome }) => (
        <Pressable
          key={q.id}
          style={styles.row}
          onPress={() => router.push({ pathname: '/review/[id]', params: { id: test.id, q: q.id } })}
        >
          <View style={[styles.badge, outcome === 'wrong' ? styles.badgeWrong : styles.badgeSkipped]}>
            <Text style={[styles.badgeText, { color: outcome === 'wrong' ? colors.wrong : colors.skipped }]}>
              {outcome === 'wrong' ? 'Wrong' : 'Skipped'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Question {i + 1}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>{q.prompt}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 4, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 14 },
  score: { fontSize: 40, fontWeight: '800', color: colors.primary, marginBottom: 6 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 12 },
  body: { fontSize: 15, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeWrong: { backgroundColor: colors.wrongBg },
  badgeSkipped: { backgroundColor: colors.skippedBg },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
