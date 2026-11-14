import React from 'react';
import { CosmosSettings, Folder, Note } from './vault';

export type PluginIconName =
  | 'puzzle'
  | 'sparkles'
  | 'table'
  | 'kanban'
  | 'clock'
  | 'bar-chart'
  | 'file-text'
  | 'zap'
  | 'terminal'
  | 'orbit'
  | 'compass'
  | 'layers'
  | 'wand';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: PluginIconName;
  isBuiltIn?: boolean;
}

export interface StoredPlugin {
  manifest: PluginManifest;
  enabled: boolean;
  code: string;
  settings: Record<string, unknown>;
  updatedAt: number;
}

export interface PluginCommand {
  id: string;
  pluginId: string;
  pluginName: string;
  name: string;
  hint?: string;
  callback: () => void;
}

export interface PluginRibbonItem {
  id: string;
  pluginId: string;
  title: string;
  icon: PluginIconName;
  onClick: () => void;
}

export interface PluginSidebarTab {
  id: string;
  pluginId: string;
  title: string;
  icon: PluginIconName;
  render: (ctx: PluginUIContext) => React.ReactNode;
}

export interface PluginStatusBarItem {
  id: string;
  pluginId: string;
  text: string;
  title?: string;
  tone?: 'neutral' | 'amber' | 'blue';
  onClick?: () => void;
}

export interface PluginBlockContext {
  note: Note | null;
  notes: Note[];
  folders: Folder[];
  updateActiveNoteContent: (nextContent: string) => void;
  openNote: (noteId: string) => void;
  openOrCreateWikilink: (title: string) => void;
  clickTag: (tag: string) => void;
}

export interface PluginUIContext {
  activeNote: Note | null;
  notes: Note[];
  folders: Folder[];
  openNote: (noteId: string) => void;
  focusInCosmos: (noteId: string) => void;
}

export type PluginBlockProcessor =
  | {
      kind: 'react';
      pluginId: string;
      language: string;
      render: (source: string, ctx: PluginBlockContext) => React.ReactNode;
    }
  | {
      kind: 'dom';
      pluginId: string;
      language: string;
      render: (source: string, el: HTMLElement, ctx: PluginBlockContext) => void;
    };

export type PluginEventName = 'note:open' | 'note:change' | 'note:create';

export interface PluginRuntimeInfo {
  pluginId: string;
  status: 'active' | 'disabled' | 'error';
  error?: string;
  commandsCount: number;
  ribbonsCount: number;
  blocksCount: number;
  tabsCount: number;
  statusBarCount: number;
}

export interface PluginNotice {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
  pluginName?: string;
}

export interface OrbitaPluginAPI {
  pluginId: string;
  addCommand: (cmd: { id: string; name: string; hint?: string; callback: () => void }) => void;
  addRibbonIcon: (item: {
    id?: string;
    icon?: PluginIconName;
    title: string;
    onClick: () => void;
  }) => void;
  registerMarkdownCodeBlockProcessor: (
    language: string,
    handler: (source: string, el: HTMLElement, ctx: PluginBlockContext) => void
  ) => void;
  addSidebarTab: (tab: {
    id: string;
    title: string;
    icon?: PluginIconName;
    render: (el: HTMLElement, ctx: PluginUIContext) => void;
  }) => void;
  addStatusBarItem: (item: {
    id?: string;
    text: string;
    title?: string;
    tone?: 'neutral' | 'amber' | 'blue';
    onClick?: () => void;
  }) => void;
  on: (event: PluginEventName, handler: (payload: { note?: Note }) => void) => void;
  notice: (message: string, tone?: 'info' | 'success' | 'error') => void;
  vault: {
    getNotes: () => Note[];
    getFolders: () => Folder[];
    getActiveNote: () => Note | null;
    openNote: (noteId: string) => void;
    openOrCreateWikilink: (title: string) => void;
    createNote: (opts: {
      title: string;
      content?: string;
      folderId?: string | null;
      parentNoteId?: string | null;
    }) => Note | null;
    updateNote: (noteId: string, patch: Partial<Note>) => void;
    appendToActiveNote: (text: string) => void;
  };
  cosmos: {
    getSettings: () => CosmosSettings;
    updateSettings: (patch: Partial<CosmosSettings>) => void;
    focusNote: (noteId: string) => void;
  };
  storage: {
    load: <T = Record<string, unknown>>() => T;
    save: (data: Record<string, unknown>) => void;
  };
}
