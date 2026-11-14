import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Columns2,
  FilePlus,
  Globe,
  LayoutGrid,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Puzzle,
  Search,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { CommandPalette } from './components/CommandPalette';
import { CosmosCanvas } from './components/CosmosCanvas';
import { FlashcardReviewModal } from './components/FlashcardReviewModal';
import { MarkdownEditor } from './components/MarkdownEditor';
import { PluginModal } from './components/PluginModal';
import { PluginRibbon } from './components/PluginRibbon';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { SpatialCanvas } from './components/SpatialCanvas';
import { StatusBar } from './components/StatusBar';
import { SEED_VAULT } from './data/seedVault';
import { buildBuiltInContributions } from './plugins/builtInImplementations';
import { extractFlashcardsFromNotes, FlashcardProgress } from './plugins/flashcardsEngine';
import { BUILTIN_PLUGINS_DEFAULT } from './plugins/pluginTemplates';
import {
  CompiledCustomPluginResult,
  executeCustomPlugin,
  LiveVaultHostRef,
} from './plugins/pluginRuntime';
import {
  PluginBlockContext,
  PluginBlockProcessor,
  PluginCommand,
  PluginEventName,
  PluginNotice,
  PluginRibbonItem,
  PluginRuntimeInfo,
  PluginSidebarTab,
  PluginUIContext,
  StoredPlugin,
} from './types/plugins';
import {
  CanvasNode,
  CanvasState,
  CosmosBookmark,
  CosmosSettings,
  EditorMode,
  Folder,
  Note,
  StarClass,
  VaultData,
  WorkspaceViewMode,
} from './types/vault';
import { computeGraphIndex, countWordsAndChars, normalizeTitle } from './utils/markdownGraph';

const STORAGE_KEY = 'orbita_vault_v1';
const PLUGINS_STORAGE_KEY = 'orbita_plugins_v1';
const CANVAS_STORAGE_KEY = 'orbita_canvas_v1';
const BOOKMARKS_STORAGE_KEY = 'orbita_bookmarks_v1';
const FLASHCARDS_STORAGE_KEY = 'orbita_flashcards_v1';

const DEFAULT_CANVAS: CanvasState = {
  nodes: [
    {
      id: 'cnode-seed-1',
      type: 'text',
      x: 40,
      y: 60,
      width: 270,
      height: 175,
      title: 'Canvas Espacial Livre',
      text: 'Arraste cartões, dê duplo-clique no vazio para criar novas ideias ou clique na seta do cabeçalho para conectar cartões.',
      color: 'amber',
    },
    {
      id: 'cnode-seed-2',
      type: 'note',
      x: 380,
      y: 30,
      width: 320,
      height: 235,
      noteId: 'note-mapa-cosmico',
      color: 'blue',
    },
    {
      id: 'cnode-seed-3',
      type: 'note',
      x: 390,
      y: 310,
      width: 310,
      height: 205,
      noteId: 'note-campo-gravitacional',
      color: 'cyan',
    },
  ],
  edges: [
    { id: 'cedge-seed-1', fromNodeId: 'cnode-seed-1', toNodeId: 'cnode-seed-2', color: 'amber' },
    { id: 'cedge-seed-2', fromNodeId: 'cnode-seed-2', toNodeId: 'cnode-seed-3', color: 'blue' },
  ],
};

function loadInitialCanvas(): CanvasState {
  try {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CanvasState;
      if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return parsed;
      }
    }
  } catch {
    // Fallback
  }
  return DEFAULT_CANVAS;
}

function loadInitialBookmarks(): CosmosBookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CosmosBookmark[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fallback
  }
  return [];
}

function loadInitialFlashcards(): Record<string, FlashcardProgress> {
  try {
    const raw = localStorage.getItem(FLASHCARDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, FlashcardProgress>;
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Fallback
  }
  return {};
}

function loadInitialPlugins(): StoredPlugin[] {
  try {
    const raw = localStorage.getItem(PLUGINS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPlugin[];
      if (Array.isArray(parsed)) {
        const byId = new Map(parsed.map((p) => [p.manifest.id, p]));
        const merged: StoredPlugin[] = BUILTIN_PLUGINS_DEFAULT.map((def) => {
          const saved = byId.get(def.manifest.id);
          return saved
            ? { ...def, enabled: saved.enabled, settings: saved.settings || {} }
            : def;
        });
        for (const p of parsed) {
          if (!p.manifest?.isBuiltIn && !BUILTIN_PLUGINS_DEFAULT.some((d) => d.manifest.id === p.manifest?.id)) {
            merged.push(p);
          }
        }
        return merged;
      }
    }
  } catch {
    // Fallback to default plugins
  }
  return BUILTIN_PLUGINS_DEFAULT;
}

function loadInitialVault(): VaultData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as VaultData;
      if (parsed && Array.isArray(parsed.notes) && Array.isArray(parsed.folders)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to seed vault
  }
  return SEED_VAULT;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function App() {
  const [vault, setVault] = useState<VaultData>(loadInitialVault);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceViewMode>('split');
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(272);
  const [rightWidth, setRightWidth] = useState(252);
  const [rightWidthCustom, setRightWidthCustom] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.48);
  const [cosmosFullscreen, setCosmosFullscreen] = useState(false);
  const [activeResize, setActiveResize] = useState<'left' | 'right' | 'split' | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  const [commandOpen, setCommandOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [plugins, setPlugins] = useState<StoredPlugin[]>(loadInitialPlugins);
  const [canvasState, setCanvasState] = useState<CanvasState>(loadInitialCanvas);
  const [bookmarks, setBookmarks] = useState<CosmosBookmark[]>(loadInitialBookmarks);
  const [flashcardsProgress, setFlashcardsProgress] =
    useState<Record<string, FlashcardProgress>>(loadInitialFlashcards);
  const [cameraJumpRequest, setCameraJumpRequest] = useState<{
    x: number;
    y: number;
    zoom: number;
    nonce: number;
  } | null>(null);
  const [notices, setNotices] = useState<PluginNotice[]>([]);
  const [pomodoro, setPomodoro] = useState<{
    mode: 'focus' | 'break';
    secondsLeft: number;
    running: boolean;
  }>({ mode: 'focus', secondsLeft: 25 * 60, running: false });
  const [focusRequest, setFocusRequest] = useState<{ noteId: string; nonce: number } | null>(null);

  const [cosmosSettings, setCosmosSettings] = useState<CosmosSettings>({
    orbiting: true,
    orbitSpeed: 0.7,
    gravityPull: 0.45,
    showSpacetimeGrid: true,
    showOrbitRings: true,
    showConstellations: true,
    showLinks: true,
    showSubnotes: true,
    showOrphans: true,
    showLabels: true,
    spread: 1.0,
    filterTag: null,
    filterFolderId: null,
    searchQuery: '',
    colorBy: 'maturity',
    localGraphDepth: 1,
  });

  // Persist locally in browser
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
    } catch {
      // Ignore quota errors
    }
  }, [vault]);

  useEffect(() => {
    try {
      localStorage.setItem(PLUGINS_STORAGE_KEY, JSON.stringify(plugins));
    } catch {
      // Ignore quota errors
    }
  }, [plugins]);

  useEffect(() => {
    try {
      localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(canvasState));
    } catch {
      // Ignore quota errors
    }
  }, [canvasState]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {
      // Ignore quota errors
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(flashcardsProgress));
    } catch {
      // Ignore quota errors
    }
  }, [flashcardsProgress]);

  const notify = useCallback(
    (message: string, tone: 'info' | 'success' | 'error' = 'info', pluginName?: string) => {
      const id = makeId('notice');
      setNotices((prev) => [...prev.slice(-3), { id, message, tone, pluginName }]);
      setTimeout(() => {
        setNotices((prev) => prev.filter((n) => n.id !== id));
      }, 3600);
    },
    []
  );

  // Pomodoro tick effect when active
  useEffect(() => {
    if (!pomodoro.running) return;
    const timer = window.setInterval(() => {
      setPomodoro((prev) => {
        if (!prev.running) return prev;
        if (prev.secondsLeft <= 1) {
          const nextMode = prev.mode === 'focus' ? 'break' : 'focus';
          notify(
            nextMode === 'break'
              ? 'Ciclo de foco concluído! Hora de uma pausa orbital de 5 min.'
              : 'Pausa encerrada! De volta ao foco profundo.',
            'success',
            'Foco Pomodoro'
          );
          return {
            mode: nextMode,
            secondsLeft: nextMode === 'focus' ? 25 * 60 : 5 * 60,
            running: false,
          };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pomodoro.running, notify]);

  // Global keyboard shortcuts (Ctrl/Cmd + K or O, Esc to exit fullscreen)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'o')) {
        e.preventDefault();
        setCommandOpen((o) => !o);
      } else if (e.key === 'Escape' && cosmosFullscreen) {
        setCosmosFullscreen(false);
        try {
          if (document.fullscreenElement) {
            void document.exitFullscreen();
          }
        } catch {
          // Ignore iframe fullscreen restrictions
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cosmosFullscreen]);

  // Draggable panel resizers with snap-to-hide
  useEffect(() => {
    if (!activeResize) return;

    const onPointerMove = (e: PointerEvent) => {
      if (activeResize === 'left') {
        if (e.clientX < 105) {
          setLeftOpen(false);
          setActiveResize(null);
          return;
        }
        setLeftWidth(Math.min(480, Math.max(170, e.clientX)));
      } else if (activeResize === 'right') {
        const distFromRight = window.innerWidth - e.clientX;
        if (distFromRight < 105) {
          setRightOpen(false);
          setActiveResize(null);
          return;
        }
        setRightWidthCustom(true);
        setRightWidth(Math.min(480, Math.max(180, distFromRight)));
      } else if (activeResize === 'split' && mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
        if (ratio < 0.11) {
          setWorkspaceMode('cosmos');
          setSplitRatio(0.48);
          setActiveResize(null);
          return;
        }
        if (ratio > 0.89) {
          setWorkspaceMode('editor');
          setSplitRatio(0.48);
          setActiveResize(null);
          return;
        }
        setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
      }
    };

    const onPointerUp = () => setActiveResize(null);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    document.body.style.cursor = 'col-resize';
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
    };
  }, [activeResize]);

  const graphIndex = useMemo(() => computeGraphIndex(vault.notes), [vault.notes]);
  const allTagNames = useMemo(() => graphIndex.allTags.map((t) => t.tag), [graphIndex.allTags]);

  const activeNote = useMemo(
    () => vault.notes.find((n) => n.id === vault.activeNoteId) || null,
    [vault.notes, vault.activeNoteId]
  );

  const openNote = useCallback((noteId: string) => {
    setVault((prev) => {
      const openTabIds = prev.openTabIds.includes(noteId)
        ? prev.openTabIds
        : [...prev.openTabIds, noteId];
      return { ...prev, openTabIds, activeNoteId: noteId };
    });
  }, []);

  const closeTab = useCallback((noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setVault((prev) => {
      const nextTabs = prev.openTabIds.filter((id) => id !== noteId);
      let nextActive = prev.activeNoteId;
      if (prev.activeNoteId === noteId) {
        nextActive = nextTabs[nextTabs.length - 1] || null;
      }
      return { ...prev, openTabIds: nextTabs, activeNoteId: nextActive };
    });
  }, []);

  const createNote = useCallback(
    (
      folderId: string | null,
      parentNoteId: string | null = null,
      initialTitle?: string,
      initialContent?: string
    ) => {
      const now = Date.now();
      let resolvedFolderId = folderId;
      if (parentNoteId && !resolvedFolderId) {
        const parent = vault.notes.find((n) => n.id === parentNoteId);
        resolvedFolderId = parent?.folderId || null;
      }
      const title =
        initialTitle?.trim() ||
        (parentNoteId ? 'Nova lua' : `Novo planeta ${vault.notes.length + 1}`);
      const content =
        initialContent ??
        `# ${title}\n\n${parentNoteId ? 'Subnota em órbita ao redor do planeta principal.\n' : ''}`;

      const newNote: Note = {
        id: makeId('note'),
        title,
        content,
        folderId: resolvedFolderId,
        parentNoteId,
        maturity: 'nebula',
        tags: [],
        aliases: [],
        createdAt: now,
        updatedAt: now,
      };

      setVault((prev) => ({
        ...prev,
        notes: [...prev.notes, newNote],
        openTabIds: [...prev.openTabIds, newNote.id],
        activeNoteId: newNote.id,
      }));
      if (workspaceMode === 'cosmos') {
        setWorkspaceMode('split');
      }
      return newNote;
    },
    [vault.notes, workspaceMode]
  );

  const updateNote = useCallback((noteId: string, patch: Partial<Note>) => {
    setVault((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === noteId ? { ...n, ...patch, updatedAt: Date.now() } : n
      ),
    }));
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    setVault((prev) => {
      const nextNotes = prev.notes
        .filter((n) => n.id !== noteId)
        .map((n) => (n.parentNoteId === noteId ? { ...n, parentNoteId: null } : n));
      const nextTabs = prev.openTabIds.filter((id) => id !== noteId);
      const nextActive =
        prev.activeNoteId === noteId ? nextTabs[nextTabs.length - 1] || nextNotes[0]?.id || null : prev.activeNoteId;
      return {
        ...prev,
        notes: nextNotes,
        openTabIds: nextTabs,
        activeNoteId: nextActive,
      };
    });
  }, []);

  const createFolder = useCallback((name: string, parentId: string | null) => {
    const newFolder: Folder = {
      id: makeId(parentId ? 'planet' : 'star'),
      name,
      parentId,
      color: parentId ? '#5CA9E6' : '#E5A93B',
      starClass: parentId ? undefined : 'solar',
      isExpanded: true,
      createdAt: Date.now(),
    };
    setVault((prev) => ({
      ...prev,
      folders: [...prev.folders, newFolder],
    }));
  }, []);

  const renameFolder = useCallback((folderId: string, name: string) => {
    setVault((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === folderId ? { ...f, name } : f)),
    }));
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    setVault((prev) => {
      const toRemove = new Set<string>([folderId]);
      let added = true;
      while (added) {
        added = false;
        for (const f of prev.folders) {
          if (f.parentId && toRemove.has(f.parentId) && !toRemove.has(f.id)) {
            toRemove.add(f.id);
            added = true;
          }
        }
      }
      return {
        ...prev,
        folders: prev.folders.filter((f) => !toRemove.has(f.id)),
        notes: prev.notes.map((n) =>
          n.folderId && toRemove.has(n.folderId) ? { ...n, folderId: null } : n
        ),
      };
    });
  }, []);

  const toggleFolderExpand = useCallback((folderId: string) => {
    setVault((prev) => ({
      ...prev,
      folders: prev.folders.map((f) =>
        f.id === folderId ? { ...f, isExpanded: !(f.isExpanded ?? true) } : f
      ),
    }));
  }, []);

  const openOrCreateWikilink = useCallback(
    (targetTitle: string) => {
      const norm = normalizeTitle(targetTitle);
      const existing = vault.notes.find(
        (n) =>
          normalizeTitle(n.title) === norm ||
          n.aliases?.some((a) => normalizeTitle(a) === norm)
      );
      if (existing) {
        openNote(existing.id);
        if (workspaceMode === 'cosmos') {
          setWorkspaceMode('split');
        }
      } else {
        createNote(activeNote?.folderId || null, null, targetTitle);
      }
    },
    [vault.notes, openNote, createNote, activeNote?.folderId, workspaceMode]
  );

  const openDailyNote = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dailyTitle = `Diário ${today}`;
    const existing = vault.notes.find(
      (n) => normalizeTitle(n.title) === normalizeTitle(dailyTitle)
    );
    if (existing) {
      openNote(existing.id);
      return;
    }
    const diaryStar =
      vault.folders.find((f) => f.parentId === null && f.name.toLowerCase().includes('diário')) ||
      vault.folders.find((f) => f.parentId === null) ||
      null;
    const now = Date.now();
    const note: Note = {
      id: makeId('daily'),
      title: dailyTitle,
      content: `# ${dailyTitle}\n\n## Missão de hoje\n- [ ] Registrar conexões no campo gravitacional\n\n## Observações\n\n#diário`,
      folderId: diaryStar?.id || null,
      parentNoteId: null,
      maturity: 'nebula',
      tags: ['diário'],
      aliases: [],
      isDaily: true,
      createdAt: now,
      updatedAt: now,
    };
    setVault((prev) => ({
      ...prev,
      notes: [...prev.notes, note],
      openTabIds: [...prev.openTabIds, note.id],
      activeNoteId: note.id,
    }));
  }, [vault.notes, vault.folders, openNote]);

  const handleLinkUnlinkedMention = useCallback(
    (sourceNoteId: string, targetTitle: string) => {
      const source = vault.notes.find((n) => n.id === sourceNoteId);
      if (!source) return;
      const escaped = targetTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, 'i');
      const updatedContent = source.content.replace(regex, `[[$1]]`);
      updateNote(sourceNoteId, { content: updatedContent });
    },
    [vault.notes, updateNote]
  );

  const handleImportMarkdownFiles = useCallback(
    async (files: FileList) => {
      const targetFolder = vault.folders.find((f) => f.parentId === null)?.id || null;
      const imported: Note[] = [];
      for (const file of Array.from(files)) {
        const text = await file.text();
        const headingMatch = /^#\s+(.+)$/m.exec(text);
        const fileTitle = file.name.replace(/\.(md|markdown|txt)$/i, '');
        const title = headingMatch ? headingMatch[1].trim() : fileTitle;
        const now = Date.now();
        imported.push({
          id: makeId('imp'),
          title,
          content: text,
          folderId: targetFolder,
          parentNoteId: null,
          maturity: 'planet',
          tags: [],
          aliases: [],
          createdAt: now,
          updatedAt: now,
        });
      }
      if (imported.length > 0) {
        setVault((prev) => ({
          ...prev,
          notes: [...prev.notes, ...imported],
          openTabIds: [...prev.openTabIds, imported[0].id],
          activeNoteId: imported[0].id,
        }));
      }
    },
    [vault.folders]
  );

  const handleExportActiveMarkdown = useCallback(() => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeNote.title || 'planeta').replace(/[/\\?%*:|"<>]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeNote]);

  const handleExportVault = useCallback(() => {
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbita-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [vault]);

  const handleFocusInCosmos = useCallback(
    (noteId: string) => {
      if (workspaceMode === 'editor') {
        setWorkspaceMode('split');
      }
      setFocusRequest({ noteId, nonce: Date.now() });
    },
    [workspaceMode]
  );

  const handleUpdateFolderPos = useCallback((folderId: string, pos: { x: number; y: number }) => {
    setVault((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === folderId ? { ...f, customPos: pos } : f)),
    }));
  }, []);

  const handleUpdateNotePos = useCallback((noteId: string, pos: { x: number; y: number }) => {
    setVault((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === noteId ? { ...n, customPos: pos } : n)),
    }));
  }, []);

  const handleResetPositions = useCallback(() => {
    setVault((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => ({ ...f, customPos: undefined })),
      notes: prev.notes.map((n) => ({ ...n, customPos: undefined })),
    }));
  }, []);

  const handleUpdateFolderStarClass = useCallback((folderId: string, starClass: StarClass) => {
    setVault((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === folderId ? { ...f, starClass } : f)),
    }));
  }, []);

  const toggleCosmosFullscreen = useCallback(() => {
    setCosmosFullscreen((prev) => {
      const next = !prev;
      try {
        if (next && document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => {});
        } else if (!next && document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
      } catch {
        // Fallback smoothly inside iframe
      }
      return next;
    });
  }, []);

  const appendToActiveNote = useCallback(
    (text: string) => {
      if (!activeNote) {
        notify('Abra uma nota para inserir conteúdo.', 'error');
        return;
      }
      updateNote(activeNote.id, { content: activeNote.content + text });
    },
    [activeNote, updateNote, notify]
  );

  // Live host bridge for user-authored JS plugins
  const liveHostRef = useRef<LiveVaultHostRef>({
    getNotes: () => vault.notes,
    getFolders: () => vault.folders,
    getActiveNote: () => activeNote,
    openNote,
    openOrCreateWikilink,
    createNote: (opts) =>
      createNote(opts.folderId ?? activeNote?.folderId ?? null, opts.parentNoteId ?? null, opts.title, opts.content),
    updateNote,
    appendToActiveNote,
    getCosmosSettings: () => cosmosSettings,
    updateCosmosSettings: (patch) => setCosmosSettings((prev) => ({ ...prev, ...patch })),
    focusNoteInCosmos: handleFocusInCosmos,
    notify,
    loadPluginSettings: (pluginId) =>
      plugins.find((p) => p.manifest.id === pluginId)?.settings || {},
    savePluginSettings: (pluginId, data) =>
      setPlugins((prev) =>
        prev.map((p) => (p.manifest.id === pluginId ? { ...p, settings: data } : p))
      ),
  });

  liveHostRef.current = {
    getNotes: () => vault.notes,
    getFolders: () => vault.folders,
    getActiveNote: () => activeNote,
    openNote,
    openOrCreateWikilink,
    createNote: (opts) =>
      createNote(opts.folderId ?? activeNote?.folderId ?? null, opts.parentNoteId ?? null, opts.title, opts.content),
    updateNote,
    appendToActiveNote,
    getCosmosSettings: () => cosmosSettings,
    updateCosmosSettings: (patch) => setCosmosSettings((prev) => ({ ...prev, ...patch })),
    focusNoteInCosmos: handleFocusInCosmos,
    notify,
    loadPluginSettings: (pluginId) =>
      plugins.find((p) => p.manifest.id === pluginId)?.settings || {},
    savePluginSettings: (pluginId, data) =>
      setPlugins((prev) =>
        prev.map((p) => (p.manifest.id === pluginId ? { ...p, settings: data } : p))
      ),
  };

  // Compile custom JS plugins and cleanup previous unloaders
  const customCompiled = useMemo(() => {
    const results: Record<string, CompiledCustomPluginResult> = {};
    for (const p of plugins) {
      if (!p.manifest.isBuiltIn) {
        results[p.manifest.id] = executeCustomPlugin(p, liveHostRef);
      }
    }
    return results;
  }, [plugins]);

  useEffect(() => {
    return () => {
      Object.values(customCompiled).forEach((res) => {
        res.unloaders.forEach((fn) => {
          try {
            fn();
          } catch {
            // Ignore unload error
          }
        });
      });
    };
  }, [customCompiled]);

  // Built-in official plugins contributions
  const builtInContributions = useMemo(() => {
    const enabledIds = new Set(plugins.filter((p) => p.enabled).map((p) => p.manifest.id));
    return buildBuiltInContributions({
      enabledIds,
      notes: vault.notes,
      graphIndex,
      appendToActiveNote,
      notify,
      pomodoroState: pomodoro,
      pomodoroControls: {
        toggle: () =>
          setPomodoro((prev) => {
            const nextRunning = !prev.running;
            notify(
              nextRunning ? 'Cronômetro Pomodoro iniciado!' : 'Cronômetro Pomodoro pausado.',
              'info',
              'Foco Pomodoro'
            );
            return { ...prev, running: nextRunning };
          }),
        switchMode: () =>
          setPomodoro((prev) => {
            const nextMode = prev.mode === 'focus' ? 'break' : 'focus';
            return {
              mode: nextMode,
              secondsLeft: nextMode === 'focus' ? 25 * 60 : 5 * 60,
              running: false,
            };
          }),
        reset: () =>
          setPomodoro((prev) => ({
            ...prev,
            secondsLeft: prev.mode === 'focus' ? 25 * 60 : 5 * 60,
            running: false,
          })),
      },
      flashcardsControls: {
        progressMap: flashcardsProgress,
        openReview: () => setFlashcardsOpen(true),
        insertSample: () => {
          appendToActiveNote(
            '\n\nQual é a segunda lei de Kepler? :: O raio vetor que liga um planeta ao Sol varre áreas iguais em tempos iguais.'
          );
          notify('Flashcard inserido na nota atual!', 'success', 'Flashcards Orbitais');
        },
      },
    });
  }, [plugins, vault.notes, graphIndex, appendToActiveNote, notify, pomodoro, flashcardsProgress]);

  // Merged active plugin surface
  const pluginSurface = useMemo(() => {
    const commands: PluginCommand[] = [...builtInContributions.commands];
    const ribbons: PluginRibbonItem[] = [...builtInContributions.ribbons];
    const blockProcessors: Record<string, PluginBlockProcessor> = {
      ...builtInContributions.blockProcessors,
    };
    const sidebarTabs: PluginSidebarTab[] = [...builtInContributions.sidebarTabs];
    const runtimeMap: Record<string, PluginRuntimeInfo> = {};

    for (const p of plugins) {
      if (p.manifest.isBuiltIn) {
        const pid = p.manifest.id;
        runtimeMap[pid] = {
          pluginId: pid,
          status: p.enabled ? 'active' : 'disabled',
          commandsCount: builtInContributions.commands.filter((c) => c.pluginId === pid).length,
          ribbonsCount: builtInContributions.ribbons.filter((r) => r.pluginId === pid).length,
          blocksCount: Object.values(builtInContributions.blockProcessors).filter(
            (b) => b.pluginId === pid
          ).length,
          tabsCount: builtInContributions.sidebarTabs.filter((t) => t.pluginId === pid).length,
          statusBarCount: builtInContributions.statusBarItems.filter((s) => s.pluginId === pid).length,
        };
      } else {
        const compiled = customCompiled[p.manifest.id];
        if (compiled) {
          runtimeMap[p.manifest.id] = compiled.runtimeInfo;
          if (p.enabled && compiled.runtimeInfo.status === 'active') {
            commands.push(...compiled.commands);
            ribbons.push(...compiled.ribbons);
            Object.assign(blockProcessors, compiled.blockProcessors);
            sidebarTabs.push(...compiled.sidebarTabs);
          }
        }
      }
    }

    return { commands, ribbons, blockProcessors, sidebarTabs, runtimeMap };
  }, [plugins, builtInContributions, customCompiled]);

  // Emit 'note:open' event to custom JS plugins when activeNote changes
  const emitPluginEvent = useCallback(
    (event: PluginEventName, payload: { note?: Note }) => {
      Object.values(customCompiled).forEach((res) => {
        res.eventListeners.forEach((l) => {
          if (l.event === event) {
            try {
              l.handler(payload);
            } catch {
              // Ignore listener errors
            }
          }
        });
      });
    },
    [customCompiled]
  );

  useEffect(() => {
    if (activeNote) {
      emitPluginEvent('note:open', { note: activeNote });
    }
  }, [activeNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const blockContext: PluginBlockContext = useMemo(
    () => ({
      note: activeNote,
      notes: vault.notes,
      folders: vault.folders,
      updateActiveNoteContent: (nextContent: string) => {
        if (activeNote) updateNote(activeNote.id, { content: nextContent });
      },
      openNote,
      openOrCreateWikilink,
      clickTag: (tag: string) => {
        setCosmosSettings((prev) => ({
          ...prev,
          filterTag: prev.filterTag === tag ? null : tag,
        }));
        if (workspaceMode === 'editor') setWorkspaceMode('split');
      },
    }),
    [activeNote, vault.notes, vault.folders, updateNote, openNote, openOrCreateWikilink, workspaceMode]
  );

  const pluginUIContext: PluginUIContext = useMemo(
    () => ({
      activeNote,
      notes: vault.notes,
      folders: vault.folders,
      openNote,
      focusInCosmos: handleFocusInCosmos,
    }),
    [activeNote, vault.notes, vault.folders, openNote, handleFocusInCosmos]
  );

  const handleTogglePlugin = useCallback((pluginId: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.manifest.id === pluginId ? { ...p, enabled: !p.enabled } : p))
    );
  }, []);

  const handleSaveCustomPlugin = useCallback((plugin: StoredPlugin) => {
    setPlugins((prev) => {
      const exists = prev.some((p) => p.manifest.id === plugin.manifest.id);
      if (exists) {
        return prev.map((p) => (p.manifest.id === plugin.manifest.id ? plugin : p));
      }
      return [...prev, plugin];
    });
  }, []);

  const handleDeletePlugin = useCallback((pluginId: string) => {
    setPlugins((prev) => prev.filter((p) => p.manifest.id !== pluginId));
  }, []);

  const handleSaveBookmark = useCallback(
    (name: string, camera: { x: number; y: number; zoom: number }) => {
      const bm: CosmosBookmark = {
        id: makeId('bm'),
        name,
        camera,
        filterTag: cosmosSettings.filterTag,
        filterFolderId: cosmosSettings.filterFolderId,
        showConstellations: cosmosSettings.showConstellations,
        createdAt: Date.now(),
      };
      setBookmarks((prev) => [bm, ...prev]);
      notify(`Vista "${name}" salva em Constelações Favoritas.`, 'success');
    },
    [cosmosSettings.filterTag, cosmosSettings.filterFolderId, cosmosSettings.showConstellations, notify]
  );

  const handleApplyBookmark = useCallback((bm: CosmosBookmark) => {
    setCosmosSettings((prev) => ({
      ...prev,
      filterTag: bm.filterTag,
      filterFolderId: bm.filterFolderId,
      showConstellations: bm.showConstellations,
    }));
    setWorkspaceMode((prev) => (prev === 'editor' || prev === 'canvas' ? 'cosmos' : prev));
    setCameraJumpRequest({ ...bm.camera, nonce: Date.now() });
  }, []);

  const handleDeleteBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const handlePromoteTextCardToNote = useCallback(
    (card: CanvasNode) => {
      const title = card.title?.trim() || 'Nova Ideia do Canvas';
      const content = `# ${title}\n\n${card.text || ''}\n`;
      const created = createNote(activeNote?.folderId || vault.folders[0]?.id || null, null, title, content);
      setCanvasState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === card.id ? { ...n, type: 'note', noteId: created.id, color: 'blue' } : n
        ),
      }));
      notify(`Cartão promovido a Planeta "${created.title}"!`, 'success');
    },
    [createNote, activeNote?.folderId, vault.folders, notify]
  );

  const allFlashcards = useMemo(() => extractFlashcardsFromNotes(vault.notes), [vault.notes]);

  const pomodoroEnabled = plugins.some(
    (p) => p.manifest.id === 'pomodoro-orbital' && p.enabled
  );
  const showPomodoroBadge =
    pomodoroEnabled && (pomodoro.running || pomodoro.secondsLeft !== 25 * 60 || pomodoro.mode === 'break');
  const pomoMinutes = String(Math.floor(pomodoro.secondsLeft / 60)).padStart(2, '0');
  const pomoSeconds = String(pomodoro.secondsLeft % 60).padStart(2, '0');

  return (
    <div className="h-screen w-screen flex flex-col bg-[#05070D] text-[#ECEFF6] overflow-hidden">
      {/* Top Workspace Header — Hidden in Cosmos Fullscreen */}
      {!cosmosFullscreen && (
        <header className="h-12 shrink-0 flex items-center justify-between gap-4 px-3 border-b border-[#1B253B] bg-[#070A12]">
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setLeftOpen((v) => !v)}
              title={leftOpen ? 'Recolher barra lateral esquerda' : 'Abrir barra lateral esquerda'}
              className="p-1.5 rounded-md text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
            >
              {leftOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>

            <span className="font-display text-base font-semibold tracking-tight text-[#ECEFF6] whitespace-nowrap shrink-0">
              Órbita
            </span>
          </div>

          <div className="flex-1 flex items-center gap-1 overflow-x-auto min-w-0 px-2">
            {vault.openTabIds.map((tabId) => {
              const tabNote = vault.notes.find((n) => n.id === tabId);
              if (!tabNote) return null;
              const isActive = tabId === vault.activeNoteId;
              const Icon =
                tabNote.maturity === 'nebula'
                  ? Sparkles
                  : tabNote.maturity === 'star'
                    ? Sun
                    : Globe;
              const iconColor =
                tabNote.maturity === 'nebula'
                  ? 'text-[#38BDF8]'
                  : tabNote.maturity === 'star'
                    ? 'text-[#E5A93B]'
                    : 'text-[#5CA9E6]';

              return (
                <div
                  key={tabId}
                  onClick={() => openNote(tabId)}
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs max-w-[190px] shrink-0 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#121A2E] text-[#ECEFF6] border border-[#243456]'
                      : 'text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#0D1322] border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                  <span className="truncate">{tabNote.title || 'Sem título'}</span>
                  <button
                    type="button"
                    onClick={(e) => closeTab(tabId, e)}
                    className="opacity-60 group-hover:opacity-100 hover:text-[#E5A93B] cursor-pointer"
                    aria-label="Fechar aba"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => createNote(activeNote?.folderId || vault.folders[0]?.id || null)}
              title="Novo planeta"
              className="p-1.5 rounded-md text-[#7B88A6] hover:text-[#E5A93B] hover:bg-[#101626] transition-colors shrink-0 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {showPomodoroBadge && (
              <button
                type="button"
                onClick={() => setPomodoro((p) => ({ ...p, running: !p.running }))}
                title="Pomodoro Orbital (clique para pausar/retomar)"
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono tabular-nums cursor-pointer transition-colors ${
                  pomodoro.running
                    ? 'border-[#E5A93B]/50 bg-[#E5A93B]/10 text-[#E5A93B]'
                    : 'border-[#1B253B] bg-[#0B0F1A] text-[#9AA7C4]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {pomoMinutes}:{pomoSeconds}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPluginsOpen(true)}
              title="Extensões e Estúdio de Plugins"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0B0F1A] border border-[#1B253B] text-xs text-[#9AA7C4] hover:text-[#E5A93B] hover:border-[#E5A93B]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Puzzle className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Plugins</span>
            </button>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              title="Paleta de comandos (Ctrl+K)"
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#0B0F1A] border border-[#1B253B] text-xs text-[#9AA7C4] hover:text-[#ECEFF6] hover:border-[#5CA9E6]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Navegar</span>
              <kbd className="font-mono text-[10px] text-[#7B88A6]">⌘K</kbd>
            </button>

            <div className="flex items-center p-0.5 rounded-lg bg-[#05070D] border border-[#1B253B]">
              <button
                type="button"
                onClick={() => setWorkspaceMode('editor')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  workspaceMode === 'editor'
                    ? 'bg-[#131C31] text-[#ECEFF6]'
                    : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                <PenLine className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('split')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  workspaceMode === 'split'
                    ? 'bg-[#131C31] text-[#E5A93B]'
                    : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dividido</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('cosmos')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  workspaceMode === 'cosmos'
                    ? 'bg-[#131C31] text-[#5CA9E6]'
                    : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                <Orbit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cosmos</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('canvas')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  workspaceMode === 'canvas'
                    ? 'bg-[#131C31] text-[#E5A93B]'
                    : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Canvas</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRightOpen((v) => !v)}
              title={rightOpen ? 'Recolher inspetor direito' : 'Abrir inspetor direito'}
              className="p-1.5 rounded-md text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] transition-colors cursor-pointer"
            >
              {rightOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>
      )}

      {/* Main Isolated Workspace with Obsidian-style Plugin Ribbon */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {!cosmosFullscreen && (
          <PluginRibbon
            ribbons={pluginSurface.ribbons}
            activePluginsCount={plugins.filter((p) => p.enabled).length}
            onOpenDailyNote={openDailyNote}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onOpenPlugins={() => setPluginsOpen(true)}
          />
        )}

        {!cosmosFullscreen && leftOpen && (
          <>
            <SidebarLeft
              width={leftWidth}
              folders={vault.folders}
              notes={vault.notes}
              activeNoteId={vault.activeNoteId}
              graphIndex={graphIndex}
              onSelectNote={openNote}
              onCreateNote={(folderId, parentNoteId) => createNote(folderId, parentNoteId || null)}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onToggleFolderExpand={toggleFolderExpand}
              onDeleteNote={deleteNote}
              onOpenDailyNote={openDailyNote}
              onSelectTagInCosmos={(tag) => {
                setCosmosSettings((prev) => ({
                  ...prev,
                  filterTag: prev.filterTag === tag ? null : tag,
                }));
                if (workspaceMode === 'editor') setWorkspaceMode('split');
              }}
              onImportMarkdownFiles={handleImportMarkdownFiles}
              onExportVault={handleExportVault}
              onExportActiveMarkdown={handleExportActiveMarkdown}
            />
            <div
              role="separator"
              aria-orientation="vertical"
              title="Arraste para redimensionar ou recolher · Duplo-clique para redefinir"
              onPointerDown={() => setActiveResize('left')}
              onDoubleClick={() => setLeftWidth(272)}
              className={`w-1.5 shrink-0 cursor-col-resize transition-colors border-r border-[#1B253B] hover:bg-[#E5A93B]/60 ${
                activeResize === 'left' ? 'bg-[#E5A93B]' : 'bg-transparent'
              }`}
            />
          </>
        )}

        <main ref={mainRef} className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
          {!cosmosFullscreen && (workspaceMode === 'editor' || workspaceMode === 'split') && (
            <div
              style={
                workspaceMode === 'split' ? { width: `${splitRatio * 100}%` } : undefined
              }
              className={`min-w-0 min-h-0 flex flex-col ${
                workspaceMode === 'split' ? 'shrink-0' : 'w-full'
              }`}
            >
              {activeNote ? (
                <MarkdownEditor
                  note={activeNote}
                  notes={vault.notes}
                  folders={vault.folders}
                  editorMode={editorMode}
                  onChangeEditorMode={setEditorMode}
                  onUpdateNote={updateNote}
                  onOpenNote={openNote}
                  onOpenWikilink={openOrCreateWikilink}
                  onCreateSubnote={(parentId) => createNote(null, parentId)}
                  onClickTag={(tag) => {
                    setCosmosSettings((prev) => ({
                      ...prev,
                      filterTag: prev.filterTag === tag ? null : tag,
                    }));
                    if (workspaceMode === 'editor') setWorkspaceMode('split');
                  }}
                  onFocusInCosmos={handleFocusInCosmos}
                  allTags={allTagNames}
                  backlinkCount={graphIndex.backlinksByNote[activeNote.id]?.length || 0}
                  outgoingCount={graphIndex.outgoingByNote[activeNote.id]?.length || 0}
                  blockProcessors={pluginSurface.blockProcessors}
                  blockContext={blockContext}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#070A12]">
                  <Globe className="w-10 h-10 text-[#5CA9E6] mb-3 opacity-80" />
                  <h2 className="font-display text-xl font-semibold text-[#ECEFF6] mb-1.5">
                    Nenhum planeta aberto
                  </h2>
                  <p className="text-sm text-[#9AA7C4] max-w-sm mb-5">
                    Selecione um corpo celeste na barra lateral, clique em um planeta no mapa cósmico ou crie uma nova nota.
                  </p>
                  <button
                    type="button"
                    onClick={() => createNote(vault.folders[0]?.id || null)}
                    className="px-4 py-2 rounded-lg bg-[#E5A93B] text-[#05070D] text-xs font-semibold hover:bg-[#F3BA52] transition-colors cursor-pointer"
                  >
                    Criar novo planeta
                  </button>
                </div>
              )}
            </div>
          )}

          {!cosmosFullscreen && workspaceMode === 'split' && (
            <div
              role="separator"
              aria-orientation="vertical"
              title="Arraste para aumentar ou ocultar o mapa/editor · Duplo-clique para centralizar"
              onPointerDown={() => setActiveResize('split')}
              onDoubleClick={() => setSplitRatio(0.48)}
              className={`w-1.5 shrink-0 cursor-col-resize transition-colors border-x border-[#1B253B] hover:bg-[#E5A93B]/60 ${
                activeResize === 'split' ? 'bg-[#E5A93B]' : 'bg-[#070A12]'
              }`}
            />
          )}

          {(cosmosFullscreen || workspaceMode === 'split' || workspaceMode === 'cosmos') && (
            <div className="flex-1 min-w-0 min-h-0 relative">
              <CosmosCanvas
                folders={vault.folders}
                notes={vault.notes}
                graphIndex={graphIndex}
                activeNoteId={vault.activeNoteId}
                focusRequest={focusRequest}
                cameraJumpRequest={cameraJumpRequest}
                bookmarks={bookmarks}
                settings={cosmosSettings}
                isFullscreen={cosmosFullscreen}
                onToggleFullscreen={toggleCosmosFullscreen}
                onUpdateSettings={(patch) =>
                  setCosmosSettings((prev) => ({ ...prev, ...patch }))
                }
                onUpdateFolderStarClass={handleUpdateFolderStarClass}
                onSelectNote={(noteId) => openNote(noteId)}
                onOpenNoteInEditor={(noteId) => {
                  openNote(noteId);
                  if (cosmosFullscreen) setCosmosFullscreen(false);
                  if (workspaceMode === 'cosmos') setWorkspaceMode('split');
                }}
                onCreateSubnote={(parentId) => createNote(null, parentId)}
                onUpdateFolderPos={handleUpdateFolderPos}
                onUpdateNotePos={handleUpdateNotePos}
                onResetPositions={handleResetPositions}
                onSaveBookmark={handleSaveBookmark}
                onApplyBookmark={handleApplyBookmark}
                onDeleteBookmark={handleDeleteBookmark}
              />
            </div>
          )}

          {!cosmosFullscreen && workspaceMode === 'canvas' && (
            <div className="flex-1 min-w-0 min-h-0 relative">
              <SpatialCanvas
                canvas={canvasState}
                notes={vault.notes}
                onChangeCanvas={setCanvasState}
                onOpenNoteInEditor={(noteId) => {
                  openNote(noteId);
                  setWorkspaceMode('split');
                }}
                onOpenWikilink={(title) => {
                  openOrCreateWikilink(title);
                  setWorkspaceMode('split');
                }}
                onPromoteTextCardToNote={handlePromoteTextCardToNote}
              />
            </div>
          )}
        </main>

        {!cosmosFullscreen && rightOpen && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              title="Arraste para redimensionar ou recolher · Duplo-clique para ajuste automático"
              onPointerDown={() => setActiveResize('right')}
              onDoubleClick={() => {
                setRightWidthCustom(false);
                setRightWidth(252);
              }}
              className={`w-1.5 shrink-0 cursor-col-resize transition-colors border-l border-[#1B253B] hover:bg-[#E5A93B]/60 ${
                activeResize === 'right' ? 'bg-[#E5A93B]' : 'bg-transparent'
              }`}
            />
            <SidebarRight
              width={
                rightWidthCustom
                  ? rightWidth
                  : Math.min(390, 252 + pluginSurface.sidebarTabs.length * 36)
              }
              isAutoResizing={activeResize !== 'right'}
              activeNote={activeNote}
              folders={vault.folders}
              notes={vault.notes}
              graphIndex={graphIndex}
              onSelectNote={openNote}
              onUpdateNote={updateNote}
              onOpenWikilink={openOrCreateWikilink}
              onLinkUnlinkedMention={handleLinkUnlinkedMention}
              pluginTabs={pluginSurface.sidebarTabs}
              pluginUIContext={pluginUIContext}
            />
          </>
        )}
      </div>

      <CommandPalette
        isOpen={commandOpen}
        notes={vault.notes}
        bookmarks={bookmarks}
        pluginCommands={pluginSurface.commands}
        onClose={() => setCommandOpen(false)}
        onSelectNote={openNote}
        onCreateNoteWithTitle={(title) =>
          createNote(activeNote?.folderId || vault.folders[0]?.id || null, null, title)
        }
        onOpenDailyNote={openDailyNote}
        onSetWorkspaceMode={setWorkspaceMode}
        onOpenPlugins={() => setPluginsOpen(true)}
        onJumpBookmark={handleApplyBookmark}
      />

      <PluginModal
        isOpen={pluginsOpen}
        plugins={plugins}
        runtimeMap={pluginSurface.runtimeMap}
        onClose={() => setPluginsOpen(false)}
        onTogglePlugin={handleTogglePlugin}
        onSaveCustomPlugin={handleSaveCustomPlugin}
        onDeletePlugin={handleDeletePlugin}
        onNotify={notify}
      />

      <FlashcardReviewModal
        isOpen={flashcardsOpen}
        cards={allFlashcards}
        progressMap={flashcardsProgress}
        onClose={() => setFlashcardsOpen(false)}
        onGradeCard={(cardId, nextProgress) =>
          setFlashcardsProgress((prev) => ({ ...prev, [cardId]: nextProgress }))
        }
        onOpenNote={(noteId) => {
          openNote(noteId);
          setWorkspaceMode('split');
        }}
        onInsertSampleCard={() => {
          appendToActiveNote(
            '\n\nQual é a segunda lei de Kepler? :: O raio vetor que liga um planeta ao Sol varre áreas iguais em tempos iguais.'
          );
          notify('Flashcard inserido na nota atual!', 'success', 'Flashcards Orbitais');
        }}
      />

      {notices.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
          {notices.map((n) => (
            <div
              key={n.id}
              className={`pointer-events-auto px-3.5 py-2.5 rounded-lg border bg-[#0B0F1A]/95 backdrop-blur-md shadow-xl text-xs ${
                n.tone === 'error'
                  ? 'border-[#EF4444]/60 text-[#FCA5A5]'
                  : n.tone === 'success'
                    ? 'border-[#E5A93B]/60 text-[#FBE6B2]'
                    : 'border-[#5CA9E6]/50 text-[#ECEFF6]'
              }`}
            >
              {n.pluginName && (
                <div className="text-[10px] font-mono text-[#7B88A6] mb-0.5">
                  {n.pluginName}
                </div>
              )}
              <div>{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
