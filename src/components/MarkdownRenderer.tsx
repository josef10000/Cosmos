import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Lightbulb,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Note } from '../types/vault';
import { PluginBlockContext, PluginBlockProcessor } from '../types/plugins';
import { PluginDomHost } from '../plugins/pluginRuntime';
import { getAllNoteTags, normalizeTitle } from '../utils/markdownGraph';

interface MarkdownRendererProps {
  content: string;
  notes: Note[];
  onOpenWikilink: (targetTitle: string) => void;
  onClickTag: (tag: string) => void;
  onToggleCheckbox?: (lineIndex: number) => void;
  compact?: boolean;
  blockProcessors?: Record<string, PluginBlockProcessor>;
  blockContext?: PluginBlockContext;
  transclusionStack?: string[];
}

function extractHeadingSection(content: string, headingName: string): string {
  const targetNorm = headingName.trim().toLowerCase();
  const lines = content.split('\n');
  let startIdx = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i].trim());
    if (m && m[2].trim().toLowerCase() === targetNorm) {
      startIdx = i + 1;
      startLevel = m[1].length;
      break;
    }
  }
  if (startIdx === -1) return content;

  const sectionLines: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i].trim());
    if (m && m[1].length <= startLevel) break;
    sectionLines.push(lines[i]);
  }
  return sectionLines.join('\n').trim() || content;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  notes,
  onOpenWikilink,
  onClickTag,
  onToggleCheckbox,
  compact = false,
  blockProcessors,
  blockContext,
  transclusionStack = [],
}) => {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    note: Note;
    top: number;
    left: number;
  } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const noteByNorm = new Map<string, Note>();
  const noteTitleSet = new Set<string>();
  notes.forEach((n) => {
    const norm = normalizeTitle(n.title);
    noteTitleSet.add(norm);
    if (!noteByNorm.has(norm)) noteByNorm.set(norm, n);
    n.aliases?.forEach((a) => {
      const aNorm = normalizeTitle(a);
      noteTitleSet.add(aNorm);
      if (!noteByNorm.has(aNorm)) noteByNorm.set(aNorm, n);
    });
  });

  const scheduleHoverOpen = (targetNote: Note, el: HTMLElement) => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    const rect = el.getBoundingClientRect();
    hoverTimerRef.current = window.setTimeout(() => {
      const left = Math.min(window.innerWidth - 340, Math.max(16, rect.left));
      const top =
        rect.bottom + 240 > window.innerHeight
          ? Math.max(16, rect.top - 220)
          : rect.bottom + 8;
      setHoverPreview({ note: targetNote, top, left });
    }, 240);
  };

  const scheduleHoverClose = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverPreview(null);
    }, 180);
  };

  const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    const pattern =
      /(`[^`]+`|\[\[[^[\]]+\]\]|\*\*[^*]+\*\*|~~[^~]+~~|==[^=]+==|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|(?:^|[\s(])#[a-zA-ZÀ-ÿ0-9_-][a-zA-ZÀ-ÿ0-9_/-]*)/g;

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      const key = `${keyPrefix}-${idx++}`;

      if (token.startsWith('`') && token.endsWith('`')) {
        nodes.push(
          <code
            key={key}
            className="font-mono text-[0.86em] px-1.5 py-0.5 rounded bg-[#0E1526] text-[#E5A93B] border border-[#1B253B]"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('[[') && token.endsWith(']]')) {
        const inner = token.slice(2, -2);
        const [rawTarget, rawAlias] = inner.split('|');
        const target = rawTarget.split('#')[0].trim();
        const display = (rawAlias || rawTarget).trim();
        const normTarget = normalizeTitle(target);
        const targetNote = noteByNorm.get(normTarget);
        const exists = noteTitleSet.has(normTarget);

        nodes.push(
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHoverPreview(null);
              onOpenWikilink(target);
            }}
            onMouseEnter={(e) => {
              if (!compact && targetNote) {
                scheduleHoverOpen(targetNote, e.currentTarget);
              }
            }}
            onMouseLeave={() => {
              if (!compact) scheduleHoverClose();
            }}
            title={exists ? `Abrir "${target}"` : `Criar novo planeta "${target}"`}
            className={`inline font-medium underline underline-offset-4 transition-colors cursor-pointer ${
              exists
                ? 'text-[#5CA9E6] decoration-[#5CA9E6]/50 hover:text-[#E5A93B] hover:decoration-[#E5A93B]'
                : 'text-[#7B88A6] decoration-dashed decoration-[#4C5978] hover:text-[#E5A93B]'
            }`}
          >
            {display}
          </button>
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        nodes.push(
          <strong key={key} className="font-semibold text-[#F4F6FB]">
            {renderInline(token.slice(2, -2), key)}
          </strong>
        );
      } else if (token.startsWith('~~') && token.endsWith('~~')) {
        nodes.push(
          <del key={key} className="text-[#5B6785] line-through">
            {renderInline(token.slice(2, -2), key)}
          </del>
        );
      } else if (token.startsWith('==') && token.endsWith('==')) {
        nodes.push(
          <mark
            key={key}
            className="bg-[#E5A93B]/20 text-[#FBE6B2] px-1 rounded-sm"
          >
            {renderInline(token.slice(2, -2), key)}
          </mark>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        nodes.push(
          <em key={key} className="italic text-[#C8D3EA]">
            {renderInline(token.slice(1, -1), key)}
          </em>
        );
      } else if (token.startsWith('[')) {
        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
        if (linkMatch) {
          nodes.push(
            <a
              key={key}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
              className="text-[#5CA9E6] underline underline-offset-4 hover:text-[#E5A93B] transition-colors"
            >
              {linkMatch[1]}
            </a>
          );
        } else {
          nodes.push(token);
        }
      } else if (token.includes('#')) {
        const hashIdx = token.indexOf('#');
        const prefix = token.slice(0, hashIdx);
        const tag = token.slice(hashIdx + 1);
        if (prefix) nodes.push(prefix);
        nodes.push(
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickTag(tag.toLowerCase());
            }}
            className="inline font-mono text-[0.88em] text-[#E5A93B] hover:text-[#FBE6B2] hover:underline underline-offset-2 transition-colors cursor-pointer"
          >
            #{tag}
          </button>
        );
      } else {
        nodes.push(token);
      }

      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }
    return nodes;
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let blockId = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Transclusion: ![[Nota]] or ![[Nota#Seção]]
    const transcludeMatch = /^!\[\[([^[\]]+)\]\]$/.exec(trimmed);
    if (transcludeMatch) {
      const rawRef = transcludeMatch[1].split('|')[0].trim();
      const [rawTarget, rawSection] = rawRef.split('#');
      const targetTitle = rawTarget.trim();
      const normTarget = normalizeTitle(targetTitle);
      const embeddedNote = noteByNorm.get(normTarget);

      if (!embeddedNote) {
        elements.push(
          <div
            key={`embed-missing-${blockId++}`}
            className="my-3 rounded-r-lg border-l-2 border-[#4C5978] bg-[#0B0F1A]/60 px-3.5 py-2.5 text-xs text-[#9AA7C4] flex items-center justify-between"
          >
            <span>Transclusão não encontrada: [[{targetTitle}]]</span>
            <button
              type="button"
              onClick={() => onOpenWikilink(targetTitle)}
              className="text-[#E5A93B] hover:underline cursor-pointer"
            >
              Criar planeta
            </button>
          </div>
        );
      } else if (transclusionStack.includes(normTarget) || transclusionStack.length >= 3) {
        elements.push(
          <div
            key={`embed-cycle-${blockId++}`}
            className="my-3 rounded-r-lg border-l-2 border-[#E5A93B] bg-[#0B0F1A]/60 px-3.5 py-2 text-xs text-[#E5A93B]"
          >
            Transclusão cíclica interrompida: [[{embeddedNote.title}]]
          </div>
        );
      } else {
        const bodySlice = rawSection
          ? extractHeadingSection(embeddedNote.content, rawSection)
          : embeddedNote.content;

        elements.push(
          <div
            key={`embed-${blockId++}`}
            className="my-3.5 rounded-r-xl border border-[#1B253B] border-l-2 border-l-[#5CA9E6] bg-[#0A0F1B]/85 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-[#161F34] bg-[#070B14] text-xs">
              <span className="font-semibold text-[#5CA9E6] truncate">
                {embeddedNote.title}
                {rawSection ? ` › ${rawSection.trim()}` : ''}
              </span>
              <button
                type="button"
                onClick={() => onOpenWikilink(embeddedNote.title)}
                title={`Abrir "${embeddedNote.title}"`}
                className="flex items-center gap-1 text-[11px] text-[#9AA7C4] hover:text-[#E5A93B] cursor-pointer shrink-0"
              >
                <span>Abrir</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3.5 py-2.5 max-h-64 overflow-y-auto">
              <MarkdownRenderer
                content={bodySlice}
                notes={notes}
                onOpenWikilink={onOpenWikilink}
                onClickTag={onClickTag}
                compact
                blockProcessors={blockProcessors}
                blockContext={blockContext}
                transclusionStack={[...transclusionStack, normTarget]}
              />
            </div>
          </div>
        );
      }
      i++;
      continue;
    }

    // Inline Flashcard Q :: A formatting
    const fcMatch = /^(.+?)\s*::\s*(.+)$/.exec(trimmed);
    if (fcMatch && !trimmed.startsWith('|') && !trimmed.startsWith('```')) {
      elements.push(
        <div
          key={`fc-${blockId++}`}
          className="my-2 rounded-lg border border-[#1B253B] bg-[#090D18] px-3.5 py-2.5 text-xs space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#ECEFF6]">
              {renderInline(fcMatch[1], `fcq-${blockId}`)}
            </span>
            <span className="font-mono text-[10px] text-[#E5A93B] shrink-0">FLASHCARD</span>
          </div>
          <div className="text-[#9AA7C4] pl-2 border-l border-[#E5A93B]/40">
            {renderInline(fcMatch[2], `fca-${blockId}`)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const currentBlock = blockId++;
      const codeStr = codeLines.join('\n');
      const langKey = lang.toLowerCase();
      const processor = blockProcessors?.[langKey];

      if (processor && blockContext) {
        if (processor.kind === 'react') {
          elements.push(
            <div key={`plugin-block-${currentBlock}`}>
              {processor.render(codeStr, blockContext)}
            </div>
          );
        } else {
          elements.push(
            <div key={`plugin-dom-block-${currentBlock}`} className="my-3">
              <PluginDomHost
                depsKey={`${langKey}:${codeStr}:${blockContext.note?.id || ''}`}
                renderDom={(el) => processor.render(codeStr, el, blockContext)}
              />
            </div>
          );
        }
        continue;
      }

      elements.push(
        <div
          key={`code-${currentBlock}`}
          className="my-3 rounded-lg border border-[#1B253B] bg-[#05070D] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1B253B] bg-[#0A0E19] text-[11px] font-mono text-[#7B88A6]">
            <span>{lang || 'texto'}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(codeStr);
                setCopiedBlock(currentBlock);
                setTimeout(() => setCopiedBlock(null), 1500);
              }}
              className="flex items-center gap-1 text-[#9AA7C4] hover:text-[#ECEFF6] transition-colors cursor-pointer"
            >
              {copiedBlock === currentBlock ? (
                <>
                  <Check className="w-3 h-3 text-[#5CA9E6]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed font-mono text-[#D1DAF0]">
            <code>{codeStr}</code>
          </pre>
        </div>
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${blockId++}`} className="my-5 border-[#1B253B]" />);
      i++;
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingClasses = [
        '',
        compact
          ? 'font-display text-lg font-semibold text-[#ECEFF6] mt-3 mb-2 tracking-tight'
          : 'font-display text-2xl font-semibold text-[#ECEFF6] mt-6 mb-3 tracking-tight',
        compact
          ? 'font-display text-base font-semibold text-[#ECEFF6] mt-3 mb-1.5'
          : 'font-display text-xl font-semibold text-[#ECEFF6] mt-5 mb-2.5 pb-1.5 border-b border-[#1B253B]',
        'text-base font-semibold text-[#D7E4FA] mt-4 mb-2',
        'text-sm font-semibold text-[#9AA7C4] mt-3 mb-1.5',
      ][level];

      elements.push(
        <div key={`h-${blockId++}`} id={`heading-line-${i}`} className={headingClasses}>
          {renderInline(text, `h-${i}`)}
        </div>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const firstLine = quoteLines[0] || '';
      const calloutMatch = /^\[!(tip|note|important|warning|info)\]\s*(.*)$/i.exec(firstLine);

      if (calloutMatch) {
        const type = calloutMatch[1].toLowerCase();
        const title = calloutMatch[2] || type.charAt(0).toUpperCase() + type.slice(1);
        const bodyLines = quoteLines.slice(1);
        const isAmber = type === 'tip' || type === 'warning' || type === 'important';
        const Icon =
          type === 'tip'
            ? Lightbulb
            : type === 'warning'
              ? AlertTriangle
              : type === 'important'
                ? Sparkles
                : Info;

        elements.push(
          <div
            key={`callout-${blockId++}`}
            className={`my-3.5 rounded-lg border p-3.5 ${
              isAmber
                ? 'border-[#E5A93B]/35 bg-[#E5A93B]/[0.06]'
                : 'border-[#5CA9E6]/35 bg-[#5CA9E6]/[0.06]'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold mb-1.5">
              <Icon className={`w-4 h-4 shrink-0 ${isAmber ? 'text-[#E5A93B]' : 'text-[#5CA9E6]'}`} />
              <span className={isAmber ? 'text-[#FBE6B2]' : 'text-[#BAE6FD]'}>{title}</span>
            </div>
            <div className="text-[14px] leading-relaxed text-[#CBD5E8] space-y-1">
              {bodyLines.map((bl, bi) => (
                <p key={bi}>{renderInline(bl, `co-${blockId}-${bi}`)}</p>
              ))}
            </div>
          </div>
        );
      } else {
        elements.push(
          <blockquote
            key={`quote-${blockId++}`}
            className="my-3.5 rounded-lg border border-[#1B253B] bg-[#0B0F1A] px-4 py-3 text-[14px] italic leading-relaxed text-[#B2C0DB]"
          >
            {quoteLines.map((ql, qi) => (
              <p key={qi}>{renderInline(ql, `q-${blockId}-${qi}`)}</p>
            ))}
          </blockquote>
        );
      }
      continue;
    }

    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\|?[\s:-]+\|/.test(lines[i + 1].trim())
    ) {
      const parseRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }

      elements.push(
        <div key={`table-${blockId++}`} className="my-4 overflow-x-auto rounded-lg border border-[#1B253B]">
          <table className="w-full text-left text-[13.5px] border-collapse">
            <thead>
              <tr className="bg-[#0B0F1A] border-b border-[#1B253B] text-[#ECEFF6]">
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3.5 py-2 font-semibold">
                    {renderInline(h, `th-${blockId}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151D30]">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-[#0B0F1A]/60 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3.5 py-2 text-[#C2CCE0]">
                      {renderInline(cell, `td-${blockId}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: { lineIndex: number; text: string; checked?: boolean }[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        const rawItem = lines[i].trim().replace(/^[-*+]\s+/, '');
        const taskMatch = /^\[([ xX])\]\s*(.*)$/.exec(rawItem);
        if (taskMatch) {
          items.push({
            lineIndex: i,
            checked: taskMatch[1].toLowerCase() === 'x',
            text: taskMatch[2],
          });
        } else {
          items.push({ lineIndex: i, text: rawItem });
        }
        i++;
      }
      elements.push(
        <ul key={`ul-${blockId++}`} className="my-2.5 space-y-1.5 text-[15px] leading-relaxed text-[#D2DCF0]">
          {items.map((item) =>
            item.checked !== undefined ? (
              <li key={item.lineIndex} className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => onToggleCheckbox?.(item.lineIndex)}
                  aria-label="Alternar tarefa"
                  className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    item.checked
                      ? 'bg-[#5CA9E6] border-[#5CA9E6] text-[#05070D]'
                      : 'border-[#2E3F66] bg-[#05070D] hover:border-[#E5A93B]'
                  }`}
                >
                  {item.checked && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <span className={item.checked ? 'line-through text-[#5B6785]' : ''}>
                  {renderInline(item.text, `task-${item.lineIndex}`)}
                </span>
              </li>
            ) : (
              <li key={item.lineIndex} className="flex items-start gap-2.5 pl-1">
                <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-[#5CA9E6] shrink-0" />
                <span>{renderInline(item.text, `li-${item.lineIndex}`)}</span>
              </li>
            )
          )}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: { num: string; text: string; lineIndex: number }[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const m = /^(\d+)\.\s+(.*)$/.exec(lines[i].trim());
        if (m) items.push({ num: m[1], text: m[2], lineIndex: i });
        i++;
      }
      elements.push(
        <ol key={`ol-${blockId++}`} className="my-2.5 space-y-1.5 text-[15px] leading-relaxed text-[#D2DCF0]">
          {items.map((item) => (
            <li key={item.lineIndex} className="flex items-start gap-2.5 pl-1">
              <span className="font-mono text-xs text-[#E5A93B] mt-1 tabular-nums shrink-0 w-4">
                {item.num}.
              </span>
              <span>{renderInline(item.text, `ol-${item.lineIndex}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```') &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p
          key={`p-${blockId++}`}
          className={`my-2.5 text-[#D2DCF0] leading-[1.7] ${compact ? 'text-[13.5px]' : 'text-[15px]'}`}
        >
          {renderInline(paraLines.join(' '), `p-${blockId}`)}
        </p>
      );
    } else {
      i++;
    }
  }

  return (
    <div className="max-w-none relative">
      {elements}

      {!compact && hoverPreview && (
        <div
          onMouseEnter={() => {
            if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
          }}
          onMouseLeave={scheduleHoverClose}
          style={{ top: hoverPreview.top, left: hoverPreview.left }}
          className="fixed z-50 w-80 max-h-60 flex flex-col rounded-xl border border-[#243456] bg-[#0B0F1A]/97 backdrop-blur-md shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#161F34] bg-[#070B14]">
            <div className="flex items-center gap-1.5 min-w-0">
              {hoverPreview.note.maturity === 'nebula' ? (
                <Sparkles className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              ) : hoverPreview.note.maturity === 'star' ? (
                <Sun className="w-3.5 h-3.5 text-[#E5A93B] shrink-0" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[#5CA9E6] shrink-0" />
              )}
              <span className="text-xs font-semibold text-[#ECEFF6] truncate">
                {hoverPreview.note.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const t = hoverPreview.note.title;
                setHoverPreview(null);
                onOpenWikilink(t);
              }}
              className="text-[11px] text-[#E5A93B] hover:underline cursor-pointer shrink-0"
            >
              Abrir
            </button>
          </div>
          <div className="p-3 overflow-y-auto text-xs space-y-2">
            {getAllNoteTags(hoverPreview.note).length > 0 && (
              <div className="font-mono text-[10px] text-[#E5A93B] truncate">
                {getAllNoteTags(hoverPreview.note)
                  .slice(0, 4)
                  .map((t) => `#${t}`)
                  .join(' ')}
              </div>
            )}
            <MarkdownRenderer
              content={hoverPreview.note.content.slice(0, 480)}
              notes={notes}
              onOpenWikilink={onOpenWikilink}
              onClickTag={onClickTag}
              compact
              transclusionStack={[...transclusionStack, normalizeTitle(hoverPreview.note.title)]}
            />
          </div>
        </div>
      )}
    </div>
  );
};
