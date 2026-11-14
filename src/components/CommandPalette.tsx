import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarDays,
  Columns2,
  FilePlus,
  Globe,
  LayoutGrid,
  Orbit,
  PenLine,
  Puzzle,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';
import { PluginCommand } from '../types/plugins';
import { CosmosBookmark, Note, WorkspaceViewMode } from '../types/vault';

interface CommandPaletteProps {
  isOpen: boolean;
  notes: Note[];
  bookmarks?: CosmosBookmark[];
  pluginCommands?: PluginCommand[];
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onCreateNoteWithTitle: (title: string) => void;
  onOpenDailyNote: () => void;
  onSetWorkspaceMode: (mode: WorkspaceViewMode) => void;
  onOpenPlugins?: () => void;
  onJumpBookmark?: (bookmark: CosmosBookmark) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  notes,
  bookmarks = [],
  pluginCommands = [],
  onClose,
  onSelectNote,
  onCreateNoteWithTitle,
  onOpenDailyNote,
  onSetWorkspaceMode,
  onOpenPlugins,
  onJumpBookmark,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: {
      id: string;
      label: string;
      hint: string;
      kind: 'note' | 'create' | 'action';
      icon: React.ReactNode;
      action: () => void;
    }[] = [];

    const matchedNotes = notes
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      .slice(0, 8);

    matchedNotes.forEach((n) => {
      const Icon =
        n.maturity === 'nebula' ? (
          <Sparkles className="w-4 h-4 text-[#38BDF8]" />
        ) : n.maturity === 'star' ? (
          <Sun className="w-4 h-4 text-[#E5A93B]" />
        ) : (
          <Globe className="w-4 h-4 text-[#5CA9E6]" />
        );
      list.push({
        id: `note-${n.id}`,
        label: n.title || 'Sem título',
        hint: 'Abrir planeta',
        kind: 'note',
        icon: Icon,
        action: () => {
          onSelectNote(n.id);
          onClose();
        },
      });
    });

    if (query.trim() && !notes.some((n) => n.title.toLowerCase() === q)) {
      list.push({
        id: 'create-new',
        label: `Criar novo planeta: "${query.trim()}"`,
        hint: 'Nova nota',
        kind: 'create',
        icon: <FilePlus className="w-4 h-4 text-[#E5A93B]" />,
        action: () => {
          onCreateNoteWithTitle(query.trim());
          onClose();
        },
      });
    }

    const actions = [
      {
        id: 'act-cosmos',
        label: 'Ir para Mapa Cósmico (Zoom Infinito)',
        hint: 'Visualização',
        icon: <Orbit className="w-4 h-4 text-[#5CA9E6]" />,
        action: () => {
          onSetWorkspaceMode('cosmos');
          onClose();
        },
      },
      {
        id: 'act-split',
        label: 'Modo Dividido: Editor + Cosmos',
        hint: 'Visualização',
        icon: <Columns2 className="w-4 h-4 text-[#5CA9E6]" />,
        action: () => {
          onSetWorkspaceMode('split');
          onClose();
        },
      },
      {
        id: 'act-editor',
        label: 'Modo Foco no Editor',
        hint: 'Visualização',
        icon: <PenLine className="w-4 h-4 text-[#5CA9E6]" />,
        action: () => {
          onSetWorkspaceMode('editor');
          onClose();
        },
      },
      {
        id: 'act-canvas',
        label: 'Ir para Canvas Espacial (Quadro Infinito 2D)',
        hint: 'Visualização',
        icon: <LayoutGrid className="w-4 h-4 text-[#E5A93B]" />,
        action: () => {
          onSetWorkspaceMode('canvas');
          onClose();
        },
      },
      {
        id: 'act-daily',
        label: 'Abrir Diário de Bordo de Hoje',
        hint: 'Diário',
        icon: <CalendarDays className="w-4 h-4 text-[#E5A93B]" />,
        action: () => {
          onOpenDailyNote();
          onClose();
        },
      },
      ...(onOpenPlugins
        ? [
            {
              id: 'act-plugins',
              label: 'Extensões & Estúdio de Plugins (SDK)',
              hint: 'Sistema',
              icon: <Puzzle className="w-4 h-4 text-[#E5A93B]" />,
              action: () => {
                onClose();
                onOpenPlugins();
              },
            },
          ]
        : []),
    ].filter((a) => !q || a.label.toLowerCase().includes(q));

    actions.forEach((a) =>
      list.push({
        ...a,
        kind: 'action',
      })
    );

    if (onJumpBookmark) {
      bookmarks
        .filter((bm) => !q || bm.name.toLowerCase().includes(q))
        .forEach((bm) => {
          list.push({
            id: `bm-${bm.id}`,
            label: `Favorito: ${bm.name}`,
            hint: 'Constelação',
            kind: 'action',
            icon: <Bookmark className="w-4 h-4 text-[#E5A93B]" />,
            action: () => {
              onClose();
              onJumpBookmark(bm);
            },
          });
        });
    }

    const matchedPluginCmds = pluginCommands.filter(
      (pc) =>
        !q ||
        pc.name.toLowerCase().includes(q) ||
        pc.pluginName.toLowerCase().includes(q)
    );

    matchedPluginCmds.forEach((pc) => {
      list.push({
        id: `pcmd-${pc.id}`,
        label: pc.name,
        hint: pc.hint || pc.pluginName,
        kind: 'action',
        icon: <Puzzle className="w-4 h-4 text-[#E5A93B]" />,
        action: () => {
          onClose();
          pc.callback();
        },
      });
    });

    return list;
  }, [
    query,
    notes,
    bookmarks,
    pluginCommands,
    onSelectNote,
    onClose,
    onCreateNoteWithTitle,
    onOpenDailyNote,
    onSetWorkspaceMode,
    onOpenPlugins,
    onJumpBookmark,
  ]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-[#020307]/75 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-[#223050] bg-[#0B0F1A] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1B253B]">
          <Search className="w-4 h-4 text-[#E5A93B] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => (items.length ? (i + 1) % items.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
              } else if (e.key === 'Enter' && items[selectedIndex]) {
                e.preventDefault();
                items[selectedIndex].action();
              }
            }}
            placeholder="Buscar planeta, criar novo ou executar comando..."
            className="w-full bg-transparent text-sm text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[#05070D] border border-[#1B253B] font-mono text-[10px] text-[#7B88A6]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#7B88A6]">
              Nenhum resultado encontrado.
            </div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                  idx === selectedIndex ? 'bg-[#131C31] text-[#ECEFF6]' : 'text-[#D7DFEE]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate font-medium">{item.label}</span>
                </span>
                <span className="text-[11px] text-[#7B88A6] shrink-0">{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
