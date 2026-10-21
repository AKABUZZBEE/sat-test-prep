import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { SECTION_LABEL, type Question } from '../lib/types';

interface Props {
  question: Question;
  selected: number | null;
  onSelect?: (index: number) => void;
  /** When true, marks the correct and chosen answers and shows the explanation. */
  reveal?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function QuestionView({ question, selected, onSelect, reveal }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.meta}>
        {SECTION_LABEL[question.section]} · {question.topic} · {question.difficulty}
      </Text>
      {question.passage ? <Text style={styles.passage}>{question.passage}</Text> : null}
      <Text style={styles.prompt}>{question.prompt}</Text>
      {question.choices.map((choice, i) => {
        const isSelected = selected === i;
        const isCorrect = reveal && i === question.correct_index;
        const isWrongPick = reveal && isSelected && !isCorrect;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            disabled={!onSelect}
            onPress={() => onSelect?.(i)}
            style={[
              styles.choice,
              isSelected && styles.choiceSelected,
              isCorrect && styles.choiceCorrect,
              isWrongPick && styles.choiceWrong,
            ]}
          >
            <Text style={[styles.letter, isSelected && styles.letterSelected]}>{LETTERS[i]}</Text>
            <Text style={styles.choiceText}>{choice}</Text>
          </Pressable>
        );
      })}
      {reveal ? (
        <View style={styles.explanation}>
          <Text style={styles.explanationTitle}>
            Correct answer: {LETTERS[question.correct_index]}
          </Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  meta: { color: colors.muted, fontSize: 13, textTransform: 'capitalize' },
  passage: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14, fontSize: 15, lineHeight: 22,
    color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  prompt: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text },
  choice: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  choiceCorrect: { borderColor: colors.correct, backgroundColor: colors.correctBg },
  choiceWrong: { borderColor: colors.wrong, backgroundColor: colors.wrongBg },
  letter: {
    width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, fontWeight: '700',
    color: colors.muted, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  letterSelected: { color: colors.primaryText, backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
  explanation: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border },
  explanationTitle: { fontWeight: '700', color: colors.correct },
  explanationText: { fontSize: 15, lineHeight: 22, color: colors.text },
});
