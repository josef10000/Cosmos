import React, { useEffect, useRef, useState } from 'react';
import {
  OrbitaPluginAPI,
  PluginBlockContext,
  PluginBlockProcessor,
  PluginCommand,
  PluginEventName,
  PluginRibbonItem,
  PluginRuntimeInfo,
  PluginSidebarTab,
  PluginStatusBarItem,
  PluginUIContext,
  StoredPlugin,
} from '../types/plugins';
import { CosmosSettings, Folder, Note } from '../types/vault';

// Helper React component that mounts custom JS plugin DOM output safely
export const PluginDomHost: React.FC<{
  renderDom: (el: HTMLElement) => void;
  depsKey: string;
  className?: string;
}> = ({ renderDom, depsKey, className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';
    setRenderError(null);
    try {
      renderDom(el);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err));
    }
  }, [renderDom, depsKey]);

  if (renderError) {
    return (
      <div className="p-3 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 text-xs text-[#FCA5A5] font-mono">
        Erro no plugin: {renderError}
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
};

export interface LiveVaultHostRef {
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
  getCosmosSettings: () => CosmosSettings;
  updateCosmosSettings: (patch: Partial<CosmosSettings>) => void;
  focusNoteInCosmos: (noteId: string) => void;
  notify: (msg: string, tone?: 'info' | 'success' | 'error', pluginName?: string) => void;
  savePluginSettings: (pluginId: string, data: Record<string, unknown>) => void;
  loadPluginSettings: (pluginId: string) => Record<string, unknown>;
}

export interface CompiledCustomPluginResult {
  commands: PluginCommand[];
  ribbons: PluginRibbonItem[];
  blockProcessors: Record<string, PluginBlockProcessor>;
  sidebarTabs: PluginSidebarTab[];
  statusBarItems: PluginStatusBarItem[];
  eventListeners: { event: PluginEventName; handler: (payload: { note?: Note }) => void }[];
  unloaders: (() => void)[];
  runtimeInfo: PluginRuntimeInfo;
}

export function executeCustomPlugin(
  plugin: StoredPlugin,
  hostRef: React.MutableRefObject<LiveVaultHostRef>
): CompiledCustomPluginResult {
  const commands: PluginCommand[] = [];
  const ribbons: PluginRibbonItem[] = [];
  const blockProcessors: Record<string, PluginBlockProcessor> = {};
  const sidebarTabs: PluginSidebarTab[] = [];
  const statusBarItems: PluginStatusBarItem[] = [];
  const eventListeners: { event: PluginEventName; handler: (payload: { note?: Note }) => void }[] = [];
  const unloaders: (() => void)[] = [];

  if (!plugin.enabled) {
    return {
      commands,
      ribbons,
      blockProcessors,
      sidebarTabs,
      statusBarItems,
      eventListeners,
      unloaders,
      runtimeInfo: {
        pluginId: plugin.manifest.id,
        status: 'disabled',
        commandsCount: 0,
        ribbonsCount: 0,
        blocksCount: 0,
        tabsCount: 0,
        statusBarCount: 0,
      },
    };
  }

  const api: OrbitaPluginAPI = {
    pluginId: plugin.manifest.id,
    addCommand: (cmd) => {
      if (!cmd || !cmd.name || typeof cmd.callback !== 'function') return;
      commands.push({
        id: `${plugin.manifest.id}:${cmd.id || cmd.name}`,
        pluginId: plugin.manifest.id,
        pluginName: plugin.manifest.name,
        name: cmd.name,
        hint: cmd.hint || plugin.manifest.name,
        callback: () => {
          try {
            cmd.callback();
          } catch (err) {
            hostRef.current.notify(
              `Erro ao executar "${cmd.name}": ${err instanceof Error ? err.message : String(err)}`,
              'error',
              plugin.manifest.name
            );
          }
        },
      });
    },
    addRibbonIcon: (item) => {
      if (!item || typeof item.onClick !== 'function') return;
      ribbons.push({
        id: `${plugin.manifest.id}:${item.id || ribbons.length}`,
        pluginId: plugin.manifest.id,
        icon: item.icon || plugin.manifest.icon || 'puzzle',
        title: item.title || plugin.manifest.name,
        onClick: () => {
          try {
            item.onClick();
          } catch (err) {
            hostRef.current.notify(
              `Erro no botão "${item.title}": ${err instanceof Error ? err.message : String(err)}`,
              'error',
              plugin.manifest.name
            );
          }
        },
      });
    },
    registerMarkdownCodeBlockProcessor: (language, handler) => {
      const langKey = (language || '').trim().toLowerCase();
      if (!langKey || typeof handler !== 'function') return;
      blockProcessors[langKey] = {
        kind: 'dom',
        pluginId: plugin.manifest.id,
        language: langKey,
        render: (source: string, el: HTMLElement, ctx: PluginBlockContext) => {
          handler(source, el, ctx);
        },
      };
    },
    addSidebarTab: (tab) => {
      if (!tab || !tab.title || typeof tab.render !== 'function') return;
      sidebarTabs.push({
        id: `${plugin.manifest.id}:${tab.id || tab.title}`,
        pluginId: plugin.manifest.id,
        title: tab.title,
        icon: tab.icon || plugin.manifest.icon || 'puzzle',
        render: (ctx: PluginUIContext) => (
          <div className="flex-1 overflow-y-auto p-3.5">
            <PluginDomHost
              depsKey={`${ctx.activeNote?.id || 'none'}-${ctx.activeNote?.updatedAt || 0}-${ctx.notes.length}`}
              renderDom={(el) => tab.render(el, ctx)}
            />
          </div>
        ),
      });
    },
    addStatusBarItem: (item) => {
      if (!item || !item.text) return;
      statusBarItems.push({
        id: `${plugin.manifest.id}:${item.id || statusBarItems.length}`,
        pluginId: plugin.manifest.id,
        text: String(item.text),
        title: item.title,
        tone: item.tone || 'neutral',
        onClick: item.onClick
          ? () => {
              try {
                item.onClick?.();
              } catch (err) {
                hostRef.current.notify(
                  `Erro na barra de status: ${err instanceof Error ? err.message : String(err)}`,
                  'error',
                  plugin.manifest.name
                );
              }
            }
          : undefined,
      });
    },
    on: (event, handler) => {
      if (typeof handler === 'function') {
        eventListeners.push({ event, handler });
      }
    },
    notice: (message, tone = 'info') => {
      hostRef.current.notify(String(message), tone, plugin.manifest.name);
    },
    vault: {
      getNotes: () => hostRef.current.getNotes(),
      getFolders: () => hostRef.current.getFolders(),
      getActiveNote: () => hostRef.current.getActiveNote(),
      openNote: (noteId) => hostRef.current.openNote(noteId),
      openOrCreateWikilink: (title) => hostRef.current.openOrCreateWikilink(title),
      createNote: (opts) => hostRef.current.createNote(opts),
      updateNote: (noteId, patch) => hostRef.current.updateNote(noteId, patch),
      appendToActiveNote: (text) => hostRef.current.appendToActiveNote(text),
    },
    cosmos: {
      getSettings: () => hostRef.current.getCosmosSettings(),
      updateSettings: (patch) => hostRef.current.updateCosmosSettings(patch),
      focusNote: (noteId) => hostRef.current.focusNoteInCosmos(noteId),
    },
    storage: {
      load: <T = Record<string, unknown>>() =>
        hostRef.current.loadPluginSettings(plugin.manifest.id) as T,
      save: (data) => hostRef.current.savePluginSettings(plugin.manifest.id, data),
    },
  };

  try {
    const classMatch = /\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(plugin.code);
    const detectedClass = classMatch ? classMatch[1] : null;

    const moduleObj: { exports: unknown } = { exports: null };
    const exportsObj: Record<string, unknown> = {};

    const runnerBody = `
      "use strict";
      ${plugin.code}
      if (module.exports) return module.exports;
      if (exports.default) return exports.default;
      ${detectedClass ? `if (typeof ${detectedClass} === 'function') return ${detectedClass};` : ''}
      if (typeof onload === 'function') return { onload, onunload: typeof onunload === 'function' ? onunload : undefined };
      return null;
    `;

    const factory = new Function('api', 'module', 'exports', runnerBody);
    const exported = factory(api, moduleObj, exportsObj);

    if (typeof exported === 'function') {
      const instance = new (exported as new () => {
        onload?: (api: OrbitaPluginAPI) => void;
        onunload?: () => void;
      })();
      if (typeof instance.onload === 'function') {
        instance.onload(api);
      }
      if (typeof instance.onunload === 'function') {
        unloaders.push(() => instance.onunload?.());
      }
    } else if (exported && typeof exported === 'object') {
      const obj = exported as { onload?: (api: OrbitaPluginAPI) => void; onunload?: () => void };
      if (typeof obj.onload === 'function') {
        obj.onload(api);
      }
      if (typeof obj.onunload === 'function') {
        unloaders.push(() => obj.onunload?.());
      }
    }

    return {
      commands,
      ribbons,
      blockProcessors,
      sidebarTabs,
      statusBarItems,
      eventListeners,
      unloaders,
      runtimeInfo: {
        pluginId: plugin.manifest.id,
        status: 'active',
        commandsCount: commands.length,
        ribbonsCount: ribbons.length,
        blocksCount: Object.keys(blockProcessors).length,
        tabsCount: sidebarTabs.length,
        statusBarCount: statusBarItems.length,
      },
    };
  } catch (err) {
    return {
      commands: [],
      ribbons: [],
      blockProcessors: {},
      sidebarTabs: [],
      statusBarItems: [],
      eventListeners: [],
      unloaders: [],
      runtimeInfo: {
        pluginId: plugin.manifest.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        commandsCount: 0,
        ribbonsCount: 0,
        blocksCount: 0,
        tabsCount: 0,
        statusBarCount: 0,
      },
    };
  }
}
