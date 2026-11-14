import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  CheckSquare,
  Code,
  Columns2,
  Eye,
  Globe,
  Heading2,
  Italic,
  Link2,
  Orbit,
  PenLine,
  Pin,
  Plus,
  Quote,
  Sparkles,
  Sun,
} from 'lucide-react';
import { EditorMode, Folder, MaturityStage, Note } from '../types/vault';
import { PluginBlockContext, PluginBlockProcessor } from '../types/plugins';
import { countWordsAndChars, getFolderPath, normalizeTitle } from '../utils/markdownGraph';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownEditorProps {
  note: Note;
  notes: Note[];
  folders: Folder[];
  editorMode: EditorMode;
  onChangeEditorMode: (mode: EditorMode) => void;
  onUpdateNote: (id: string, patch: Partial<Note>) => void;
  onOpenNote: (noteId: string) => void;
  onOpenWikilink: (targetTitle: string) => void;
  onCreateSubnote: (parentNoteId: string) => void;
  onClickTag: (tag: string) => void;
  onFocusInCosmos: (noteId: string) => void;
  allTags: string[];
  backlinkCount: number;
  outgoingCount: number;
  blockProcessors?: Record<string, PluginBlockProcessor>;
  blockContext?: PluginBlockContext;
}

const MATURITY_CONFIG: Record<MaturityStage, { label: string; color: string; next: MaturityStage }> = {
  nebula: { label: 'Nebulosa', color: 'text-[#38BDF8]', next: 'planet' },
  planet: { label: 'Planeta', color: 'text-[#5CA9E6]', next: 'star' },
  star: { label: 'Estrela', color: 'text-[#E5A93B]', next: 'nebula' },
};

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  note,
  notes,
  folders,
  editorMode,
  onChangeEditorMode,
  onUpdateNote,
  onOpenNote,
  onOpenWikilink,
  onCreateSubnote,
  onClickTag,
  onFocusInCosmos,
  allTags,
  backlinkCount,
  outgoingCount,
  blockProcessors,
  blockContext,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [autocomplete, setAutocomplete] = useState<{
    type: 'wikilink' | 'tag';
    query: string;
    startIndex: number;
    selectedIndex: number;
  } | null>(null);

  const subnotes = useMemo(
    () => notes.filter((n) => n.parentNoteId === note.id),
    [notes, note.id]
  );

  const parentNote = useMemo(
    () => (note.parentNoteId ? notes.find((n) => n.id === note.parentNoteId) || null : null),
    [notes, note.parentNoteId]
  );

  const folderPath = useMemo(
    () => getFolderPath(note.folderId, folders),
    [note.folderId, folders]
  );

  const stats = useMemo(() => countWordsAndChars(note.content), [note.content]);

  const suggestions = useMemo(() => {
    type SuggestionItem =
      | { kind: 'existing'; label: string; note: Note }
      | { kind: 'create'; label: string }
      | { kind: 'tag'; label: string };

    if (!autocomplete) return [] as SuggestionItem[];
    const q = autocomplete.query.toLowerCase();
    if (autocomplete.type === 'wikilink') {
      const matched: SuggestionItem[] = notes
        .filter((n) => n.id !== note.id && n.title.toLowerCase().includes(q))
        .slice(0, 7)
        .map((n) => ({ kind: 'existing' as const, label: n.title, note: n }));
      const exactExists = notes.some(
        (n) => normalizeTitle(n.title) === normalizeTitle(autocomplete.query)
      );
      if (autocomplete.query.trim() && !exactExists) {
        matched.push({
          kind: 'create' as const,
          label: autocomplete.query.trim(),
        });
      }
      return matched;
    } else {
      return allTags
        .filter((t) => t.toLowerCase().includes(q))
        .slice(0, 7)
        .map((t): SuggestionItem => ({ kind: 'tag' as const, label: t }));
    }
  }, [autocomplete, notes, note.id, allTags]);

  useEffect(() => {
    setAutocomplete(null);
  }, [note.id]);

  const detectAutocomplete = (value: string, cursorPos: number) => {
    const beforeCursor = value.slice(0, cursorPos);
    const wikiMatch = /\[\[([^[\]\n]*)$/.exec(beforeCursor);
    if (wikiMatch) {
      setAutocomplete({
        type: 'wikilink',
        query: wikiMatch[1],
        startIndex: wikiMatch.index,
        selectedIndex: 0,
      });
      return;
    }
    const tagMatch = /(?:^|[\s(])#([a-zA-ZÀ-ÿ0-9_/-]*)$/.exec(beforeCursor);
    if (tagMatch) {
      const hashOffset = beforeCursor.lastIndexOf('#');
      setAutocomplete({
        type: 'tag',
        query: tagMatch[1],
        startIndex: hashOffset,
        selectedIndex: 0,
      });
      return;
    }
    setAutocomplete(null);
  };

  const applySuggestion = (item: { kind: string; label: string }) => {
    if (!autocomplete || !textareaRef.current) return;
    const el = textareaRef.current;
    const cursorPos = el.selectionStart;
    const before = note.content.slice(0, autocomplete.startIndex);
    const after = note.content.slice(cursorPos);

    if (autocomplete.type === 'wikilink') {
      const insertion = `[[${item.label}]]`;
      const nextContent = before + insertion + after;
      onUpdateNote(note.id, { content: nextContent });
      if (item.kind === 'create') {
        onOpenWikilink(item.label);
      }
      setAutocomplete(null);
      requestAnimationFrame(() => {
        el.focus();
        const nextCursor = before.length + insertion.length;
        el.setSelectionRange(nextCursor, nextCursor);
      });
    } else {
      const insertion = `#${item.label} `;
      const nextContent = before + insertion + after;
      onUpdateNote(note.id, { content: nextContent });
      setAutocomplete(null);
      requestAnimationFrame(() => {
        el.focus();
        const nextCursor = before.length + insertion.length;
        el.setSelectionRange(nextCursor, nextCursor);
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocomplete && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocomplete((prev) =>
          prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % suggestions.length } : null
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocomplete((prev) =>
          prev
            ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + suggestions.length) % suggestions.length }
            : null
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = suggestions[autocomplete.selectedIndex] || suggestions[0];
        if (chosen) applySuggestion(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const nextContent = note.content.slice(0, start) + '  ' + note.content.slice(end);
      onUpdateNote(note.id, { content: nextContent });
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 2, start + 2);
      });
    }
  };

  const insertWrap = (prefix: string, suffix = '', placeholder = 'texto') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = note.content.slice(start, end) || placeholder;
    const insertion = `${prefix}${selected}${suffix}`;
    const nextContent = note.content.slice(0, start) + insertion + note.content.slice(end);
    onUpdateNote(note.id, { content: nextContent });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const insertLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = note.content.lastIndexOf('\n', start - 1) + 1;
    const nextContent = note.content.slice(0, lineStart) + prefix + note.content.slice(lineStart);
    onUpdateNote(note.id, { content: nextContent });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const handleToggleCheckbox = (lineIndex: number) => {
    const lines = note.content.split('\n');
    const target = lines[lineIndex];
    if (!target) return;
    if (/\[ \]/.test(target)) {
      lines[lineIndex] = target.replace('[ ]', '[x]');
    } else if (/\[[xX]\]/.test(target)) {
      lines[lineIndex] = target.replace(/\[[xX]\]/, '[ ]');
    }
    onUpdateNote(note.id, { content: lines.join('\n') });
  };

  const maturityInfo = MATURITY_CONFIG[note.maturity] || MATURITY_CONFIG.planet;
  const MaturityIcon =
    note.maturity === 'nebula' ? Sparkles : note.maturity === 'star' ? Sun : Globe;

  return (
    <div className="flex flex-col h-full bg-[#070A12] overflow-hidden">
      {/* Note Toolbar */}
      <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-b border-[#1B253B] bg-[#0A0E19] shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-[#9AA7C4] min-w-0 truncate">
          <span>Cosmos</span>
          {folderPath.length > 0 ? (
            folderPath.map((f) => (
              <React.Fragment key={f.id}>
                <span className="text-[#4B5878]">/</span>
                <span className="truncate">{f.name}</span>
              </React.Fragment>
            ))
          ) : (
            <>
              <span className="text-[#4B5878]">/</span>
              <span>Asteroide</span>
            </>
          )}
          {parentNote && (
            <>
              <span className="text-[#4B5878]">/</span>
              <button
                type="button"
                onClick={() => onOpenNote(parentNote.id)}
                className="text-[#5CA9E6] hover:text-[#E5A93B] truncate cursor-pointer"
              >
                {parentNote.title}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onFocusInCosmos(note.id)}
            title="Localizar planeta na órbita"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#9AA7C4] hover:text-[#E5A93B] hover:bg-[#121A2E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Orbit className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Localizar na Órbita</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateNote(note.id, { pinned: !note.pinned })}
            title={note.pinned ? 'Desafixar nota' : 'Fixar nota'}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              note.pinned
                ? 'text-[#E5A93B] bg-[#E5A93B]/15'
                : 'text-[#7B88A6] hover:text-[#ECEFF6] hover:bg-[#121A2E]'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center p-0.5 rounded-lg bg-[#05070D] border border-[#1B253B]">
            <button
              type="button"
              onClick={() => onChangeEditorMode('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                editorMode === 'edit'
                  ? 'bg-[#141D33] text-[#ECEFF6]'
                  : 'text-[#7B88A6] hover:text-[#D7DFEE]'
              }`}
            >
              <PenLine className="w-3 h-3" />
              <span>Escrever</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeEditorMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                editorMode === 'split'
                  ? 'bg-[#141D33] text-[#ECEFF6]'
                  : 'text-[#7B88A6] hover:text-[#D7DFEE]'
              }`}
            >
              <Columns2 className="w-3 h-3" />
              <span>Dividido</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeEditorMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                editorMode === 'preview'
                  ? 'bg-[#141D33] text-[#ECEFF6]'
                  : 'text-[#7B88A6] hover:text-[#D7DFEE]'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Leitura</span>
            </button>
          </div>
        </div>
      </div>

      {editorMode !== 'preview' && (
        <div className="flex items-center gap-1 px-5 py-1.5 border-b border-[#161F34] bg-[#060911] overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => insertLinePrefix('## ')}
            title="Título H2"
            className="p-1.5 rounded text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertWrap('**', '**', 'negrito')}
            title="Negrito"
            className="p-1.5 rounded text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertWrap('*', '*', 'itálico')}
            title="Itálico"
            className="p-1.5 rounded text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertWrap('[[', ']]', 'Nome do Planeta')}
            title="Inserir Wikilink [[...]]"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-[#5CA9E6] hover:text-[#E5A93B] hover:bg-[#121A2E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>[[Link]]</span>
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('- [ ] ')}
            title="Checklist"
            className="p-1.5 rounded text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('> ')}
            title="Citação"
            className="p-1.5 rounded text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertWrap('`', '`', 'código')}
            title="Código inline"
            className="p-1.5 rounded text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {editorMode !== 'preview' && (
          <div
            className={`relative flex flex-col min-w-0 overflow-y-auto ${
              editorMode === 'split' ? 'w-1/2 border-r border-[#1B253B]' : 'w-full'
            }`}
          >
            <div className="w-full max-w-3xl mx-auto px-6 sm:px-10 pt-7 pb-12 flex-1 flex flex-col">
              <input
                type="text"
                value={note.title}
                onChange={(e) => onUpdateNote(note.id, { title: e.target.value })}
                placeholder="Nome do corpo celeste..."
                className="w-full bg-transparent font-display text-3xl font-semibold text-[#ECEFF6] placeholder-[#4B5878] focus:outline-none tracking-tight mb-2"
              />

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#7B88A6] pb-4 mb-4 border-b border-[#161F34] tabular-nums">
                <button
                  type="button"
                  onClick={() => onUpdateNote(note.id, { maturity: maturityInfo.next })}
                  title="Clique para alternar estágio (Nebulosa / Planeta / Estrela)"
                  className={`inline-flex items-center gap-1 font-medium hover:underline underline-offset-4 cursor-pointer ${maturityInfo.color}`}
                >
                  <MaturityIcon className="w-3.5 h-3.5" />
                  <span>{maturityInfo.label}</span>
                </button>
                <span aria-hidden="true">·</span>
                <span>{stats.words} palavras</span>
                <span aria-hidden="true">·</span>
                <span>{outgoingCount} links</span>
                <span aria-hidden="true">·</span>
                <span>{backlinkCount} backlinks</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-5 text-xs">
                <span className="text-[#7B88A6]">Luas (subnotas):</span>
                {subnotes.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => onOpenNote(sub.id)}
                    className="inline-flex items-center gap-1 text-[#5CA9E6] hover:text-[#E5A93B] underline underline-offset-4 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{sub.title || 'Sem título'}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onCreateSubnote(note.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0E1526] border border-[#1B253B] text-[#9AA7C4] hover:text-[#E5A93B] hover:border-[#E5A93B]/40 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nova lua</span>
                </button>
              </div>

              <div className="relative flex-1 flex flex-col">
                <textarea
                  ref={textareaRef}
                  value={note.content}
                  onChange={(e) => {
                    onUpdateNote(note.id, { content: e.target.value });
                    detectAutocomplete(e.target.value, e.target.selectionStart);
                  }}
                  onClick={(e) =>
                    detectAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart)
                  }
                  onKeyDown={handleKeyDown}
                  placeholder="Escreva em Markdown... Digite [[ para criar pontes gravitacionais ou # para marcar tags."
                  className="w-full flex-1 min-h-[420px] resize-none bg-transparent font-mono text-[14px] leading-[1.75] text-[#D7E0F2] placeholder-[#45526E] focus:outline-none"
                />

                {autocomplete && suggestions.length > 0 && (
                  <div className="absolute left-0 top-8 z-30 w-72 rounded-lg border border-[#243456] bg-[#0B0F1A] shadow-2xl overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-[#1B253B] text-[11px] text-[#7B88A6]">
                      {autocomplete.type === 'wikilink'
                        ? 'Conectar corpo ([[...]])'
                        : 'Inserir #tag'}
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                      {suggestions.map((item, idx) => (
                        <button
                          key={`${item.kind}-${item.label}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applySuggestion(item);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                            idx === autocomplete.selectedIndex
                              ? 'bg-[#141D33] text-[#E5A93B]'
                              : 'text-[#D7DFEE] hover:bg-[#101626]'
                          }`}
                        >
                          <span className="truncate font-medium">
                            {item.kind === 'create'
                              ? `Criar novo planeta: "${item.label}"`
                              : autocomplete.type === 'tag'
                                ? `#${item.label}`
                                : item.label}
                          </span>
                          {item.kind === 'create' && (
                            <Plus className="w-3.5 h-3.5 text-[#5CA9E6] shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {editorMode !== 'edit' && (
          <div
            className={`overflow-y-auto ${
              editorMode === 'split' ? 'w-1/2 bg-[#060911]' : 'w-full'
            }`}
          >
            <div className="w-full max-w-3xl mx-auto px-6 sm:px-10 pt-7 pb-16">
              {editorMode === 'preview' && (
                <>
                  <h1 className="font-display text-3xl font-semibold text-[#ECEFF6] tracking-tight mb-2">
                    {note.title || 'Sem título'}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#7B88A6] pb-4 mb-5 border-b border-[#161F34] tabular-nums">
                    <span className={`inline-flex items-center gap-1 font-medium ${maturityInfo.color}`}>
                      <MaturityIcon className="w-3.5 h-3.5" />
                      <span>{maturityInfo.label}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{stats.words} palavras</span>
                    <span aria-hidden="true">·</span>
                    <span>{stats.minutes} min de leitura</span>
                    <span aria-hidden="true">·</span>
                    <span>{backlinkCount} backlinks</span>
                  </div>
                </>
              )}

              <MarkdownRenderer
                content={note.content}
                notes={notes}
                onOpenWikilink={onOpenWikilink}
                onClickTag={onClickTag}
                onToggleCheckbox={handleToggleCheckbox}
                blockProcessors={blockProcessors}
                blockContext={blockContext}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
