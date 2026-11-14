import { Note } from '../types/vault';

export interface FlashcardItem {
  id: string;
  noteId: string;
  noteTitle: string;
  question: string;
  answer: string;
}

export interface FlashcardProgress {
  intervalDays: number;
  easeFactor: number;
  reps: number;
  nextReviewAt: number;
}

export type FlashcardReviewGrade = 'again' | 'hard' | 'good' | 'easy';

function quickHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function extractFlashcardsFromNotes(notes: Note[]): FlashcardItem[] {
  const cards: FlashcardItem[] = [];

  for (const note of notes) {
    const lines = note.content.split('\n');
    let inCode = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('```')) {
        inCode = !inCode;
        continue;
      }
      if (inCode || !trimmed) continue;

      // 1. Single-line Q :: A
      const inlineMatch = /^(.+?)\s*::\s*(.+)$/.exec(trimmed);
      if (inlineMatch && !trimmed.startsWith('|')) {
        const question = inlineMatch[1].replace(/^[-*+]\s+/, '').trim();
        const answer = inlineMatch[2].trim();
        if (question && answer) {
          cards.push({
            id: `${note.id}-${quickHash(question)}`,
            noteId: note.id,
            noteTitle: note.title || 'Sem título',
            question,
            answer,
          });
        }
        continue;
      }

      // 2. Multi-line "Question ?" followed by answer lines
      if (trimmed.endsWith('?') && !trimmed.startsWith('#') && i + 1 < lines.length) {
        const answerLines: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          const nextTrimmed = lines[j].trim();
          if (!nextTrimmed || nextTrimmed.startsWith('#') || nextTrimmed.startsWith('```')) break;
          answerLines.push(nextTrimmed);
          j++;
        }
        if (answerLines.length > 0 && trimmed.toLowerCase().includes('#flashcard')) {
          const question = trimmed.replace(/#flashcard/gi, '').trim();
          cards.push({
            id: `${note.id}-${quickHash(question)}`,
            noteId: note.id,
            noteTitle: note.title || 'Sem título',
            question,
            answer: answerLines.join('\n'),
          });
          i = j - 1;
        }
      }
    }
  }

  return cards;
}

export function applySM2Grade(
  prev: FlashcardProgress | undefined,
  grade: FlashcardReviewGrade,
  now = Date.now()
): FlashcardProgress {
  const baseEase = prev?.easeFactor ?? 2.5;
  const baseInterval = prev?.intervalDays ?? 0;
  const baseReps = prev?.reps ?? 0;

  if (grade === 'again') {
    return {
      intervalDays: 0,
      easeFactor: Math.max(1.3, baseEase - 0.2),
      reps: 0,
      nextReviewAt: now + 60 * 1000, // 1 min
    };
  }

  if (grade === 'hard') {
    const nextInterval = Math.max(1, Math.round(Math.max(1, baseInterval) * 1.2));
    return {
      intervalDays: nextInterval,
      easeFactor: Math.max(1.3, baseEase - 0.12),
      reps: baseReps + 1,
      nextReviewAt: now + nextInterval * 86400000,
    };
  }

  if (grade === 'good') {
    const nextInterval =
      baseReps === 0 ? 1 : baseReps === 1 ? 4 : Math.max(2, Math.round(baseInterval * baseEase));
    return {
      intervalDays: nextInterval,
      easeFactor: baseEase,
      reps: baseReps + 1,
      nextReviewAt: now + nextInterval * 86400000,
    };
  }

  // easy
  const nextInterval =
    baseReps === 0 ? 4 : Math.max(5, Math.round(Math.max(2, baseInterval) * baseEase * 1.35));
  return {
    intervalDays: nextInterval,
    easeFactor: Math.min(3.0, baseEase + 0.12),
    reps: baseReps + 1,
    nextReviewAt: now + nextInterval * 86400000,
  };
}
