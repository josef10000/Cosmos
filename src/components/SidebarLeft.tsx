import React, { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus,
  FolderPlus,
  Globe,
  Hash,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { Folder, Note } from '../types/vault';
import { GraphIndex } from '../utils/markdownGraph';

interface SidebarLeftProps {
  width?: number;
  folders: Folder[];
  notes: Note[];
  activeNoteId: string | null;
  graphIndex: GraphIndex;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId: string | null, parentNoteId?: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleFolderExpand: (folderId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onOpenDailyNote: () => void;
  onSelectTagInCosmos: (tag: string) => void;
  onImportMarkdownFiles: (files: FileList) => void;
  onExportVault: () => void;
  onExportActiveMarkdown: () => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  width = 272,
  folders,
  notes,
  activeNoteId,
  graphIndex,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolderExpand,
  onDeleteNote,
  onOpenDailyNote,
  onSelectTagInCosmos,
  onImportMarkdownFiles,
  onExportVault,
  onExportActiveMarkdown,
}) => {
  const [tab, setTab] = useState<'systems' | 'search' | 'tags'>('systems');
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingStar, setCreatingStar] = useState(false);
  const [newStarName, setNewStarName] = useState('');
  const [creatingSubfolderFor, setCreatingSubfolderFor] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const rootFolders = useMemo(
    () => folders.filter((f) => f.parentId === null),
    [folders]
  );

  const looseNotes = useMemo(
    () => notes.filter((n) => !n.folderId && !n.parentNoteId),
    [notes]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return notes
      .map((n) => {
        const titleMatch = n.title.toLowerCase().includes(q);
        const lines = n.content.split('\n');
        const matchedLine = lines.find((l) => l.toLowerCase().includes(q));
        if (!titleMatch && !matchedLine) return null;
        return { note: n, snippet: matchedLine?.trim() || n.content.slice(0, 80) };
      })
      .filter((x): x is { note: Note; snippet: string } => x !== null);
  }, [notes, searchQuery]);

  const notesForSelectedTag = useMemo(() => {
    if (!selectedTag) return [];
    const entry = graphIndex.allTags.find((t) => t.tag === selectedTag);
    if (!entry) return [];
    const idSet = new Set(entry.noteIds);
    return notes.filter((n) => idSet.has(n.id));
  }, [selectedTag, graphIndex.allTags, notes]);

  const handleConfirmStar = () => {
    const trimmed = newStarName.trim();
    if (trimmed) {
      onCreateFolder(trimmed, null);
    }
    setNewStarName('');
    setCreatingStar(false);
  };

  const handleConfirmSubfolder = (parentId: string) => {
    const trimmed = newSubfolderName.trim();
    if (trimmed) {
      onCreateFolder(trimmed, parentId);
    }
    setNewSubfolderName('');
    setCreatingSubfolderFor(null);
  };

  const renderNoteItem = (note: Note, depth: number) => {
    const childSubnotes = notes.filter((n) => n.parentNoteId === note.id);
    const isActive = note.id === activeNoteId;
    const MaturityIcon =
      note.maturity === 'nebula' ? Sparkles : note.maturity === 'star' ? Sun : Globe;
    const iconColor =
      note.maturity === 'nebula'
        ? 'text-[#38BDF8]'
        : note.maturity === 'star'
          ? 'text-[#E5A93B]'
          : 'text-[#5CA9E6]';

    return (
      <div key={note.id}>
        <div
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          onClick={() => onSelectNote(note.id)}
          className={`group flex items-center justify-between gap-1.5 pr-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors ${
            isActive
              ? 'bg-[#131C31] text-[#FBE6B2] font-medium'
              : 'text-[#C2CCE0] hover:bg-[#0F1628] hover:text-[#ECEFF6]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <MaturityIcon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
            <span className="truncate">{note.title || 'Sem título'}</span>
          </div>
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(note.folderId, note.id);
              }}
              title="Adicionar lua (subnota)"
              className="p-1 rounded hover:bg-[#1C2742] text-[#9AA7C4] hover:text-[#5CA9E6] cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNote(note.id);
              }}
              title="Excluir nota"
              className="p-1 rounded hover:bg-[#1C2742] text-[#9AA7C4] hover:text-[#EF4444] cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {childSubnotes.length > 0 && (
          <div className="space-y-0.5">
            {childSubnotes.map((sub) => renderNoteItem(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFolderBranch = (folder: Folder, depth: number) => {
    const childFolders = folders.filter((f) => f.parentId === folder.id);
    const folderNotes = notes.filter((n) => n.folderId === folder.id && !n.parentNoteId);
    const isExpanded = folder.isExpanded ?? true;
    const isStar = folder.parentId === null;

    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => onToggleFolderExpand(folder.id)}
          className="group flex items-center justify-between gap-1.5 pr-2 py-1.5 rounded-md text-[13px] text-[#DCE3F2] hover:bg-[#0F1628] cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#7B88A6] shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#7B88A6] shrink-0" />
            )}
            {isStar && <Sun className="w-3.5 h-3.5 text-[#E5A93B] shrink-0" />}
            {editingFolderId === folder.id ? (
              <input
                type="text"
                autoFocus
                value={editingFolderName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onBlur={() => {
                  if (editingFolderName.trim()) {
                    onRenameFolder(folder.id, editingFolderName.trim());
                  }
                  setEditingFolderId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingFolderName.trim()) {
                      onRenameFolder(folder.id, editingFolderName.trim());
                    }
                    setEditingFolderId(null);
                  } else if (e.key === 'Escape') {
                    setEditingFolderId(null);
                  }
                }}
                className="w-full px-1.5 py-0.5 rounded bg-[#05070D] border border-[#E5A93B] text-xs text-[#ECEFF6] focus:outline-none"
              />
            ) : (
              <span className={`truncate ${isStar ? 'font-semibold' : 'font-medium text-[#B8C4DE]'}`}>
                {folder.name}
              </span>
            )}
          </div>

          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(folder.id, null);
              }}
              title="Novo planeta aqui"
              className="p-1 rounded hover:bg-[#1C2742] text-[#9AA7C4] hover:text-[#E5A93B] cursor-pointer"
            >
              <FilePlus className="w-3 h-3" />
            </button>
            {isStar && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingSubfolderFor(folder.id);
                }}
                title="Novo sub-sistema (subpasta)"
                className="p-1 rounded hover:bg-[#1C2742] text-[#9AA7C4] hover:text-[#5CA9E6] cursor-pointer"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolderId(folder.id);
                setEditingFolderName(folder.name);
              }}
              title="Renomear"
              className="p-1 rounded hover:bg-[#1C2742] text-[#9AA7C4] hover:text-[#ECEFF6] cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder.id);
              }}
              title="Excluir sistema"
              className="p-1 rounded hover:bg-[#1C2742] text-[#9AA7C4] hover:text-[#EF4444] cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {creatingSubfolderFor === folder.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }} className="pr-2 py-1">
            <input
              type="text"
              autoFocus
              value={newSubfolderName}
              onChange={(e) => setNewSubfolderName(e.target.value)}
              onBlur={() => handleConfirmSubfolder(folder.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSubfolder(folder.id);
                if (e.key === 'Escape') {
                  setNewSubfolderName('');
                  setCreatingSubfolderFor(null);
                }
              }}
              placeholder="Nome do sub-sistema..."
              className="w-full px-2 py-1 rounded bg-[#05070D] border border-[#5CA9E6] text-xs text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none"
            />
          </div>
        )}

        {isExpanded && (
          <div className="space-y-0.5">
            {childFolders.map((cf) => renderFolderBranch(cf, depth + 1))}
            {folderNotes.map((n) => renderNoteItem(n, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{ width }}
      className="shrink-0 h-full flex flex-col bg-[#080B14] select-none overflow-hidden"
    >
      <div className="p-2.5 border-b border-[#1B253B]">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#05070D] border border-[#1B253B]">
          <button
            type="button"
            onClick={() => setTab('systems')}
            className={`py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'systems'
                ? 'bg-[#131C31] text-[#ECEFF6]'
                : 'text-[#7B88A6] hover:text-[#D7DFEE]'
            }`}
          >
            Sistemas
          </button>
          <button
            type="button"
            onClick={() => setTab('search')}
            className={`py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'search'
                ? 'bg-[#131C31] text-[#ECEFF6]'
                : 'text-[#7B88A6] hover:text-[#D7DFEE]'
            }`}
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={() => setTab('tags')}
            className={`py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'tags'
                ? 'bg-[#131C31] text-[#ECEFF6]'
                : 'text-[#7B88A6] hover:text-[#D7DFEE]'
            }`}
          >
            Tags
          </button>
        </div>
      </div>

      {tab === 'systems' && (
        <>
          <div className="flex items-center justify-between gap-1 px-3 py-2 border-b border-[#161F34]">
            <button
              type="button"
              onClick={() => onCreateNote(rootFolders[0]?.id || null, null)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-[#0E1526] border border-[#1E2A45] text-xs font-medium text-[#ECEFF6] hover:border-[#E5A93B]/60 hover:text-[#FBE6B2] transition-colors whitespace-nowrap cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5 text-[#5CA9E6]" />
              <span>Novo Planeta</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatingStar(true)}
              title="Nova Estrela (Pasta Principal)"
              className="p-1.5 rounded-md bg-[#0E1526] border border-[#1E2A45] text-[#9AA7C4] hover:text-[#E5A93B] hover:border-[#E5A93B]/60 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenDailyNote}
              title="Abrir Diário de Bordo de Hoje"
              className="p-1.5 rounded-md bg-[#0E1526] border border-[#1E2A45] text-[#9AA7C4] hover:text-[#E5A93B] hover:border-[#E5A93B]/60 transition-colors cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-1">
            {creatingStar && (
              <div className="px-2 pb-2">
                <input
                  type="text"
                  autoFocus
                  value={newStarName}
                  onChange={(e) => setNewStarName(e.target.value)}
                  onBlur={handleConfirmStar}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmStar();
                    if (e.key === 'Escape') {
                      setNewStarName('');
                      setCreatingStar(false);
                    }
                  }}
                  placeholder="Nome da nova estrela..."
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#E5A93B] text-xs text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none"
                />
              </div>
            )}

            {rootFolders.map((star) => renderFolderBranch(star, 0))}

            {looseNotes.length > 0 && (
              <div className="pt-3 mt-3 border-t border-[#161F34]">
                <div className="px-2.5 pb-1 text-[11px] font-medium text-[#7B88A6]">
                  Asteroides (sem estrela)
                </div>
                {looseNotes.map((n) => renderNoteItem(n, 0))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'search' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b border-[#161F34]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7B88A6] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no conteúdo e títulos..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-xs text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none focus:border-[#E5A93B]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {!searchQuery.trim() ? (
              <p className="px-2 py-4 text-xs text-[#7B88A6] text-center">
                Digite um termo para pesquisar em todos os {notes.length} corpos.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="px-2 py-4 text-xs text-[#7B88A6] text-center">
                Nenhum corpo encontrado.
              </p>
            ) : (
              searchResults.map(({ note, snippet }) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                  className="w-full text-left p-2.5 rounded-lg bg-[#0B0F1A] border border-[#182238] hover:border-[#E5A93B]/50 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#ECEFF6] truncate mb-0.5">
                    {note.title || 'Sem título'}
                  </div>
                  <div className="text-[11px] text-[#9AA7C4] line-clamp-2">{snippet}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'tags' && (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {graphIndex.allTags.length === 0 ? (
            <p className="px-2 py-4 text-xs text-[#7B88A6] text-center">
              Use #tags nas notas para agrupá-las aqui.
            </p>
          ) : (
            graphIndex.allTags.map(({ tag, count }) => {
              const isOpen = selectedTag === tag;
              return (
                <div key={tag} className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTag(isOpen ? null : tag)}
                      className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                        isOpen
                          ? 'bg-[#131C31] text-[#E5A93B]'
                          : 'text-[#D7DFEE] hover:bg-[#0F1628]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-mono">
                        <Hash className="w-3 h-3 text-[#5CA9E6]" />
                        <span>{tag}</span>
                      </span>
                      <span className="text-[11px] font-mono text-[#7B88A6] tabular-nums">
                        {count}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTagInCosmos(tag)}
                      title="Destacar esta tag no Cosmos"
                      className="px-2 py-1.5 rounded-md text-[11px] text-[#9AA7C4] hover:text-[#E5A93B] hover:bg-[#0F1628] cursor-pointer"
                    >
                      Mapa
                    </button>
                  </div>
                  {isOpen && (
                    <div className="pl-3 space-y-0.5">
                      {notesForSelectedTag.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => onSelectNote(n.id)}
                          className="w-full text-left px-2.5 py-1 rounded text-xs text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#0F1628] truncate cursor-pointer"
                        >
                          {n.title || 'Sem título'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="px-3 py-2.5 border-t border-[#1B253B] bg-[#060911] flex items-center justify-between gap-1 text-[11px] text-[#9AA7C4]">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportMarkdownFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Importar arquivos .md"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#121A2E] hover:text-[#ECEFF6] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Upload className="w-3 h-3" />
          <span>Importar .md</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExportActiveMarkdown}
            title="Exportar nota atual como .md"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#121A2E] hover:text-[#E5A93B] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>.md</span>
          </button>
          <button
            type="button"
            onClick={onExportVault}
            title="Backup completo do Vault (.json)"
            className="px-2 py-1 rounded hover:bg-[#121A2E] hover:text-[#5CA9E6] transition-colors whitespace-nowrap cursor-pointer"
          >
            Vault
          </button>
        </div>
      </div>
    </aside>
  );
};
