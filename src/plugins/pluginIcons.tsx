import React from 'react';
import {
  BarChart3,
  Clock,
  Compass,
  FileText,
  Kanban,
  Layers,
  Orbit,
  Puzzle,
  Sparkles,
  Table2,
  Terminal,
  Wand2,
  Zap,
} from 'lucide-react';
import { PluginIconName } from '../types/plugins';

export const PluginIcon: React.FC<{ name?: PluginIconName; className?: string }> = ({
  name = 'puzzle',
  className = 'w-4 h-4',
}) => {
  switch (name) {
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'table':
      return <Table2 className={className} />;
    case 'kanban':
      return <Kanban className={className} />;
    case 'clock':
      return <Clock className={className} />;
    case 'bar-chart':
      return <BarChart3 className={className} />;
    case 'file-text':
      return <FileText className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'terminal':
      return <Terminal className={className} />;
    case 'orbit':
      return <Orbit className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'wand':
      return <Wand2 className={className} />;
    case 'puzzle':
    default:
      return <Puzzle className={className} />;
  }
};
