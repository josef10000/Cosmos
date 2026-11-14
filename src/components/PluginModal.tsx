import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Code2,
  Download,
  FileCode2,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PluginIcon } from '../plugins/pluginIcons';
import { PLUGIN_STARTER_TEMPLATES } from '../plugins/pluginTemplates';
import { PluginIconName, PluginRuntimeInfo, StoredPlugin } from '../types/plugins';

interface PluginModalProps {
  isOpen: boolean;
  plugins: StoredPlugin[];
  runtimeMap: Record<string, PluginRuntimeInfo>;
  onClose: () => void;
  onTogglePlugin: (pluginId: string) => void;
  onSaveCustomPlugin: (plugin: StoredPlugin) => void;
  onDeletePlugin: (pluginId: string) => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}

const ICON_OPTIONS: { value: PluginIconName; label: string }[] = [
  { value: 'zap', label: 'Raio' },
  { value: 'sparkles', label: 'Faíscas' },
  { value: 'puzzle', label: 'Quebra-cabeça' },
  { value: 'table', label: 'Tabela' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'compass', label: 'Bússola' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'orbit', label: 'Órbita' },
  { value: 'layers', label: 'Camadas' },
  { value: 'wand', label: 'Varinha' },
  { value: 'clock', label: 'Relógio' },
  { value: 'file-text', label: 'Nota' },
  { value: 'bar-chart', label: 'Gráfico' },
];

export const PluginModal: React.FC<PluginModalProps> = ({
  isOpen,
  plugins,
  runtimeMap,
  onClose,
  onTogglePlugin,
  onSaveCustomPlugin,
  onDeletePlugin,
  onNotify,
}) => {
  const [view, setView] = useState<'list' | 'gallery' | 'studio' | 'import'>('list');
  const [search, setSearch] = useState('');
  const [showDocs, setShowDocs] = useState(false);

  // Studio draft state
  const [draftId, setDraftId] = useState('meu-plugin-custom');
  const [draftName, setDraftName] = useState('Meu Plugin');
  const [draftVersion, setDraftVersion] = useState('1.0.0');
  const [draftAuthor, setDraftAuthor] = useState('Você');
  const [draftDescription, setDraftDescription] = useState(
    'Extensão personalizada para o Órbita.'
  );
  const [draftIcon, setDraftIcon] = useState<PluginIconName>('zap');
  const [draftCode, setDraftCode] = useState(PLUGIN_STARTER_TEMPLATES[0].code);
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);

  // Import state
  const [importJsonText, setImportJsonText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredPlugins = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter(
      (p) =>
        p.manifest.name.toLowerCase().includes(q) ||
        p.manifest.description.toLowerCase().includes(q) ||
        p.manifest.id.toLowerCase().includes(q)
    );
  }, [plugins, search]);

  if (!isOpen) return null;

  const startNewFromTemplate = (templateId: string) => {
    const tpl =
      PLUGIN_STARTER_TEMPLATES.find((t) => t.id === templateId) ||
      PLUGIN_STARTER_TEMPLATES[0];
    const suffix = Date.now().toString(36).slice(-3);
    setEditingOriginalId(null);
    setDraftId(`${tpl.manifest.id}-${suffix}`);
    setDraftName(tpl.manifest.name);
    setDraftVersion(tpl.manifest.version);
    setDraftAuthor(tpl.manifest.author);
    setDraftDescription(tpl.manifest.description);
    setDraftIcon(tpl.manifest.icon);
    setDraftCode(tpl.code);
    setView('studio');
  };

  const openInStudio = (plugin: StoredPlugin) => {
    setEditingOriginalId(plugin.manifest.isBuiltIn ? null : plugin.manifest.id);
    setDraftId(plugin.manifest.isBuiltIn ? `${plugin.manifest.id}-fork` : plugin.manifest.id);
    setDraftName(plugin.manifest.isBuiltIn ? `${plugin.manifest.name} (Cópia)` : plugin.manifest.name);
    setDraftVersion(plugin.manifest.version);
    setDraftAuthor(plugin.manifest.isBuiltIn ? 'Você' : plugin.manifest.author);
    setDraftDescription(plugin.manifest.description);
    setDraftIcon(plugin.manifest.icon);
    setDraftCode(
      plugin.manifest.isBuiltIn ? PLUGIN_STARTER_TEMPLATES[0].code : plugin.code
    );
    setView('studio');
  };

  const handleSaveStudio = () => {
    const cleanId = draftId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-');
    if (!cleanId) {
      onNotify('Informe um ID válido para o plugin.', 'error');
      return;
    }
    const existingBuiltIn = plugins.find(
      (p) => p.manifest.id === cleanId && p.manifest.isBuiltIn
    );
    if (existingBuiltIn) {
      onNotify('Esse ID pertence a um plugin oficial. Use outro ID.', 'error');
      return;
    }

    const updated: StoredPlugin = {
      manifest: {
        id: cleanId,
        name: draftName.trim() || cleanId,
        version: draftVersion.trim() || '1.0.0',
        author: draftAuthor.trim() || 'Você',
        description: draftDescription.trim() || 'Plugin customizado.',
        icon: draftIcon,
        isBuiltIn: false,
      },
      enabled: true,
      code: draftCode,
      settings: {},
      updatedAt: Date.now(),
    };

    if (editingOriginalId && editingOriginalId !== cleanId) {
      onDeletePlugin(editingOriginalId);
    }
    onSaveCustomPlugin(updated);
    setEditingOriginalId(cleanId);
    onNotify(`Plugin "${updated.manifest.name}" compilado e ativado!`, 'success');
  };

  const handleExportPlugin = (plugin: StoredPlugin) => {
    const payload = JSON.stringify(
      {
        manifest: { ...plugin.manifest, isBuiltIn: false },
        code: plugin.code,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plugin.manifest.id}.orbita-plugin.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as {
        manifest?: Partial<StoredPlugin['manifest']>;
        code?: string;
      };
      if (!parsed || !parsed.manifest?.id || typeof parsed.code !== 'string') {
        onNotify('JSON inválido. Deve conter "manifest.id" e "code".', 'error');
        return;
      }
      const cleanId = String(parsed.manifest.id)
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-');
      const imported: StoredPlugin = {
        manifest: {
          id: cleanId,
          name: parsed.manifest.name || cleanId,
          version: parsed.manifest.version || '1.0.0',
          author: parsed.manifest.author || 'Comunidade',
          description: parsed.manifest.description || 'Extensão importada.',
          icon: parsed.manifest.icon || 'puzzle',
          isBuiltIn: false,
        },
        enabled: true,
        code: parsed.code,
        settings: {},
        updatedAt: Date.now(),
      };
      onSaveCustomPlugin(imported);
      setImportJsonText('');
      setView('list');
      onNotify(`Plugin "${imported.manifest.name}" importado e ativado!`, 'success');
    } catch {
      onNotify('Falha ao ler JSON do plugin.', 'error');
    }
  };

  const currentStudioRuntime = editingOriginalId ? runtimeMap[editingOriginalId] : undefined;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020307]/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-[84vh] flex flex-col rounded-xl border border-[#223050] bg-[#080B14] text-[#ECEFF6] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[#1B253B] bg-[#0A0E19] shrink-0">
          <div className="flex items-center gap-2.5">
            <Puzzle className="w-4 h-4 text-[#E5A93B]" />
            <h2 className="font-display text-base font-semibold tracking-tight">
              Extensões & Estúdio de Plugins
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-[#05070D] border border-[#1B253B] text-xs">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  view === 'list' ? 'bg-[#131C31] text-[#ECEFF6]' : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                Instalados ({plugins.filter((p) => p.enabled).length}/{plugins.length})
              </button>
              <button
                type="button"
                onClick={() => setView('gallery')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  view === 'gallery' ? 'bg-[#131C31] text-[#5CA9E6]' : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                Galeria de Snippets
              </button>
              <button
                type="button"
                onClick={() => setView('studio')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  view === 'studio' ? 'bg-[#131C31] text-[#E5A93B]' : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Estúdio JS (SDK)</span>
              </button>
              <button
                type="button"
                onClick={() => setView('import')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  view === 'import' ? 'bg-[#131C31] text-[#5CA9E6]' : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                }`}
              >
                Importar
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-[#9AA7C4] hover:text-[#ECEFF6] hover:bg-[#121A2E] cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View 1: Installed Plugins */}
        {view === 'list' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[#161F34] bg-[#070A12]">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-[#7B88A6] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar plugins instalados..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#05070D] border border-[#1B253B] text-xs text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none focus:border-[#E5A93B]"
                />
              </div>

              <button
                type="button"
                onClick={() => startNewFromTemplate('command-automation')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E5A93B] text-[#05070D] text-xs font-semibold hover:bg-[#F3BA52] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Novo Plugin</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {filteredPlugins.map((plugin) => {
                const rt = runtimeMap[plugin.manifest.id];
                const hasError = rt?.status === 'error';

                return (
                  <div
                    key={plugin.manifest.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      plugin.enabled
                        ? hasError
                          ? 'border-[#EF4444]/50 bg-[#0B0F1A]'
                          : 'border-[#223050] bg-[#0B0F1A]'
                        : 'border-[#161F34] bg-[#070A12]/70 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                            plugin.enabled
                              ? 'border-[#E5A93B]/35 bg-[#E5A93B]/10 text-[#E5A93B]'
                              : 'border-[#1B253B] bg-[#05070D] text-[#7B88A6]'
                          }`}
                        >
                          <PluginIcon name={plugin.manifest.icon} className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-[#ECEFF6]">
                              {plugin.manifest.name}
                            </span>
                            <span className="font-mono text-[10px] text-[#7B88A6]">
                              v{plugin.manifest.version}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                plugin.manifest.isBuiltIn
                                  ? 'border-[#5CA9E6]/30 bg-[#5CA9E6]/10 text-[#5CA9E6]'
                                  : 'border-[#E5A93B]/30 bg-[#E5A93B]/10 text-[#E5A93B]'
                              }`}
                            >
                              {plugin.manifest.isBuiltIn ? 'Oficial' : 'Customizado'}
                            </span>
                          </div>

                          <p className="text-xs text-[#9AA7C4] leading-relaxed">
                            {plugin.manifest.description}
                          </p>

                          {plugin.enabled && rt && !hasError && (
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-[#7B88A6]">
                              {rt.commandsCount > 0 && <span>{rt.commandsCount} comandos ⌘K</span>}
                              {rt.blocksCount > 0 && <span>{rt.blocksCount} blocos Markdown</span>}
                              {rt.ribbonsCount > 0 && <span>{rt.ribbonsCount} ribbon</span>}
                              {rt.tabsCount > 0 && <span>{rt.tabsCount} aba inspetor</span>}
                            </div>
                          )}

                          {hasError && rt?.error && (
                            <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#EF4444]/10 border border-[#EF4444]/40 text-xs text-[#FCA5A5] font-mono">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{rt.error}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!plugin.manifest.isBuiltIn && (
                          <>
                            <button
                              type="button"
                              onClick={() => openInStudio(plugin)}
                              title="Editar código no Estúdio"
                              className="px-2.5 py-1 rounded-md border border-[#1B253B] bg-[#05070D] text-xs text-[#C2CCE0] hover:text-[#E5A93B] hover:border-[#E5A93B]/50 cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportPlugin(plugin)}
                              title="Exportar plugin (.json)"
                              className="p-1.5 rounded-md border border-[#1B253B] bg-[#05070D] text-[#9AA7C4] hover:text-[#5CA9E6] cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePlugin(plugin.manifest.id)}
                              title="Excluir plugin"
                              className="p-1.5 rounded-md border border-[#1B253B] bg-[#05070D] text-[#9AA7C4] hover:text-[#EF4444] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          role="switch"
                          aria-checked={plugin.enabled}
                          onClick={() => onTogglePlugin(plugin.manifest.id)}
                          className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                            plugin.enabled ? 'bg-[#E5A93B]' : 'bg-[#1B253B]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-[#05070D] transition-transform ${
                              plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View 1.5: 1-Click Snippet Gallery */}
        {view === 'gallery' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-[#161F34] bg-[#070A12] text-xs text-[#9AA7C4]">
              Instale extensões prontas com 1 clique ou abra qualquer snippet no Estúdio JS para personalizar.
            </div>
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {PLUGIN_STARTER_TEMPLATES.map((tpl) => {
                const alreadyInstalled = plugins.some((p) => p.manifest.id === tpl.manifest.id);
                return (
                  <div
                    key={tpl.id}
                    className="rounded-xl border border-[#1B253B] bg-[#0B0F1A] p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg border border-[#5CA9E6]/35 bg-[#5CA9E6]/10 text-[#5CA9E6] flex items-center justify-center shrink-0">
                        <PluginIcon name={tpl.manifest.icon} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-sm text-[#ECEFF6]">
                          {tpl.manifest.name}
                        </div>
                        <p className="text-xs text-[#9AA7C4] leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#161F34] text-xs">
                      <button
                        type="button"
                        onClick={() => startNewFromTemplate(tpl.id)}
                        className="px-2.5 py-1.5 rounded-md border border-[#1B253B] bg-[#05070D] text-[#C2CCE0] hover:text-[#E5A93B] hover:border-[#E5A93B]/50 cursor-pointer"
                      >
                        Personalizar no Estúdio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSaveCustomPlugin({
                            manifest: { ...tpl.manifest, isBuiltIn: false },
                            enabled: true,
                            code: tpl.code,
                            settings: {},
                            updatedAt: Date.now(),
                          });
                          onNotify(`"${tpl.manifest.name}" instalado e ativado!`, 'success');
                        }}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                          alreadyInstalled
                            ? 'bg-[#131C31] text-[#5CA9E6] border border-[#5CA9E6]/40'
                            : 'bg-[#E5A93B] text-[#05070D] hover:bg-[#F3BA52]'
                        }`}
                      >
                        {alreadyInstalled ? 'Reinstalar' : 'Instalar Agora'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View 2: Plugin Code Studio */}
        {view === 'studio' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Template bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-[#161F34] bg-[#070A12] text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[#7B88A6] mr-1">Modelos prontos:</span>
                {PLUGIN_STARTER_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => startNewFromTemplate(tpl.id)}
                    className="px-2.5 py-1 rounded-md border border-[#1B253B] bg-[#0B0F1A] text-[#C2CCE0] hover:text-[#E5A93B] hover:border-[#E5A93B]/50 transition-colors cursor-pointer"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowDocs((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                  showDocs
                    ? 'border-[#5CA9E6]/60 bg-[#5CA9E6]/10 text-[#5CA9E6]'
                    : 'border-[#1B253B] bg-[#0B0F1A] text-[#9AA7C4] hover:text-[#ECEFF6]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Documentação da API</span>
              </button>
            </div>

            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 p-4 gap-3 overflow-y-auto">
                {/* Manifest row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#7B88A6]">Nome do Plugin</label>
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] focus:outline-none focus:border-[#E5A93B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#7B88A6]">ID único</label>
                    <input
                      type="text"
                      value={draftId}
                      onChange={(e) => setDraftId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] font-mono text-[#5CA9E6] focus:outline-none focus:border-[#E5A93B]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#7B88A6]">Ícone</label>
                    <select
                      value={draftIcon}
                      onChange={(e) => setDraftIcon(e.target.value as PluginIconName)}
                      className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] focus:outline-none focus:border-[#E5A93B]"
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#7B88A6]">Versão</label>
                    <input
                      type="text"
                      value={draftVersion}
                      onChange={(e) => setDraftVersion(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] font-mono text-[#ECEFF6] focus:outline-none focus:border-[#E5A93B]"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="text-[11px] text-[#7B88A6]">Descrição</label>
                  <input
                    type="text"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#D7DFEE] focus:outline-none focus:border-[#E5A93B]"
                  />
                </div>

                {/* Code Editor */}
                <div className="flex-1 flex flex-col min-h-[260px] rounded-lg border border-[#1B253B] bg-[#05070D] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#161F34] bg-[#0A0E19] text-[11px] font-mono text-[#7B88A6]">
                    <span className="flex items-center gap-1.5 text-[#C2CCE0]">
                      <FileCode2 className="w-3.5 h-3.5 text-[#E5A93B]" />
                      main.js (JavaScript API estilo Obsidian)
                    </span>
                    {currentStudioRuntime && (
                      <span
                        className={`flex items-center gap-1 ${
                          currentStudioRuntime.status === 'error'
                            ? 'text-[#FCA5A5]'
                            : 'text-[#5CA9E6]'
                        }`}
                      >
                        {currentStudioRuntime.status === 'error' ? (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            {currentStudioRuntime.error}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Ativo
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={draftCode}
                    onChange={(e) => setDraftCode(e.target.value)}
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const el = e.currentTarget;
                        const s = el.selectionStart;
                        const end = el.selectionEnd;
                        const next = draftCode.slice(0, s) + '  ' + draftCode.slice(end);
                        setDraftCode(next);
                        requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
                      }
                    }}
                    className="flex-1 w-full p-3.5 bg-transparent font-mono text-[12.5px] leading-relaxed text-[#D7E0F2] resize-none focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-[#7B88A6]">
                    Salvo localmente no navegador · Recarrega na hora sem perder suas notas.
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveStudio}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E5A93B] text-[#05070D] text-xs font-semibold hover:bg-[#F3BA52] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Salvar e Recarregar Plugin</span>
                  </button>
                </div>
              </div>

              {/* API Docs Drawer */}
              {showDocs && (
                <aside className="w-80 shrink-0 border-l border-[#1B253B] bg-[#060911] p-4 overflow-y-auto text-xs space-y-4">
                  <div className="font-semibold text-[#ECEFF6]">API do Órbita (`api`)</div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#E5A93B]">api.addCommand(&#123; id, name, callback &#125;)</div>
                    <p className="text-[#9AA7C4]">Registra comando na Paleta (Ctrl/Cmd + K).</p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#E5A93B]">api.addRibbonIcon(&#123; icon, title, onClick &#125;)</div>
                    <p className="text-[#9AA7C4]">Adiciona ícone na barra vertical esquerda.</p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#E5A93B]">
                      api.registerMarkdownCodeBlockProcessor(lang, (src, el, ctx) =&gt; ...)
                    </div>
                    <p className="text-[#9AA7C4]">
                      Transforma blocos <code className="text-[#5CA9E6]">```lang</code> na leitura em cards/gráficos HTML.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#E5A93B]">
                      api.addSidebarTab(&#123; id, title, icon, render(el, ctx) &#125;)
                    </div>
                    <p className="text-[#9AA7C4]">Cria uma nova aba no inspetor direito.</p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#E5A93B]">
                      api.addStatusBarItem(&#123; id, text, title, tone, onClick &#125;)
                    </div>
                    <p className="text-[#9AA7C4]">Adiciona indicador clicável na barra de status inferior.</p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#5CA9E6]">api.vault.*</div>
                    <p className="text-[#9AA7C4] font-mono text-[11px] leading-relaxed">
                      getNotes(), getFolders(), getActiveNote(), openNote(id), openOrCreateWikilink(title),
                      createNote(&#123;title, content&#125;), updateNote(id, patch), appendToActiveNote(txt)
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#5CA9E6]">api.cosmos.*</div>
                    <p className="text-[#9AA7C4] font-mono text-[11px] leading-relaxed">
                      getSettings(), updateSettings(patch), focusNote(id)
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[#5CA9E6]">api.storage & api.on</div>
                    <p className="text-[#9AA7C4] font-mono text-[11px] leading-relaxed">
                      storage.load() / storage.save(obj) · api.on('note:open' | 'note:create' | 'note:change', fn) ·
                      api.notice(msg, 'info' | 'success' | 'error')
                    </p>
                  </div>
                </aside>
              )}
            </div>
          </div>
        )}

        {/* View 3: Import JSON */}
        {view === 'import' && (
          <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto text-xs">
            <div className="rounded-xl border border-dashed border-[#243456] bg-[#0B0F1A] p-6 flex flex-col items-center justify-center text-center gap-3">
              <Upload className="w-7 h-7 text-[#5CA9E6]" />
              <div>
                <div className="text-sm font-semibold text-[#ECEFF6]">
                  Importar arquivo `.orbita-plugin.json`
                </div>
                <p className="text-[#9AA7C4] mt-1">
                  Compartilhe ou carregue extensões exportadas com manifesto e código JS.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  handleImportJson(text);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-[#131C31] border border-[#243456] text-[#ECEFF6] hover:border-[#E5A93B] cursor-pointer"
              >
                Selecionar arquivo .json
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <label className="text-[#9AA7C4] font-medium">
                Ou cole o JSON do plugin abaixo:
              </label>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder={'{\n  "manifest": { "id": "meu-plugin", "name": "Meu Plugin" },\n  "code": "class MeuPlugin { onload(api) { ... } }"\n}'}
                className="flex-1 min-h-[180px] p-3 rounded-lg bg-[#05070D] border border-[#1B253B] font-mono text-xs text-[#D7E0F2] focus:outline-none focus:border-[#E5A93B]"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleImportJson(importJsonText)}
                  disabled={!importJsonText.trim()}
                  className="px-4 py-2 rounded-lg bg-[#E5A93B] text-[#05070D] font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Instalar e Ativar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
