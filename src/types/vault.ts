export type MaturityStage = 'nebula' | 'planet' | 'star';
export type StarClass = 'solar' | 'blue-giant' | 'binary';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null = Estrela (Pasta Principal / Centro Gravitacional)
  color?: string;
  starClass?: StarClass;
  isExpanded?: boolean;
  customPos?: { x: number; y: number };
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null; // null = asteroide / órfã
  parentNoteId: string | null; // não-nulo = Lua (Subnota orbitando um planeta)
  maturity: MaturityStage;
  tags: string[];
  aliases: string[];
  pinned?: boolean;
  isDaily?: boolean;
  customPos?: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

export type WorkspaceViewMode = 'editor' | 'split' | 'cosmos' | 'canvas';
export type EditorMode = 'edit' | 'live' | 'split' | 'preview';

export interface CosmosSettings {
  orbiting: boolean;
  orbitSpeed: number; // 0.2 to 2.5
  gravityPull: number; // 0 to 1.0
  showSpacetimeGrid: boolean;
  showOrbitRings: boolean;
  showConstellations: boolean;
  showLinks: boolean;
  showSubnotes: boolean;
  showOrphans: boolean;
  showLabels: boolean;
  spread: number; // 0.65 to 1.75
  filterTag: string | null;
  filterFolderId: string | null;
  searchQuery: string;
  colorBy: 'maturity' | 'star';
  localGraphDepth: 0 | 1 | 2;
}

export interface WorkspacePreset {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  workspaceMode: WorkspaceViewMode;
  editorMode: EditorMode;
  leftOpen: boolean;
  rightOpen: boolean;
  splitRatio: number;
  focusMode: boolean;
  localGraphDepth: 0 | 1 | 2;
  enabledPluginIds: string[];
  createdAt: number;
}

export interface CosmosBookmark {
  id: string;
  name: string;
  camera: { x: number; y: number; zoom: number };
  filterTag: string | null;
  filterFolderId: string | null;
  showConstellations: boolean;
  createdAt: number;
}

export type CanvasColor = 'neutral' | 'amber' | 'blue' | 'cyan';

export interface CanvasNode {
  id: string;
  type: 'text' | 'note';
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  text?: string;
  noteId?: string;
  color?: CanvasColor;
}

export interface CanvasEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  color?: 'amber' | 'blue';
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface VaultData {
  folders: Folder[];
  notes: Note[];
  openTabIds: string[];
  activeNoteId: string | null;
}
