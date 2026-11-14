import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Layers, RotateCcw, X } from 'lucide-react';
import {
  applySM2Grade,
  FlashcardItem,
  FlashcardProgress,
  FlashcardReviewGrade,
} from '../plugins/flashcardsEngine';

interface FlashcardReviewModalProps {
  isOpen: boolean;
  cards: FlashcardItem[];
  progressMap: Record<string, FlashcardProgress>;
  onClose: () => void;
  onGradeCard: (cardId: string, nextProgress: FlashcardProgress) => void;
  onOpenNote: (noteId: string) => void;
  onInsertSampleCard: () => void;
}

export const FlashcardReviewModal: React.FC<FlashcardReviewModalProps> = ({
  isOpen,
  cards,
  progressMap,
  onClose,
  onGradeCard,
  onOpenNote,
  onInsertSampleCard,
}) => {
  const [flipped, setFlipped] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [practiceAll, setPracticeAll] = useState(false);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => {
      if (practiceAll) return true;
      const p = progressMap[c.id];
      return !p || p.nextReviewAt <= now;
    });
  }, [cards, progressMap, practiceAll]);

  const currentCard = dueCards[0] || null;

  useEffect(() => {
    if (isOpen) {
      setFlipped(false);
      setSessionReviewed(0);
      setPracticeAll(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.code === 'Space' && currentCard && !flipped) {
        e.preventDefault();
        setFlipped(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, currentCard, flipped, onClose]);

  if (!isOpen) return null;

  const handleGrade = (grade: FlashcardReviewGrade) => {
    if (!currentCard) return;
    const next = applySM2Grade(progressMap[currentCard.id], grade);
    onGradeCard(currentCard.id, next);
    setFlipped(false);
    setSessionReviewed((r) => r + 1);
  };

  const previewLabel = (grade: FlashcardReviewGrade) => {
    if (!currentCard) return '';
    const sim = applySM2Grade(progressMap[currentCard.id], grade);
    if (sim.intervalDays === 0) return '1 min';
    return `${sim.intervalDays}d`;
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020307]/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-[#223050] bg-[#080B14] text-[#ECEFF6] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1B253B] bg-[#0A0E19]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#E5A93B]" />
            <h2 className="font-display text-base font-semibold">
              Revisão Espaçada (SM-2)
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#7B88A6] tabular-nums">
              {dueCards.length} restantes · {sessionReviewed} revisados
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {cards.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <p className="text-sm text-[#9AA7C4] max-w-md mx-auto leading-relaxed">
                Nenhum flashcard encontrado no Vault ainda. Escreva linhas no formato{' '}
                <code className="font-mono text-[#E5A93B]">Pergunta :: Resposta</code> em
                qualquer nota para criar cartões automaticamente.
              </p>
              <button
                type="button"
                onClick={() => {
                  onInsertSampleCard();
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-[#E5A93B] text-[#05070D] text-xs font-semibold hover:bg-[#F3BA52] cursor-pointer"
              >
                Inserir exemplo de Flashcard na nota atual
              </button>
            </div>
          ) : !currentCard ? (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-[#5CA9E6] mx-auto" />
              <div>
                <h3 className="font-display text-lg font-semibold text-[#ECEFF6]">
                  Órbita de revisão em dia!
                </h3>
                <p className="text-xs text-[#9AA7C4] mt-1">
                  Todos os {cards.length} flashcards do Vault estão agendados para o futuro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPracticeAll(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#243456] bg-[#0B0F1A] text-xs text-[#E5A93B] hover:border-[#E5A93B]/60 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Praticar todos os {cards.length} cartões agora</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-[#7B88A6]">
                <span>Origem: {currentCard.noteTitle}</span>
                <button
                  type="button"
                  onClick={() => {
                    onOpenNote(currentCard.noteId);
                    onClose();
                  }}
                  className="flex items-center gap-1 text-[#5CA9E6] hover:text-[#E5A93B] cursor-pointer"
                >
                  <span>Abrir planeta</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="rounded-xl border border-[#1B253B] bg-[#05070D] p-6 min-h-[170px] flex flex-col justify-center items-center text-center gap-4">
                <div className="text-base font-medium text-[#ECEFF6] leading-relaxed">
                  {currentCard.question}
                </div>

                {flipped && (
                  <div className="w-full pt-4 border-t border-[#161F34] text-sm text-[#BAE6FD] whitespace-pre-wrap leading-relaxed">
                    {currentCard.answer}
                  </div>
                )}
              </div>

              {!flipped ? (
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="w-full py-2.5 rounded-xl bg-[#E5A93B] text-[#05070D] text-xs font-semibold hover:bg-[#F3BA52] transition-colors cursor-pointer"
                >
                  Mostrar Resposta (Espaço)
                </button>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleGrade('again')}
                    className="py-2 px-2 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5] hover:bg-[#EF4444]/20 cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span className="font-semibold">De novo</span>
                    <span className="font-mono text-[10px] opacity-80">{previewLabel('again')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrade('hard')}
                    className="py-2 px-2 rounded-lg border border-[#E5A93B]/40 bg-[#E5A93B]/10 text-[#FBE6B2] hover:bg-[#E5A93B]/20 cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span className="font-semibold">Difícil</span>
                    <span className="font-mono text-[10px] opacity-80">{previewLabel('hard')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrade('good')}
                    className="py-2 px-2 rounded-lg border border-[#5CA9E6]/45 bg-[#5CA9E6]/10 text-[#BAE6FD] hover:bg-[#5CA9E6]/20 cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span className="font-semibold">Bom</span>
                    <span className="font-mono text-[10px] opacity-80">{previewLabel('good')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGrade('easy')}
                    className="py-2 px-2 rounded-lg border border-[#38BDF8]/45 bg-[#38BDF8]/10 text-[#A5F3FC] hover:bg-[#38BDF8]/20 cursor-pointer flex flex-col items-center gap-0.5"
                  >
                    <span className="font-semibold">Fácil</span>
                    <span className="font-mono text-[10px] opacity-80">{previewLabel('easy')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
