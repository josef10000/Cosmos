import React from 'react';
import { CalendarDays, Command, Puzzle } from 'lucide-react';
import { PluginIcon } from '../plugins/pluginIcons';
import { PluginRibbonItem } from '../types/plugins';

interface PluginRibbonProps {
  ribbons: PluginRibbonItem[];
  activePluginsCount: number;
  onOpenDailyNote: () => void;
  onOpenCommandPalette: () => void;
  onOpenPlugins: () => void;
}

export const PluginRibbon: React.FC<PluginRibbonProps> = ({
  ribbons,
  activePluginsCount,
  onOpenDailyNote,
  onOpenCommandPalette,
  onOpenPlugins,
}) => {
  return (
    <nav
      aria-label="Ribbon de ferramentas e plugins"
      className="w-10 shrink-0 h-full flex flex-col items-center py-2.5 gap-1.5 bg-[#060911] border-r border-[#1B253B] select-none transition-all duration-200"
    >
      <button
        type="button"
        onClick={onOpenDailyNote}
        title="Diário de Bordo de Hoje"
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#9AA7C4] hover:text-[#E5A93B] hover:bg-[#121A2E] transition-colors cursor-pointer shrink-0"
      >
        <CalendarDays className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onOpenCommandPalette}
        title="Paleta de Comandos (Ctrl+K)"
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#9AA7C4] hover:text-[#5CA9E6] hover:bg-[#121A2E] transition-colors cursor-pointer shrink-0"
      >
        <Command className="w-4 h-4" />
      </button>

      {ribbons.length > 0 && (
        <div className="w-5 h-px bg-[#1B253B] my-0.5 shrink-0" />
      )}

      {ribbons.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          title={item.title}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#9AA7C4] hover:text-[#E5A93B] hover:bg-[#121A2E] transition-all duration-150 cursor-pointer shrink-0"
        >
          <PluginIcon name={item.icon} className="w-4 h-4" />
        </button>
      ))}

      <div className="w-5 h-px bg-[#1B253B] my-0.5 shrink-0" />

      <button
        type="button"
        onClick={onOpenPlugins}
        title={`Extensões e Estúdio de Plugins (${activePluginsCount} ativos)`}
        className="relative w-7 h-7 rounded-md flex items-center justify-center text-[#9AA7C4] hover:text-[#E5A93B] hover:bg-[#121A2E] transition-all duration-150 cursor-pointer shrink-0"
      >
        <Puzzle className="w-4 h-4" />
        {activePluginsCount > 0 && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#E5A93B]" />
        )}
      </button>
    </nav>
  );
};
