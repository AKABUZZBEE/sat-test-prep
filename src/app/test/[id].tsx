import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { QuestionView } from '../../components/QuestionView';
import { finishTest, getTest, saveProgress } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { Answer, Test } from '../../lib/types';

export default function TakeTest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [showList, setShowList] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    getTest(id)
      .then((t) => {
        if (t.status === 'completed') {
          router.replace({ pathname: '/results/[id]', params: { id: t.id } });
          return;
        }
        setTest(t);
        setAnswers(t.answers ?? {});
        setIndex(Math.min(t.current_index, t.questions.length - 1));
        loaded.current = true;
      })
      .catch((e) => Alert.alert('Could not load test', e.message));
  }, [id]);

  // Persist progress so the student can close the app and resume the same set.
  useEffect(() => {
    if (!loaded.current || !test) return;
    const t = setTimeout(() => saveProgress(test.id, answers, index).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [answers, index, test]);

  if (!test) return <ActivityIndicator style={{ marginTop: 48 }} />;

  const total = test.questions.length;
  const question = test.questions[index];
  const current = answers[question.id];
  const isLast = index === total - 1;
  const unanswered = test.questions.filter((q) => answers[q.id]?.choice == null);

  const select = (choice: number) => setAnswers((a) => ({ ...a, [question.id]: { choice, skipped: false } }));

  const skip = () => {
    setAnswers((a) => ({ ...a, [question.id]: { choice: null, skipped: true } }));
    if (isLast) setShowList(true);
    else setIndex(index + 1);
  };

  const next = () => {
    if (isLast) setShowList(true);
    else setIndex(index + 1);
  };

  const jump = (i: number) => {
    setIndex(i);
    setShowList(false);
  };

  const finish = () => {
    const doFinish = async () => {
      setFinishing(true);
      try {
        const done = await finishTest(test, answers);
        setShowList(false);
        router.replace({ pathname: '/results/[id]', params: { id: done.id } });
      } catch (e) {
        Alert.alert('Could not submit', (e as Error).message);
      } finally {
        setFinishing(false);
      }
    };
    if (unanswered.length === 0) return doFinish();
    Alert.alert(
      'Finish test?',
      `${unanswered.length} question${unanswered.length === 1 ? ' is' : 's are'} unanswered and will count as skipped.`,
      [{ text: 'Keep going', style: 'cancel' }, { text: 'Finish', onPress: doFinish }],
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: `Question ${index + 1} of ${total}`,
          headerRight: () => (
            <Pressable onPress={() => setShowList(true)} hitSlop={8}>
              <Text style={styles.headerLink}>All questions</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <QuestionView question={question} selected={current?.choice ?? null} onSelect={select} />
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Back" variant="secondary" disabled={index === 0} onPress={() => setIndex(index - 1)} style={styles.flex} />
        <Button title="Skip" variant="secondary" onPress={skip} style={styles.flex} />
        <Button title={isLast ? 'Review' : 'Next'} disabled={current?.choice == null} onPress={next} style={styles.flex} />
      </View>

      <Modal visible={showList} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowList(false)}>
        <SafeAreaView style={styles.sheet}>
          <Text style={styles.sheetTitle}>All questions</Text>
          <Text style={styles.sheetSub}>
            {total - unanswered.length} answered · {unanswered.length} skipped or unanswered. Tap a number to go back to it.
          </Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {test.questions.map((q, i) => {
              const a = answers[q.id];
              const state = a?.choice != null ? 'answered' : a?.skipped ? 'skipped' : 'open';
              return (
                <Pressable
                  key={q.id}
                  onPress={() => jump(i)}
                  style={[styles.cell, state === 'answered' && styles.cellAnswered, state === 'skipped' && styles.cellSkipped, i === index && styles.cellCurrent]}
                >
                  <Text style={[styles.cellText, state === 'answered' && { color: colors.primaryText }]}>{i + 1}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.legend}>
            <Text style={styles.legendItem}><Text style={{ color: colors.primary }}>■</Text> Answered</Text>
            <Text style={styles.legendItem}><Text style={{ color: colors.skipped }}>■</Text> Skipped</Text>
            <Text style={styles.legendItem}><Text style={{ color: colors.border }}>■</Text> Not seen</Text>
          </View>
          <View style={{ gap: 10 }}>
            <Button title="Finish test" loading={finishing} onPress={finish} />
            <Button title="Keep working" variant="secondary" onPress={() => setShowList(false)} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerLink: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  progressTrack: { height: 4, backgroundColor: colors.border },
  progressFill: { height: 4, backgroundColor: colors.primary },
  content: { padding: 20, paddingBottom: 32 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  flex: { flex: 1 },
  sheet: { flex: 1, padding: 20, gap: 14, backgroundColor: colors.bg },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  sheetSub: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8 },
  cell: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  cellAnswered: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellSkipped: { backgroundColor: colors.skippedBg, borderColor: colors.skipped },
  cellCurrent: { borderWidth: 3, borderColor: colors.text },
  cellText: { fontSize: 16, fontWeight: '600', color: colors.text },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { color: colors.muted, fontSize: 13 },
});
