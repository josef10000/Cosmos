import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Layers,
  Play,
  Plus,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  PluginBlockContext,
  PluginBlockProcessor,
  PluginCommand,
  PluginRibbonItem,
  PluginSidebarTab,
  PluginStatusBarItem,
  PluginUIContext,
} from '../types/plugins';
import { Note } from '../types/vault';
import { getFrontmatterMap } from '../utils/frontmatter';
import { countWordsAndChars, getAllNoteTags, GraphIndex } from '../utils/markdownGraph';
import { extractFlashcardsFromNotes, FlashcardProgress } from './flashcardsEngine';

// ---------------------------------------------------------------------------
// 1. Dataview Cósmico Block Renderer
// ---------------------------------------------------------------------------
const DataviewBlock: React.FC<{ source: string; ctx: PluginBlockContext }> = ({
  source,
  ctx,
}) => {
  const result = useMemo(() => {
    const lines = source
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let mode = 'table' as 'table' | 'list' | 'chart';
    let chartBy = 'maturity';
    let tableFields: string[] = [];
    let fromTag: string | null = null;
    let fromFolder: string | null = null;
    let whereProp: { key: string; op: '=' | '!='; val: string } | null = null;
    let sortField = 'updated';
    let sortDir: 'asc' | 'desc' = 'desc';
    let limit = 25;

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('CHART') || upper.startsWith('BAR')) {
        mode = 'chart';
        const byMatch = /\bBY\s+([a-zA-ZÀ-ÿ0-9_-]+)/i.exec(line);
        if (byMatch) chartBy = byMatch[1].toLowerCase();
      } else if (upper.startsWith('LIST')) {
        mode = 'list';
      } else if (upper.startsWith('TABLE')) {
        mode = 'table';
        const colsRaw = line.slice(5).trim();
        if (colsRaw) {
          tableFields = colsRaw
            .split(',')
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean);
        }
      } else if (upper.startsWith('FROM ')) {
        const arg = line.slice(5).trim();
        if (arg.startsWith('#')) {
          fromTag = arg.slice(1).toLowerCase();
        } else {
          fromFolder = arg.replace(/^["']|["']$/g, '').toLowerCase();
        }
      } else if (upper.startsWith('WHERE ')) {
        const expr = line.slice(6).trim();
        const m = /^([a-zA-ZÀ-ÿ0-9_-]+)\s*(=|!=)\s*(.+)$/i.exec(expr);
        if (m) {
          whereProp = {
            key: m[1].toLowerCase(),
            op: m[2] as '=' | '!=',
            val: m[3].trim().replace(/^["']|["']$/g, '').toLowerCase(),
          };
        }
      } else if (upper.startsWith('SORT ')) {
        const parts = line.slice(5).trim().split(/\s+/);
        if (parts[0]) sortField = parts[0].toLowerCase();
        const d = (parts[1] || '').toLowerCase();
        if (d === 'asc' || d === 'desc') {
          sortDir = d;
        }
      } else if (upper.startsWith('LIMIT ')) {
        const n = Number(line.slice(6).trim());
        if (Number.isFinite(n) && n > 0) limit = Math.min(100, n);
      }
    }

    const folderById = new Map(ctx.folders.map((f) => [f.id, f]));

    const getFieldVal = (note: Note, field: string): string | number => {
      if (field === 'title' || field === 'título') return note.title || 'Sem título';
      if (field === 'maturity' || field === 'estágio') return note.maturity;
      if (field === 'words' || field === 'palavras') return countWordsAndChars(note.content).words;
      if (field === 'updated') return note.updatedAt;
      if (field === 'folder' || field === 'estrela') {
        return note.folderId ? folderById.get(note.folderId)?.name || 'Asteroide' : 'Asteroide';
      }
      if (field === 'tags') return getAllNoteTags(note).join(', ');
      const fm = getFrontmatterMap(note.content);
      const val = fm[field];
      if (Array.isArray(val)) return val.join(', ');
      if (val !== undefined) return typeof val === 'number' ? val : String(val);
      return '';
    };

    let rows = ctx.notes.filter((n) => {
      if (fromTag) {
        const tags = getAllNoteTags(n).map((t) => t.toLowerCase());
        if (!tags.includes(fromTag)) return false;
      }
      if (fromFolder) {
        const fname = n.folderId ? folderById.get(n.folderId)?.name.toLowerCase() || '' : '';
        if (!fname.includes(fromFolder)) return false;
      }
      if (whereProp) {
        const val = String(getFieldVal(n, whereProp.key)).toLowerCase();
        const matches = val === whereProp.val;
        if (whereProp.op === '=' && !matches) return false;
        if (whereProp.op === '!=' && matches) return false;
      }
      return true;
    });

    rows = rows.slice().sort((a, b) => {
      const va = getFieldVal(a, sortField);
      const vb = getFieldVal(b, sortField);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt-BR');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const sliced = rows.slice(0, limit);
    const chartBars: { label: string; value: number; noteId?: string }[] = [];

    if (mode === 'chart') {
      if (chartBy === 'tag' || chartBy === 'tags') {
        const counts = new Map<string, number>();
        sliced.forEach((n) => {
          getAllNoteTags(n).forEach((t) => counts.set(`#${t}`, (counts.get(`#${t}`) || 0) + 1));
        });
        Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .forEach(([label, value]) => chartBars.push({ label, value }));
      } else if (chartBy === 'words' || chartBy === 'palavras') {
        sliced.slice(0, 8).forEach((n) => {
          chartBars.push({
            label: n.title || 'Sem título',
            value: countWordsAndChars(n.content).words,
            noteId: n.id,
          });
        });
      } else {
        const numericEntries = sliced
          .map((n) => ({ n, v: getFieldVal(n, chartBy) }))
          .filter((x) => typeof x.v === 'number' && x.v !== 0);

        if (numericEntries.length > 0 && chartBy !== 'updated') {
          numericEntries.slice(0, 8).forEach(({ n, v }) => {
            chartBars.push({
              label: n.title || 'Sem título',
              value: Number(v),
              noteId: n.id,
            });
          });
        } else {
          const counts = new Map<string, number>();
          sliced.forEach((n) => {
            let key = String(getFieldVal(n, chartBy) || 'Não definido');
            if (chartBy === 'maturity') {
              key = key === 'star' ? 'Estrela' : key === 'nebula' ? 'Nebulosa' : 'Planeta';
            }
            counts.set(key, (counts.get(key) || 0) + 1);
          });
          Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .forEach(([label, value]) => chartBars.push({ label, value }));
        }
      }
    }

    return { mode, chartBy, chartBars, tableFields, rows: sliced, getFieldVal };
  }, [source, ctx.notes, ctx.folders]);

  const maturityLabel = (m: string) =>
    m === 'star' ? 'Estrela' : m === 'nebula' ? 'Nebulosa' : 'Planeta';

  const maxChartVal = Math.max(1, ...result.chartBars.map((b) => b.value));
  const activeColumns =
    result.tableFields.length > 0 ? result.tableFields : ['maturity', 'tags', 'words'];

  return (
    <div className="my-4 rounded-xl border border-[#1B253B] bg-[#070B14] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#161F34] bg-[#0A0E19] text-[11px] font-mono text-[#7B88A6]">
        <span className="text-[#5CA9E6] font-semibold">
          {result.mode === 'chart' ? `DATAVIEW GRÁFICO (${result.chartBy})` : 'DATAVIEW CÓSMICO'}
        </span>
        <span>{result.rows.length} corpos encontrados</span>
      </div>

      {result.rows.length === 0 ? (
        <div className="p-4 text-xs text-[#7B88A6]">
          Nenhum planeta corresponde a esta consulta. Tente <code className="text-[#E5A93B]">FROM #cosmos</code>,{' '}
          <code className="text-[#E5A93B]">CHART BY maturity</code> ou{' '}
          <code className="text-[#E5A93B]">SORT updated DESC</code>.
        </div>
      ) : result.mode === 'chart' ? (
        <div className="p-3.5 space-y-2.5">
          {result.chartBars.length === 0 ? (
            <p className="text-xs text-[#7B88A6]">Sem dados suficientes para gerar o gráfico.</p>
          ) : (
            result.chartBars.map((bar, idx) => {
              const widthPct = Math.max(4, Math.round((bar.value / maxChartVal) * 100));
              const isAmber = idx % 2 === 0;
              return (
                <div key={bar.label + idx} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    {bar.noteId ? (
                      <button
                        type="button"
                        onClick={() => ctx.openNote(bar.noteId!)}
                        className="text-[#5CA9E6] hover:text-[#E5A93B] truncate font-medium cursor-pointer"
                      >
                        {bar.label}
                      </button>
                    ) : bar.label.startsWith('#') ? (
                      <button
                        type="button"
                        onClick={() => ctx.clickTag(bar.label.slice(1))}
                        className="font-mono text-[#E5A93B] hover:underline truncate cursor-pointer"
                      >
                        {bar.label}
                      </button>
                    ) : (
                      <span className="text-[#D7DFEE] truncate font-medium">{bar.label}</span>
                    )}
                    <span className="font-mono text-[11px] text-[#9AA7C4] tabular-nums shrink-0">
                      {bar.value}
                    </span>
                  </div>
                  <svg className="w-full h-2.5 overflow-visible" viewBox="0 0 100 6" preserveAspectRatio="none">
                    <rect x={0} y={0} width={100} height={6} rx={3} fill="#05070D" />
                    <rect
                      x={0}
                      y={0}
                      width={widthPct}
                      height={6}
                      rx={3}
                      fill={isAmber ? '#E5A93B' : '#5CA9E6'}
                    />
                  </svg>
                </div>
              );
            })
          )}
        </div>
      ) : result.mode === 'list' ? (
        <ul className="divide-y divide-[#141C2E] text-xs">
          {result.rows.map((n) => (
            <li key={n.id} className="px-3.5 py-2 flex items-center justify-between gap-2 hover:bg-[#0C1220]">
              <button
                type="button"
                onClick={() => ctx.openNote(n.id)}
                className="text-[#5CA9E6] hover:text-[#E5A93B] font-medium text-left truncate cursor-pointer"
              >
                {n.title || 'Sem título'}
              </button>
              <span className="text-[11px] text-[#7B88A6] shrink-0">{maturityLabel(n.maturity)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#161F34] bg-[#090D18] text-[#9AA7C4]">
                <th className="px-3.5 py-2 font-medium">Corpo Celeste</th>
                <th className="px-3 py-2 font-medium">Estágio</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium text-right">Palavras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131B2D]">
              {result.rows.map((n) => {
                const tags = getAllNoteTags(n).slice(0, 3);
                const stats = countWordsAndChars(n.content);
                return (
                  <tr key={n.id} className="hover:bg-[#0C1220] transition-colors">
                    <td className="px-3.5 py-2 font-medium">
                      <button
                        type="button"
                        onClick={() => ctx.openNote(n.id)}
                        className="text-[#5CA9E6] hover:text-[#E5A93B] text-left cursor-pointer"
                      >
                        {n.title || 'Sem título'}
                      </button>
                    </td>
                    <td className="px-3.5 py-2 text-[#C2CCE0]">{maturityLabel(n.maturity)}</td>
                    <td className="px-3.5 py-2 font-mono text-[11px] text-[#E5A93B]">
                      {tags.length > 0 ? tags.map((t) => `#${t}`).join(' ') : '—'}
                    </td>
                    <td className="px-3.5 py-2 text-right font-mono text-[#7B88A6] tabular-nums">
                      {stats.words}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Quadro Kanban Orbital Block Renderer
// ---------------------------------------------------------------------------
interface KanbanColumn {
  title: string;
  cards: { text: string; done: boolean }[];
}

function parseKanban(source: string): KanbanColumn[] {
  const cols: KanbanColumn[] = [];
  let current: KanbanColumn | null = null;
  for (const rawLine of source.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const h = /^#{1,3}\s+(.+)$/.exec(trimmed);
    if (h) {
      current = { title: h[1].trim(), cards: [] };
      cols.push(current);
      continue;
    }
    const task = /^[-*+]\s+\[([ xX])\]\s*(.+)$/.exec(trimmed);
    if (task) {
      if (!current) {
        current = { title: 'Tarefas', cards: [] };
        cols.push(current);
      }
      current.cards.push({ done: task[1].toLowerCase() === 'x', text: task[2].trim() });
      continue;
    }
    const plain = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (plain) {
      if (!current) {
        current = { title: 'Tarefas', cards: [] };
        cols.push(current);
      }
      current.cards.push({ done: false, text: plain[1].trim() });
    }
  }
  return cols;
}

function serializeKanban(cols: KanbanColumn[]): string {
  return cols
    .map((c) => {
      const lines = [`## ${c.title}`];
      c.cards.forEach((card) => {
        lines.push(`- [${card.done ? 'x' : ' '}] ${card.text}`);
      });
      return lines.join('\n');
    })
    .join('\n\n');
}

const KanbanBlock: React.FC<{ source: string; ctx: PluginBlockContext }> = ({ source, ctx }) => {
  const columns = useMemo(() => parseKanban(source), [source]);
  const [addingColIdx, setAddingColIdx] = useState<number | null>(null);
  const [newCardText, setNewCardText] = useState('');

  const commitColumns = (nextCols: KanbanColumn[]) => {
    if (!ctx.note) return;
    const nextBlock = serializeKanban(nextCols);
    const updatedContent = ctx.note.content.replace(
      '```kanban\n' + source + '\n```',
      '```kanban\n' + nextBlock + '\n```'
    );
    if (updatedContent !== ctx.note.content) {
      ctx.updateActiveNoteContent(updatedContent);
    } else {
      // Fallback tolerant replacement for CRLF / spacing variations
      const regex = /```kanban\s*\n([\s\S]*?)```/;
      ctx.updateActiveNoteContent(
        ctx.note.content.replace(regex, `\`\`\`kanban\n${nextBlock}\n\`\`\``)
      );
    }
  };

  const toggleCard = (colIdx: number, cardIdx: number) => {
    const next = columns.map((c, ci) =>
      ci !== colIdx
        ? c
        : {
            ...c,
            cards: c.cards.map((card, ki) =>
              ki === cardIdx ? { ...card, done: !card.done } : card
            ),
          }
    );
    commitColumns(next);
  };

  const moveCard = (colIdx: number, cardIdx: number, delta: -1 | 1) => {
    const targetCol = colIdx + delta;
    if (targetCol < 0 || targetCol >= columns.length) return;
    const card = columns[colIdx].cards[cardIdx];
    const next = columns.map((c, ci) => {
      if (ci === colIdx) {
        return { ...c, cards: c.cards.filter((_, ki) => ki !== cardIdx) };
      }
      if (ci === targetCol) {
        return { ...c, cards: [...c.cards, card] };
      }
      return c;
    });
    commitColumns(next);
  };

  const addCard = (colIdx: number) => {
    const text = newCardText.trim();
    if (!text) {
      setAddingColIdx(null);
      return;
    }
    const next = columns.map((c, ci) =>
      ci === colIdx ? { ...c, cards: [...c.cards, { text, done: false }] } : c
    );
    commitColumns(next);
    setNewCardText('');
    setAddingColIdx(null);
  };

  return (
    <div className="my-4 rounded-xl border border-[#1B253B] bg-[#070B14] p-3">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <span className="text-[11px] font-mono font-semibold text-[#E5A93B]">
          QUADRO KANBAN
        </span>
        <span className="text-[11px] text-[#7B88A6]">
          Sincronizado com Markdown
        </span>
      </div>
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
        {columns.map((col, colIdx) => (
          <div
            key={colIdx}
            className="rounded-lg border border-[#161F34] bg-[#0B0F1A] p-2.5 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#ECEFF6] pb-1 border-b border-[#161F34]">
              <span className="truncate">{col.title}</span>
              <span className="font-mono text-[10px] text-[#7B88A6]">{col.cards.length}</span>
            </div>

            <div className="space-y-1.5">
              {col.cards.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  className="group rounded-md border border-[#1A243C] bg-[#060911] p-2 text-xs text-[#D2DCF0] flex items-start justify-between gap-1.5"
                >
                  <button
                    type="button"
                    onClick={() => toggleCard(colIdx, cardIdx)}
                    className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                      card.done
                        ? 'bg-[#5CA9E6] border-[#5CA9E6] text-[#05070D]'
                        : 'border-[#2E3F66] hover:border-[#E5A93B]'
                    }`}
                  >
                    {card.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </button>
                  <span className={`flex-1 leading-snug ${card.done ? 'line-through text-[#5B6785]' : ''}`}>
                    {card.text}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 shrink-0">
                    {colIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => moveCard(colIdx, cardIdx, -1)}
                        title="Mover para esquerda"
                        className="p-0.5 rounded hover:bg-[#131C31] text-[#9AA7C4] hover:text-[#E5A93B] cursor-pointer"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                    )}
                    {colIdx < columns.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveCard(colIdx, cardIdx, 1)}
                        title="Mover para direita"
                        className="p-0.5 rounded hover:bg-[#131C31] text-[#9AA7C4] hover:text-[#E5A93B] cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {addingColIdx === colIdx ? (
              <input
                type="text"
                autoFocus
                value={newCardText}
                onChange={(e) => setNewCardText(e.target.value)}
                onBlur={() => addCard(colIdx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCard(colIdx);
                  if (e.key === 'Escape') {
                    setNewCardText('');
                    setAddingColIdx(null);
                  }
                }}
                placeholder="Nova tarefa..."
                className="w-full px-2 py-1 rounded bg-[#05070D] border border-[#E5A93B] text-xs text-[#ECEFF6] focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingColIdx(colIdx)}
                className="flex items-center gap-1 text-[11px] text-[#7B88A6] hover:text-[#E5A93B] py-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Cartão</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Telemetria do Vault Sidebar Tab
// ---------------------------------------------------------------------------
const VaultAnalyticsTab: React.FC<{ ctx: PluginUIContext; graphIndex: GraphIndex }> = ({
  ctx,
  graphIndex,
}) => {
  const stats = useMemo(() => {
    let totalWords = 0;
    let nebulae = 0;
    let planets = 0;
    let stars = 0;
    let tasksTotal = 0;
    let tasksDone = 0;

    for (const n of ctx.notes) {
      totalWords += countWordsAndChars(n.content).words;
      if (n.maturity === 'nebula') nebulae++;
      else if (n.maturity === 'star') stars++;
      else planets++;

      const doneMatches = n.content.match(/^\s*[-*+]\s+\[[xX]\]/gm);
      const openMatches = n.content.match(/^\s*[-*+]\s+\[ \]/gm);
      tasksDone += doneMatches ? doneMatches.length : 0;
      tasksTotal += (doneMatches ? doneMatches.length : 0) + (openMatches ? openMatches.length : 0);
    }

    const topHubs = ctx.notes
      .map((n) => ({
        note: n,
        degree:
          (graphIndex.backlinksByNote[n.id]?.length || 0) +
          (graphIndex.outgoingByNote[n.id]?.length || 0),
      }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5);

    const orphans = ctx.notes.filter(
      (n) =>
        (graphIndex.backlinksByNote[n.id]?.length || 0) === 0 &&
        (graphIndex.outgoingByNote[n.id]?.length || 0) === 0
    );

    return {
      totalWords,
      nebulae,
      planets,
      stars,
      tasksTotal,
      tasksDone,
      topHubs,
      orphans,
    };
  }, [ctx.notes, graphIndex]);

  const totalBodies = Math.max(1, ctx.notes.length);

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg bg-[#0B0F1A] border border-[#182238]">
          <div className="text-[11px] text-[#7B88A6]">Corpos no Vault</div>
          <div className="text-lg font-display font-semibold text-[#ECEFF6] tabular-nums">
            {ctx.notes.length}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-[#0B0F1A] border border-[#182238]">
          <div className="text-[11px] text-[#7B88A6]">Total de Palavras</div>
          <div className="text-lg font-display font-semibold text-[#E5A93B] tabular-nums">
            {stats.totalWords}
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-[#0B0F1A] border border-[#182238] space-y-2">
        <div className="text-[#ECEFF6] font-semibold">Ciclo Estelar</div>
        <div className="h-2 rounded-full overflow-hidden bg-[#05070D] flex">
          <div
            style={{ width: `${(stats.nebulae / totalBodies) * 100}%` }}
            className="bg-[#38BDF8]"
          />
          <div
            style={{ width: `${(stats.planets / totalBodies) * 100}%` }}
            className="bg-[#5CA9E6]"
          />
          <div
            style={{ width: `${(stats.stars / totalBodies) * 100}%` }}
            className="bg-[#E5A93B]"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#9AA7C4] tabular-nums">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#38BDF8]" />
            {stats.nebulae} Neb.
          </span>
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-[#5CA9E6]" />
            {stats.planets} Plan.
          </span>
          <span className="flex items-center gap-1">
            <Sun className="w-3 h-3 text-[#E5A93B]" />
            {stats.stars} Est.
          </span>
        </div>
      </div>

      {stats.tasksTotal > 0 && (
        <div className="p-3 rounded-lg bg-[#0B0F1A] border border-[#182238] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[#ECEFF6] font-semibold">Checklists do Vault</span>
            <span className="font-mono text-[11px] text-[#5CA9E6]">
              {stats.tasksDone}/{stats.tasksTotal}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#05070D] overflow-hidden">
            <div
              style={{ width: `${(stats.tasksDone / stats.tasksTotal) * 100}%` }}
              className="h-full bg-[#5CA9E6]"
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5 pt-2 border-t border-[#161F34]">
        <div className="text-[#ECEFF6] font-semibold">Maiores Atratores Gravitacionais</div>
        {stats.topHubs.map(({ note, degree }) => (
          <button
            key={note.id}
            type="button"
            onClick={() => ctx.openNote(note.id)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#0B0F1A] border border-[#182238] hover:border-[#E5A93B]/50 text-left cursor-pointer"
          >
            <span className="truncate text-[#D7DFEE]">{note.title}</span>
            <span className="font-mono text-[11px] text-[#E5A93B] shrink-0">{degree} links</span>
          </button>
        ))}
      </div>

      {stats.orphans.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[#161F34]">
          <div className="text-[#9AA7C4] font-semibold">
            Notas Sem Conexões ({stats.orphans.length})
          </div>
          {stats.orphans.slice(0, 4).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => ctx.openNote(o.id)}
              className="w-full text-left px-2.5 py-1 rounded text-[#7B88A6] hover:text-[#E5A93B] hover:bg-[#0F1628] truncate cursor-pointer"
            >
              {o.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Flashcards Deck Sidebar Tab
// ---------------------------------------------------------------------------
const FlashcardsDeckTab: React.FC<{
  ctx: PluginUIContext;
  progressMap: Record<string, FlashcardProgress>;
  onOpenReview: () => void;
  onInsertSample: () => void;
}> = ({ ctx, progressMap, onOpenReview, onInsertSample }) => {
  const cards = useMemo(() => extractFlashcardsFromNotes(ctx.notes), [ctx.notes]);
  const now = Date.now();
  const dueCount = cards.filter((c) => {
    const p = progressMap[c.id];
    return !p || p.nextReviewAt <= now;
  }).length;

  const byNote = useMemo(() => {
    const map = new Map<string, { title: string; total: number; due: number }>();
    cards.forEach((c) => {
      const p = progressMap[c.id];
      const isDue = !p || p.nextReviewAt <= now;
      const cur = map.get(c.noteId) || { title: c.noteTitle, total: 0, due: 0 };
      cur.total++;
      if (isDue) cur.due++;
      map.set(c.noteId, cur);
    });
    return Array.from(map.entries());
  }, [cards, progressMap, now]);

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
      <div className="p-3 rounded-xl border border-[#1B253B] bg-[#0B0F1A] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#ECEFF6]">Revisão Espaçada</span>
          <span className="font-mono text-[#E5A93B]">{dueCount} pendentes</span>
        </div>
        <button
          type="button"
          onClick={onOpenReview}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#E5A93B] text-[#05070D] font-semibold hover:bg-[#F3BA52] transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Iniciar Sessão ({cards.length} cartões)</span>
        </button>
      </div>

      <div className="p-2.5 rounded-lg border border-[#161F34] bg-[#060911] text-[11px] text-[#9AA7C4] space-y-1.5">
        <div>
          Escreva <code className="font-mono text-[#E5A93B]">Pergunta :: Resposta</code> em qualquer nota.
        </div>
        <button
          type="button"
          onClick={onInsertSample}
          className="text-[#5CA9E6] hover:text-[#E5A93B] underline cursor-pointer"
        >
          + Inserir cartão na nota ativa
        </button>
      </div>

      {byNote.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[#ECEFF6] font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#5CA9E6]" />
            <span>Baralhos por Planeta</span>
          </div>
          {byNote.map(([noteId, info]) => (
            <button
              key={noteId}
              type="button"
              onClick={() => ctx.openNote(noteId)}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#0B0F1A] border border-[#182238] hover:border-[#E5A93B]/50 text-left cursor-pointer"
            >
              <span className="truncate text-[#D7DFEE]">{info.title}</span>
              <span className="font-mono text-[11px] text-[#E5A93B] shrink-0">
                {info.due}/{info.total}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Registry Builder for Enabled Official Plugins
// ---------------------------------------------------------------------------
export interface BuiltInHookDeps {
  enabledIds: Set<string>;
  notes: Note[];
  graphIndex: GraphIndex;
  appendToActiveNote: (text: string) => void;
  notify: (msg: string, tone?: 'info' | 'success' | 'error', pluginName?: string) => void;
  pomodoroState: {
    mode: 'focus' | 'break';
    secondsLeft: number;
    running: boolean;
  };
  pomodoroControls: {
    toggle: () => void;
    switchMode: () => void;
    reset: () => void;
  };
  flashcardsControls: {
    progressMap: Record<string, FlashcardProgress>;
    openReview: () => void;
    insertSample: () => void;
  };
}

export function buildBuiltInContributions(deps: BuiltInHookDeps): {
  commands: PluginCommand[];
  ribbons: PluginRibbonItem[];
  blockProcessors: Record<string, PluginBlockProcessor>;
  sidebarTabs: PluginSidebarTab[];
  statusBarItems: PluginStatusBarItem[];
} {
  const commands: PluginCommand[] = [];
  const ribbons: PluginRibbonItem[] = [];
  const blockProcessors: Record<string, PluginBlockProcessor> = {};
  const sidebarTabs: PluginSidebarTab[] = [];
  const statusBarItems: PluginStatusBarItem[] = [];

  if (deps.enabledIds.has('dataview-cosmos')) {
    const dvProc: PluginBlockProcessor = {
      kind: 'react',
      pluginId: 'dataview-cosmos',
      language: 'dataview',
      render: (source, ctx) => <DataviewBlock source={source} ctx={ctx} />,
    };
    blockProcessors['dataview'] = dvProc;
    blockProcessors['orbita-query'] = { ...dvProc, language: 'orbita-query' };

    commands.push(
      {
        id: 'dataview-insert',
        pluginId: 'dataview-cosmos',
        pluginName: 'Dataview Cósmico',
        name: 'Dataview: Inserir consulta dinâmica na nota',
        hint: 'Plugin',
        callback: () => {
          deps.appendToActiveNote(
            '\n\n```dataview\nTABLE maturity, tags\nSORT updated DESC\nLIMIT 8\n```'
          );
          deps.notify('Bloco Dataview inserido na nota ativa.', 'success', 'Dataview Cósmico');
        },
      },
      {
        id: 'dataview-chart-insert',
        pluginId: 'dataview-cosmos',
        pluginName: 'Dataview Cósmico',
        name: 'Dataview: Inserir gráfico de barras por estágio',
        hint: 'Plugin',
        callback: () => {
          deps.appendToActiveNote('\n\n```dataview\nCHART BY maturity\n```');
          deps.notify('Gráfico Dataview inserido na nota ativa.', 'success', 'Dataview Cósmico');
        },
      }
    );
  }

  if (deps.enabledIds.has('kanban-orbital')) {
    blockProcessors['kanban'] = {
      kind: 'react',
      pluginId: 'kanban-orbital',
      language: 'kanban',
      render: (source, ctx) => <KanbanBlock source={source} ctx={ctx} />,
    };

    commands.push({
      id: 'kanban-insert',
      pluginId: 'kanban-orbital',
      pluginName: 'Quadro Kanban',
      name: 'Kanban: Inserir quadro de tarefas na nota',
      hint: 'Plugin',
      callback: () => {
        deps.appendToActiveNote(
          '\n\n```kanban\n## A Fazer\n- [ ] Mapear novas conexões\n\n## Em Órbita\n- [ ] Revisar notas atômicas\n\n## Concluído\n- [x] Configurar sistema estelar\n```'
        );
        deps.notify('Quadro Kanban inserido na nota ativa.', 'success', 'Quadro Kanban');
      },
    });
  }

  if (deps.enabledIds.has('templates-core')) {
    const insertZettel = () => {
      deps.appendToActiveNote(
        `\n\n## Ideia Central\n\n## Conexões Gravitacionais\n- Relacionado a [[Mapa Cósmico]]\n\n## Referências\n- `
      );
      deps.notify('Template Zettelkasten inserido!', 'success', 'Templates');
    };

    ribbons.push({
      id: 'templates-ribbon',
      pluginId: 'templates-core',
      icon: 'file-text',
      title: 'Inserir Template Zettelkasten',
      onClick: insertZettel,
    });

    commands.push(
      {
        id: 'tpl-zettel',
        pluginId: 'templates-core',
        pluginName: 'Templates',
        name: 'Template: Inserir Estrutura Zettelkasten',
        hint: 'Plugin',
        callback: insertZettel,
      },
      {
        id: 'tpl-research',
        pluginId: 'templates-core',
        pluginName: 'Templates',
        name: 'Template: Inserir Ficha de Pesquisa Científica',
        hint: 'Plugin',
        callback: () => {
          deps.appendToActiveNote(
            `\n\n> [!info] Hipótese Principal\n> Descreva a tese em 1 frase.\n\n## Evidências & Experimentos\n- [ ] Coletar dados iniciais\n\n## Perguntas Abertas\n- `
          );
          deps.notify('Ficha de pesquisa inserida!', 'success', 'Templates');
        },
      }
    );
  }

  if (deps.enabledIds.has('pomodoro-orbital')) {
    ribbons.push({
      id: 'pomodoro-ribbon',
      pluginId: 'pomodoro-orbital',
      icon: 'clock',
      title: 'Iniciar / Pausar Cronômetro Pomodoro',
      onClick: deps.pomodoroControls.toggle,
    });

    const mins = String(Math.floor(deps.pomodoroState.secondsLeft / 60)).padStart(2, '0');
    const secs = String(deps.pomodoroState.secondsLeft % 60).padStart(2, '0');
    statusBarItems.push({
      id: 'pomodoro-status',
      pluginId: 'pomodoro-orbital',
      text: `${deps.pomodoroState.mode === 'focus' ? 'Foco' : 'Pausa'} ${mins}:${secs}`,
      title: 'Pomodoro Orbital — clique para iniciar/pausar',
      tone: deps.pomodoroState.running ? 'amber' : 'neutral',
      onClick: deps.pomodoroControls.toggle,
    });

    commands.push(
      {
        id: 'pomo-toggle',
        pluginId: 'pomodoro-orbital',
        pluginName: 'Foco Pomodoro',
        name: 'Pomodoro: Iniciar ou Pausar ciclo de foco',
        hint: 'Plugin',
        callback: deps.pomodoroControls.toggle,
      },
      {
        id: 'pomo-mode',
        pluginId: 'pomodoro-orbital',
        pluginName: 'Foco Pomodoro',
        name: 'Pomodoro: Alternar Foco (25m) / Pausa (5m)',
        hint: 'Plugin',
        callback: deps.pomodoroControls.switchMode,
      },
      {
        id: 'pomo-reset',
        pluginId: 'pomodoro-orbital',
        pluginName: 'Foco Pomodoro',
        name: 'Pomodoro: Reiniciar cronômetro',
        hint: 'Plugin',
        callback: deps.pomodoroControls.reset,
      }
    );
  }

  if (deps.enabledIds.has('vault-analytics')) {
    let tasksDone = 0;
    let tasksTotal = 0;
    for (const n of deps.notes) {
      const d = n.content.match(/^\s*[-*+]\s+\[[xX]\]/gm);
      const o = n.content.match(/^\s*[-*+]\s+\[ \]/gm);
      tasksDone += d ? d.length : 0;
      tasksTotal += (d ? d.length : 0) + (o ? o.length : 0);
    }
    if (tasksTotal > 0) {
      statusBarItems.push({
        id: 'analytics-tasks-status',
        pluginId: 'vault-analytics',
        text: `Tarefas: ${tasksDone}/${tasksTotal}`,
        title: 'Progresso total de checklists no Vault',
        tone: 'blue',
      });
    }

    sidebarTabs.push({
      id: 'analytics',
      pluginId: 'vault-analytics',
      title: 'Métricas',
      icon: 'bar-chart',
      render: (ctx) => <VaultAnalyticsTab ctx={ctx} graphIndex={deps.graphIndex} />,
    });
  }

  if (deps.enabledIds.has('flashcards-orbital')) {
    const cards = extractFlashcardsFromNotes(deps.notes);
    const now = Date.now();
    const dueCount = cards.filter((c) => {
      const p = deps.flashcardsControls.progressMap[c.id];
      return !p || p.nextReviewAt <= now;
    }).length;

    statusBarItems.push({
      id: 'flashcards-status',
      pluginId: 'flashcards-orbital',
      text: dueCount > 0 ? `Revisão: ${dueCount} pendentes` : `Flashcards: em dia`,
      title: 'Clique para abrir a sessão de revisão espaçada',
      tone: dueCount > 0 ? 'amber' : 'blue',
      onClick: deps.flashcardsControls.openReview,
    });

    ribbons.push({
      id: 'flashcards-ribbon',
      pluginId: 'flashcards-orbital',
      icon: 'layers',
      title: 'Revisão Espaçada (Flashcards)',
      onClick: deps.flashcardsControls.openReview,
    });

    commands.push(
      {
        id: 'flashcards-open',
        pluginId: 'flashcards-orbital',
        pluginName: 'Flashcards Orbitais',
        name: 'Flashcards: Iniciar sessão de revisão espaçada',
        hint: 'Plugin',
        callback: deps.flashcardsControls.openReview,
      },
      {
        id: 'flashcards-insert',
        pluginId: 'flashcards-orbital',
        pluginName: 'Flashcards Orbitais',
        name: 'Flashcards: Inserir cartão Pergunta :: Resposta',
        hint: 'Plugin',
        callback: deps.flashcardsControls.insertSample,
      }
    );

    sidebarTabs.push({
      id: 'flashcards',
      pluginId: 'flashcards-orbital',
      title: 'Revisão',
      icon: 'layers',
      render: (ctx) => (
        <FlashcardsDeckTab
          ctx={ctx}
          progressMap={deps.flashcardsControls.progressMap}
          onOpenReview={deps.flashcardsControls.openReview}
          onInsertSample={deps.flashcardsControls.insertSample}
        />
      ),
    });
  }

  return { commands, ribbons, blockProcessors, sidebarTabs, statusBarItems };
}
