import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  ListTree,
  Plus,
  Unlink,
} from 'lucide-react';
import { Folder, MaturityStage, Note } from '../types/vault';
import { PluginSidebarTab, PluginUIContext } from '../types/plugins';
import { extractHeadings, getAllNoteTags, GraphIndex } from '../utils/markdownGraph';

interface SidebarRightProps {
  width?: number;
  isAutoResizing?: boolean;
  activeNote: Note | null;
  folders: Folder[];
  notes: Note[];
  graphIndex: GraphIndex;
  onSelectNote: (noteId: string) => void;
  onUpdateNote: (noteId: string, patch: Partial<Note>) => void;
  onOpenWikilink: (targetTitle: string) => void;
  onLinkUnlinkedMention: (sourceNoteId: string, targetTitle: string) => void;
  pluginTabs?: PluginSidebarTab[];
  pluginUIContext?: PluginUIContext;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({
  width = 280,
  isAutoResizing = true,
  activeNote,
  folders,
  notes,
  graphIndex,
  onSelectNote,
  onUpdateNote,
  onOpenWikilink,
  onLinkUnlinkedMention,
  pluginTabs = [],
  pluginUIContext,
}) => {
  const [tab, setTab] = useState<string>('links');
  const [newTag, setNewTag] = useState('');

  const activePluginTab = pluginTabs.find((pt) => pt.id === tab);
  const resolvedTab =
    tab === 'links' || tab === 'props' || tab === 'outline' || activePluginTab ? tab : 'links';

  const backlinks = activeNote ? graphIndex.backlinksByNote[activeNote.id] || [] : [];
  const unlinked = activeNote ? graphIndex.unlinkedMentionsByNote[activeNote.id] || [] : [];
  const outgoing = activeNote ? graphIndex.outgoingByNote[activeNote.id] || [] : [];
  const unresolved = activeNote ? graphIndex.unresolvedByNote[activeNote.id] || [] : [];
  const headings = useMemo(
    () => (activeNote ? extractHeadings(activeNote.content) : []),
    [activeNote]
  );
  const noteTags = useMemo(
    () => (activeNote ? getAllNoteTags(activeNote) : []),
    [activeNote]
  );

  if (!activeNote) {
    return (
      <aside
        style={{ width }}
        className="shrink-0 h-full flex flex-col items-center justify-center bg-[#080B14] p-6 text-center text-xs text-[#7B88A6] overflow-hidden"
      >
        Selecione um planeta para inspecionar conexões, backlinks e propriedades.
      </aside>
    );
  }

  const handleAddManualTag = () => {
    const cleaned = newTag.replace(/^#/, '').trim().toLowerCase();
    if (cleaned && !activeNote.tags.includes(cleaned)) {
      onUpdateNote(activeNote.id, { tags: [...activeNote.tags, cleaned] });
    }
    setNewTag('');
  };

  return (
    <aside
      style={{ width }}
      className={`shrink-0 h-full flex flex-col bg-[#080B14] select-none overflow-hidden ${
        isAutoResizing ? 'transition-[width] duration-200 ease-out' : ''
      }`}
    >
      <div className="p-2 border-b border-[#1B253B]">
        <div className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-lg bg-[#05070D] border border-[#1B253B]">
          <button
            type="button"
            onClick={() => setTab('links')}
            title="Ligações e Backlinks"
            className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all truncate cursor-pointer ${
              resolvedTab === 'links'
                ? 'bg-[#131C31] text-[#ECEFF6]'
                : 'text-[#7B88A6] hover:text-[#D7DFEE]'
            }`}
          >
            Ligações
          </button>
          <button
            type="button"
            onClick={() => setTab('props')}
            title="Detalhes do corpo celeste"
            className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all truncate cursor-pointer ${
              resolvedTab === 'props'
                ? 'bg-[#131C31] text-[#ECEFF6]'
                : 'text-[#7B88A6] hover:text-[#D7DFEE]'
            }`}
          >
            Detalhes
          </button>
          <button
            type="button"
            onClick={() => setTab('outline')}
            title="Índice de títulos"
            className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all truncate cursor-pointer ${
              resolvedTab === 'outline'
                ? 'bg-[#131C31] text-[#ECEFF6]'
                : 'text-[#7B88A6] hover:text-[#D7DFEE]'
            }`}
          >
            Índice
          </button>
          {pluginTabs.map((pt) => (
            <button
              key={pt.id}
              type="button"
              onClick={() => setTab(pt.id)}
              title={pt.title}
              className={`py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all truncate cursor-pointer ${
                resolvedTab === pt.id
                  ? 'bg-[#131C31] text-[#E5A93B]'
                  : 'text-[#7B88A6] hover:text-[#D7DFEE]'
              }`}
            >
              {pt.title}
            </button>
          ))}
        </div>
      </div>

      {resolvedTab === 'links' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-5 text-xs">
          <section className="space-y-2">
            <div className="flex items-center justify-between text-[#ECEFF6] font-semibold">
              <span className="flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 text-[#E5A93B]" />
                <span>Backlinks</span>
              </span>
              <span className="font-mono text-[11px] text-[#7B88A6] tabular-nums">
                {backlinks.length}
              </span>
            </div>

            {backlinks.length === 0 ? (
              <p className="text-[#7B88A6] leading-relaxed">
                Nenhum corpo celeste aponta para esta nota ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {backlinks.map(({ sourceNote, snippets }) => (
                  <button
                    key={sourceNote.id}
                    type="button"
                    onClick={() => onSelectNote(sourceNote.id)}
                    className="w-full text-left p-2.5 rounded-lg bg-[#0B0F1A] border border-[#182238] hover:border-[#E5A93B]/50 transition-colors cursor-pointer"
                  >
                    <div className="font-medium text-[#E5A93B] truncate mb-1">
                      {sourceNote.title || 'Sem título'}
                    </div>
                    <div className="text-[11px] text-[#9AA7C4] line-clamp-2 leading-relaxed">
                      {snippets[0]}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2 pt-3 border-t border-[#161F34]">
            <div className="flex items-center justify-between text-[#ECEFF6] font-semibold">
              <span className="flex items-center gap-1.5">
                <Unlink className="w-3.5 h-3.5 text-[#9AA7C4]" />
                <span>Menções não ligadas</span>
              </span>
              <span className="font-mono text-[11px] text-[#7B88A6] tabular-nums">
                {unlinked.length}
              </span>
            </div>

            {unlinked.length === 0 ? (
              <p className="text-[#7B88A6]">Sem menções soltas encontradas.</p>
            ) : (
              <div className="space-y-2">
                {unlinked.map(({ sourceNote, snippet }) => (
                  <div
                    key={sourceNote.id}
                    className="p-2.5 rounded-lg bg-[#0B0F1A] border border-[#182238] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectNote(sourceNote.id)}
                        className="font-medium text-[#D7DFEE] hover:text-[#ECEFF6] truncate cursor-pointer"
                      >
                        {sourceNote.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => onLinkUnlinkedMention(sourceNote.id, activeNote.title)}
                        className="px-2 py-0.5 rounded bg-[#101626] border border-[#243456] text-[11px] text-[#5CA9E6] hover:text-[#E5A93B] hover:border-[#E5A93B]/50 shrink-0 cursor-pointer"
                      >
                        Vincular
                      </button>
                    </div>
                    <p className="text-[11px] text-[#7B88A6] line-clamp-2">{snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2 pt-3 border-t border-[#161F34]">
            <div className="flex items-center justify-between text-[#ECEFF6] font-semibold">
              <span className="flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-[#5CA9E6]" />
                <span>Links de saída</span>
              </span>
              <span className="font-mono text-[11px] text-[#7B88A6] tabular-nums">
                {outgoing.length + unresolved.length}
              </span>
            </div>

            {outgoing.length === 0 && unresolved.length === 0 ? (
              <p className="text-[#7B88A6]">
                Use <code className="font-mono text-[#E5A93B]">[[nome]]</code> para criar pontes gravitacionais.
              </p>
            ) : (
              <div className="space-y-1">
                {outgoing.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => onSelectNote(target.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[#5CA9E6] hover:bg-[#0F1628] hover:text-[#E5A93B] transition-colors truncate cursor-pointer"
                  >
                    <Link2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{target.title}</span>
                  </button>
                ))}
                {unresolved.map((targetTitle) => (
                  <button
                    key={targetTitle}
                    type="button"
                    onClick={() => onOpenWikilink(targetTitle)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[#9AA7C4] hover:bg-[#0F1628] hover:text-[#E5A93B] transition-colors cursor-pointer"
                  >
                    <span className="truncate italic">{targetTitle}</span>
                    <span className="text-[10px] text-[#E5A93B] shrink-0">Criar</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {resolvedTab === 'props' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[#9AA7C4] font-medium">Estrela / Sistema</label>
            <select
              value={activeNote.folderId || ''}
              onChange={(e) =>
                onUpdateNote(activeNote.id, { folderId: e.target.value || null })
              }
              className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] focus:outline-none focus:border-[#E5A93B]"
            >
              <option value="">Asteroide (sem estrela)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.parentId ? `↳ ${f.name}` : f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#9AA7C4] font-medium">Planeta-mãe (tornar lua)</label>
            <select
              value={activeNote.parentNoteId || ''}
              onChange={(e) =>
                onUpdateNote(activeNote.id, { parentNoteId: e.target.value || null })
              }
              className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] focus:outline-none focus:border-[#E5A93B]"
            >
              <option value="">Planeta independente</option>
              {notes
                .filter((n) => n.id !== activeNote.id && n.parentNoteId !== activeNote.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || 'Sem título'}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[#9AA7C4] font-medium">Ciclo Estelar</label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#05070D] border border-[#1B253B]">
              {(['nebula', 'planet', 'star'] as MaturityStage[]).map((stage) => {
                const label = stage === 'nebula' ? 'Nebulosa' : stage === 'planet' ? 'Planeta' : 'Estrela';
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => onUpdateNote(activeNote.id, { maturity: stage })}
                    className={`py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      activeNote.maturity === stage
                        ? 'bg-[#131C31] text-[#E5A93B]'
                        : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#161F34]">
            <label className="text-[#9AA7C4] font-medium">Tags</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddManualTag();
                }}
                placeholder="Nova tag..."
                className="flex-1 px-2.5 py-1 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none focus:border-[#E5A93B]"
              />
              <button
                type="button"
                onClick={handleAddManualTag}
                className="px-2 py-1 rounded-md bg-[#0E1526] border border-[#1E2A45] text-[#ECEFF6] hover:border-[#E5A93B] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#E5A93B] font-mono">
              {noteTags.length === 0 ? (
                <span className="font-sans text-[#7B88A6]">Sem tags</span>
              ) : (
                noteTags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    <span>#{t}</span>
                    {activeNote.tags.includes(t) && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateNote(activeNote.id, {
                            tags: activeNote.tags.filter((x) => x !== t),
                          })
                        }
                        className="text-[#7B88A6] hover:text-[#EF4444] cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#161F34] space-y-1 text-[11px] text-[#7B88A6] tabular-nums">
            <div className="flex justify-between">
              <span>Criada em</span>
              <span>{new Date(activeNote.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span>Atualizada em</span>
              <span>{new Date(activeNote.updatedAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      )}

      {resolvedTab === 'outline' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#ECEFF6] font-semibold mb-2">
            <ListTree className="w-3.5 h-3.5 text-[#5CA9E6]" />
            <span>Estrutura de Títulos</span>
          </div>
          {headings.length === 0 ? (
            <p className="text-[#7B88A6]">
              Adicione títulos com <code className="font-mono text-[#E5A93B]">#</code> ou{' '}
              <code className="font-mono text-[#E5A93B]">##</code> na nota.
            </p>
          ) : (
            <div className="space-y-1">
              {headings.map((h, idx) => (
                <div
                  key={idx}
                  style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                  className="py-1 text-[#D7DFEE] hover:text-[#E5A93B] truncate transition-colors"
                >
                  {h.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activePluginTab && resolvedTab === activePluginTab.id && pluginUIContext && (
        <>{activePluginTab.render(pluginUIContext)}</>
      )}
    </aside>
  );
};
