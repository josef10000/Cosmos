import React from 'react';
import { PluginStatusBarItem } from '../types/plugins';

interface StatusBarProps {
  wordCount: number;
  charCount: number;
  readingMinutes: number;
  totalNotes: number;
  totalLinks: number;
  activeWorkspaceName: string;
  pluginItems: PluginStatusBarItem[];
  onOpenWorkspaces: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  wordCount,
  charCount,
  readingMinutes,
  totalNotes,
  totalLinks,
  activeWorkspaceName,
  pluginItems,
  onOpenWorkspaces,
}) => {
  return (
    <footer
      aria-label="Barra de status do Órbita"
      className="h-6.5 shrink-0 px-3 border-t border-[#161F34] bg-[#05070D] flex items-center justify-between gap-3 text-[11px] text-[#7B88A6] select-none overflow-x-auto"
    >
      <div className="flex items-center gap-3 shrink-0 tabular-nums">
        <button
          type="button"
          onClick={onOpenWorkspaces}
          title="Trocar ou salvar Workspace"
          className="text-[#9AA7C4] hover:text-[#E5A93B] transition-colors cursor-pointer font-medium"
        >
          Layout: {activeWorkspaceName}
        </button>
        <span className="text-[#243456]" aria-hidden="true">
          |
        </span>
        <span>
          {totalNotes} corpos · {totalLinks} pontes
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
        {pluginItems.map((item) => {
          const toneClass =
            item.tone === 'amber'
              ? 'text-[#E5A93B] hover:text-[#FBE6B2]'
              : item.tone === 'blue'
                ? 'text-[#5CA9E6] hover:text-[#BAE6FD]'
                : 'text-[#9AA7C4] hover:text-[#ECEFF6]';

          if (item.onClick) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                title={item.title}
                className={`px-1.5 py-0.5 rounded hover:bg-[#11192D] transition-colors cursor-pointer whitespace-nowrap ${toneClass}`}
              >
                {item.text}
              </button>
            );
          }

          return (
            <span key={item.id} title={item.title} className={`whitespace-nowrap ${toneClass}`}>
              {item.text}
            </span>
          );
        })}

        {pluginItems.length > 0 && (
          <span className="text-[#243456]" aria-hidden="true">
            |
          </span>
        )}

        <span className="font-mono text-[10.5px] text-[#9AA7C4] whitespace-nowrap">
          {wordCount} palavras · {charCount} car. · {readingMinutes} min
        </span>
      </div>
    </footer>
  );
};
