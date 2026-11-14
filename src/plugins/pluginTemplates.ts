import { PluginManifest, StoredPlugin } from '../types/plugins';

export interface PluginStarterTemplate {
  id: string;
  label: string;
  description: string;
  manifest: Omit<PluginManifest, 'isBuiltIn'>;
  code: string;
}

export const PLUGIN_STARTER_TEMPLATES: PluginStarterTemplate[] = [
  {
    id: 'command-automation',
    label: 'Comando & Automação no Vault',
    description: 'Adiciona um botão no Ribbon lateral e um comando na paleta Ctrl+K.',
    manifest: {
      id: 'meu-resumo-diario',
      name: 'Gerador de Checkpoint',
      version: '1.0.0',
      author: 'Você',
      description: 'Insere um bloco de checkpoint datado na nota ativa via paleta ou ribbon.',
      icon: 'zap',
    },
    code: `// Todo plugin recebe o objeto "api" no método onload(api)
class MeuPlugin {
  onload(api) {
    const inserirCheckpoint = () => {
      const nota = api.vault.getActiveNote();
      if (!nota) {
        api.notice('Abra uma nota primeiro.', 'error');
        return;
      }
      const agora = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      api.vault.appendToActiveNote(
        '\\n\\n> [!info] Checkpoint ' + agora + '\\n> - [ ] Próximo passo definido'
      );
      api.notice('Checkpoint inserido em "' + nota.title + '"!', 'success');
    };

    // 1. Registra comando na paleta Ctrl/Cmd + K
    api.addCommand({
      id: 'inserir-checkpoint',
      name: 'Inserir Checkpoint com horário na nota atual',
      hint: 'Meu Plugin',
      callback: inserirCheckpoint,
    });

    // 2. Adiciona ícone na barra vertical (Ribbon)
    api.addRibbonIcon({
      id: 'ribbon-checkpoint',
      icon: 'zap',
      title: 'Inserir Checkpoint',
      onClick: inserirCheckpoint,
    });
  }

  onunload() {
    // Limpeza opcional ao desativar
  }
}
`,
  },
  {
    id: 'markdown-block',
    label: 'Bloco Markdown Customizado',
    description: 'Cria um novo bloco ```progresso``` que renderiza barras visuais na leitura.',
    manifest: {
      id: 'bloco-progresso',
      name: 'Blocos de Progresso',
      version: '1.0.0',
      author: 'Você',
      description: 'Renderiza blocos ```progresso com barras visuais e porcentagens.',
      icon: 'sparkles',
    },
    code: `class BlocoProgressoPlugin {
  onload(api) {
    // Use \`\`\`progresso dentro de qualquer nota para testar!
    // Exemplo de linhas:
    // Órbita: 80
    // Pesquisa: 45
    api.registerMarkdownCodeBlockProcessor('progresso', (source, el) => {
      const linhas = source
        .split('\\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const wrapper = document.createElement('div');
      wrapper.style.cssText =
        'padding:12px 14px;border-radius:10px;border:1px solid #1B253B;background:#0B0F1A;display:flex;flex-direction:column;gap:10px;';

      if (linhas.length === 0) {
        wrapper.innerHTML = '<div style="color:#7B88A6;font-size:12px;">Escreva linhas como "Meta: 75" dentro do bloco.</div>';
      }

      linhas.forEach((linha) => {
        const partes = linha.split(':');
        const titulo = (partes[0] || 'Item').trim();
        const valor = Math.max(0, Math.min(100, Number((partes[1] || '0').replace('%', '').trim()) || 0));

        const row = document.createElement('div');
        row.innerHTML =
          '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">' +
          '<span style="color:#ECEFF6;font-weight:500;">' + titulo + '</span>' +
          '<span style="color:#E5A93B;font-family:monospace;">' + valor + '%</span>' +
          '</div>' +
          '<div style="height:6px;border-radius:999px;background:#05070D;overflow:hidden;border:1px solid #182238;">' +
          '<div style="height:100%;width:' + valor + '%;background:linear-gradient(90deg,#5CA9E6,#E5A93B);"></div>' +
          '</div>';
        wrapper.appendChild(row);
      });

      el.appendChild(wrapper);
    });

    api.addCommand({
      id: 'inserir-bloco-progresso',
      name: 'Inserir exemplo de bloco \`\`\`progresso',
      callback: () => {
        api.vault.appendToActiveNote('\\n\\n\`\`\`progresso\\nArquitetura: 90\\nEscrita: 55\\nRevisão: 30\\n\`\`\`');
        api.notice('Bloco de progresso inserido! Veja no modo Leitura ou Dividido.', 'success');
      },
    });
  }
}
`,
  },
  {
    id: 'sidebar-inspector',
    label: 'Aba no Inspetor Direito',
    description: 'Adiciona uma nova aba personalizada na barra lateral direita.',
    manifest: {
      id: 'aba-radar-conexoes',
      name: 'Radar de Links',
      version: '1.0.0',
      author: 'Você',
      description: 'Adiciona uma aba "Radar" no inspetor direito sugerindo notas por tags em comum.',
      icon: 'compass',
    },
    code: `class RadarConexoesPlugin {
  onload(api) {
    api.addSidebarTab({
      id: 'radar',
      title: 'Radar',
      icon: 'compass',
      render: (el, ctx) => {
        const ativa = ctx.activeNote;
        if (!ativa) {
          el.innerHTML = '<p style="color:#7B88A6;font-size:12px;">Abra uma nota para ver sugestões.</p>';
          return;
        }

        const tagsAtivas = new Set(ativa.tags || []);
        const similares = ctx.notes
          .filter((n) => n.id !== ativa.id)
          .map((n) => {
            const comuns = (n.tags || []).filter((t) => tagsAtivas.has(t));
            return { nota: n, comuns };
          })
          .filter((item) => item.comuns.length > 0)
          .sort((a, b) => b.comuns.length - a.comuns.length)
          .slice(0, 6);

        const titulo = document.createElement('div');
        titulo.style.cssText = 'font-size:12px;font-weight:600;color:#ECEFF6;margin-bottom:10px;';
        titulo.textContent = 'Planetas com tags em comum';
        el.appendChild(titulo);

        if (similares.length === 0) {
          const vazio = document.createElement('p');
          vazio.style.cssText = 'color:#7B88A6;font-size:12px;line-height:1.5;';
          vazio.textContent = 'Adicione #tags compartilhadas para descobrir conexões gravitacionais.';
          el.appendChild(vazio);
          return;
        }

        similares.forEach(({ nota, comuns }) => {
          const btn = document.createElement('button');
          btn.style.cssText =
            'width:100%;text-align:left;padding:8px 10px;margin-bottom:6px;border-radius:8px;border:1px solid #182238;background:#0B0F1A;color:#ECEFF6;cursor:pointer;display:block;';
          btn.innerHTML =
            '<div style="font-size:12px;font-weight:500;color:#5CA9E6;">' + nota.title + '</div>' +
            '<div style="font-size:11px;color:#E5A93B;margin-top:2px;">#' + comuns.join(' #') + '</div>';
          btn.onclick = () => ctx.openNote(nota.id);
          el.appendChild(btn);
        });
      },
    });
  }
}
`,
  },
  {
    id: 'daily-word-goal',
    label: 'Meta Diária na Barra de Status',
    description: 'Mostra o progresso da sua meta de palavras do cofre direto na barra inferior.',
    manifest: {
      id: 'meta-escrita-diaria',
      name: 'Meta de Escrita Orbital',
      version: '1.0.0',
      author: 'Comunidade Órbita',
      description: 'Adiciona um contador de meta de palavras na Barra de Status inferior e comando de ajuste.',
      icon: 'wand',
    },
    code: `class MetaEscritaPlugin {
  onload(api) {
    const saved = api.storage.load() || {};
    const meta = Number(saved.meta) || 1500;
    const notas = api.vault.getNotes();
    let total = 0;
    notas.forEach((n) => {
      const palavras = (n.content || '').trim().split(/\\s+/).filter(Boolean).length;
      total += palavras;
    });
    const pct = Math.min(100, Math.round((total / meta) * 100));

    api.addStatusBarItem({
      id: 'meta-status',
      text: 'Meta: ' + total + '/' + meta + ' pal. (' + pct + '%)',
      title: 'Clique para definir nova meta de palavras',
      tone: pct >= 100 ? 'amber' : 'blue',
      onClick: () => {
        const nova = meta === 1500 ? 3000 : meta === 3000 ? 5000 : 1500;
        api.storage.save({ meta: nova });
        api.notice('Meta atualizada para ' + nova + ' palavras!', 'success');
      },
    });
  }
}
`,
  },
  {
    id: 'habit-tracker',
    label: 'Rastreador de Hábitos (```habitos)',
    description: 'Renderiza blocos ```habitos com círculos de sequência visual e progresso diário.',
    manifest: {
      id: 'rastreador-habitos',
      name: 'Rastreador de Hábitos',
      version: '1.0.0',
      author: 'Comunidade Órbita',
      description: 'Transforma blocos ```habitos em painéis visuais de consistência e streaks.',
      icon: 'sparkles',
    },
    code: `class RastreadorHabitosPlugin {
  onload(api) {
    api.registerMarkdownCodeBlockProcessor('habitos', (source, el) => {
      const lines = source.split('\\n').map((l) => l.trim()).filter(Boolean);
      const box = document.createElement('div');
      box.style.cssText = 'padding:12px 14px;border-radius:10px;border:1px solid #1B253B;background:#070B14;display:flex;flex-direction:column;gap:8px;';

      if (lines.length === 0) {
        box.innerHTML = '<div style="color:#7B88A6;font-size:12px;">Use: Meditar | 1 1 0 1 1 1 1</div>';
      }

      lines.forEach((line) => {
        const parts = line.split('|');
        const nome = (parts[0] || 'Hábito').trim();
        const dias = (parts[1] || '1 1 0 1').trim().split(/\\s+/);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;';
        const dots = dias.map((d) => {
          const ok = d === '1' || d.toLowerCase() === 'x' || d === '✓';
          return '<span style="width:14px;height:14px;border-radius:4px;display:inline-block;border:1px solid ' +
            (ok ? '#E5A93B' : '#243456') + ';background:' + (ok ? '#E5A93B' : '#05070D') + ';"></span>';
        }).join('');
        row.innerHTML = '<span style="color:#ECEFF6;font-weight:500;">' + nome + '</span>' +
          '<div style="display:flex;gap:4px;align-items:center;">' + dots + '</div>';
        box.appendChild(row);
      });
      el.appendChild(box);
    });

    api.addCommand({
      id: 'inserir-habitos',
      name: 'Hábitos: Inserir bloco \`\`\`habitos na nota atual',
      callback: () => {
        api.vault.appendToActiveNote('\\n\\n\`\`\`habitos\\nLeitura Profunda | 1 1 1 0 1 1 1\\nRevisão Zettelkasten | 1 0 1 1 1 1 0\\n\`\`\`');
        api.notice('Bloco de hábitos inserido!', 'success');
      },
    });
  }
}
`,
  },
  {
    id: 'toc-generator',
    label: 'Gerador de Sumário (TOC)',
    description: 'Lê todos os títulos #, ##, ### da nota ativa e insere um sumário estruturado.',
    manifest: {
      id: 'gerador-sumario-toc',
      name: 'Gerador de Sumário',
      version: '1.0.0',
      author: 'Comunidade Órbita',
      description: 'Gera um índice automático a partir dos títulos da nota atual via Ctrl+K ou Ribbon.',
      icon: 'file-text',
    },
    code: `class GeradorSumarioPlugin {
  onload(api) {
    const gerarSumario = () => {
      const nota = api.vault.getActiveNote();
      if (!nota) {
        api.notice('Abra uma nota para gerar o sumário.', 'error');
        return;
      }
      const linhas = nota.content.split('\\n');
      const itens = [];
      linhas.forEach((l) => {
        const m = /^(#{1,3})\\s+(.+)$/.exec(l.trim());
        if (m) {
          const recuo = '  '.repeat(m[1].length - 1);
          itens.push(recuo + '- ' + m[2].trim());
        }
      });
      if (itens.length === 0) {
        api.notice('Nenhum título (# ou ##) encontrado na nota.', 'info');
        return;
      }
      api.vault.appendToActiveNote('\\n\\n## Sumário\\n' + itens.join('\\n'));
      api.notice('Sumário com ' + itens.length + ' títulos inserido!', 'success');
    };

    api.addCommand({
      id: 'gerar-toc',
      name: 'Sumário: Gerar índice dos títulos na nota ativa',
      callback: gerarSumario,
    });
    api.addRibbonIcon({
      id: 'ribbon-toc',
      icon: 'file-text',
      title: 'Gerar Sumário (TOC)',
      onClick: gerarSumario,
    });
  }
}
`,
  },
];

export const BUILTIN_PLUGINS_DEFAULT: StoredPlugin[] = [
  {
    manifest: {
      id: 'dataview-cosmos',
      name: 'Dataview Cósmico',
      version: '1.2.0',
      author: 'Órbita Core',
      description:
        'Renderiza blocos ```dataview / ```orbita-query como tabelas e listas dinâmicas filtradas por tags, estágio e ordenação.',
      icon: 'table',
      isBuiltIn: true,
    },
    enabled: true,
    code: '// Plugin oficial integrado — suporta queries TABLE/LIST, FROM, WHERE, SORT e LIMIT em blocos ```dataview.',
    settings: {},
    updatedAt: Date.now(),
  },
  {
    manifest: {
      id: 'kanban-orbital',
      name: 'Quadro Kanban',
      version: '1.1.0',
      author: 'Órbita Core',
      description:
        'Transforma blocos ```kanban com colunas ## e tarefas - [ ] em quadros visuais interativos dentro das notas.',
      icon: 'kanban',
      isBuiltIn: true,
    },
    enabled: true,
    code: '// Plugin oficial integrado — suporta mover cartões entre colunas e marcar tarefas diretamente no Markdown.',
    settings: {},
    updatedAt: Date.now(),
  },
  {
    manifest: {
      id: 'templates-core',
      name: 'Templates Zettelkasten',
      version: '1.0.0',
      author: 'Órbita Core',
      description:
        'Adiciona comandos na paleta Ctrl+K e botão rápido no Ribbon para inserir estruturas Zettelkasten e fichas de pesquisa.',
      icon: 'file-text',
      isBuiltIn: true,
    },
    enabled: true,
    code: '// Plugin oficial integrado — insere templates estruturados na nota ativa.',
    settings: {},
    updatedAt: Date.now(),
  },
  {
    manifest: {
      id: 'pomodoro-orbital',
      name: 'Foco Pomodoro',
      version: '1.0.0',
      author: 'Órbita Core',
      description:
        'Cronômetro discreto de ciclos 25m/5m acessível pelo Ribbon ou paleta de comandos para sessões de escrita profunda.',
      icon: 'clock',
      isBuiltIn: true,
    },
    enabled: true,
    code: '// Plugin oficial integrado — cronômetro de foco orbital no topo da janela.',
    settings: {},
    updatedAt: Date.now(),
  },
  {
    manifest: {
      id: 'vault-analytics',
      name: 'Telemetria do Vault',
      version: '1.0.0',
      author: 'Órbita Core',
      description:
        'Adiciona uma aba "Métricas" no inspetor direito com distribuição de maturidade, hubs mais conectados e progresso de tarefas.',
      icon: 'bar-chart',
      isBuiltIn: true,
    },
    enabled: true,
    code: '// Plugin oficial integrado — painel analítico em tempo real no inspetor direito.',
    settings: {},
    updatedAt: Date.now(),
  },
  {
    manifest: {
      id: 'flashcards-orbital',
      name: 'Flashcards & Revisão Espaçada',
      version: '1.0.0',
      author: 'Órbita Core',
      description:
        'Lê cartões Pergunta :: Resposta nas suas notas e agenda revisões espaçadas (SM-2) com aba "Revisão" e modal de estudo.',
      icon: 'layers',
      isBuiltIn: true,
    },
    enabled: true,
    code: '// Plugin oficial integrado — repetição espaçada SM-2 a partir de linhas Pergunta :: Resposta.',
    settings: {},
    updatedAt: Date.now(),
  },
];
