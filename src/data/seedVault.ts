import { VaultData } from '../types/vault';

const now = Date.now();
const day = 86400000;

export const SEED_VAULT: VaultData = {
  folders: [
    {
      id: 'star-ideias',
      name: 'Mecânica de Ideias',
      parentId: null,
      color: '#E5A93B',
      starClass: 'solar',
      isExpanded: true,
      createdAt: now - 12 * day,
    },
    {
      id: 'planet-zettelkasten',
      name: 'Método Zettelkasten',
      parentId: 'star-ideias',
      color: '#5CA9E6',
      isExpanded: true,
      createdAt: now - 10 * day,
    },
    {
      id: 'star-fisica',
      name: 'Astrofísica & Sistemas',
      parentId: null,
      color: '#5CA9E6',
      starClass: 'blue-giant',
      isExpanded: true,
      createdAt: now - 9 * day,
    },
    {
      id: 'star-projetos',
      name: 'Observatório & Design',
      parentId: null,
      color: '#93C5FD',
      starClass: 'binary',
      isExpanded: true,
      createdAt: now - 7 * day,
    },
    {
      id: 'star-diario',
      name: 'Diário de Bordo',
      parentId: null,
      color: '#D99B26',
      starClass: 'solar',
      isExpanded: false,
      createdAt: now - 5 * day,
    },
  ],
  notes: [
    {
      id: 'note-mapa-cosmico',
      title: 'Mapa Cósmico',
      folderId: 'star-ideias',
      parentNoteId: null,
      maturity: 'star',
      tags: ['sistema', 'obsidian', 'cosmos'],
      aliases: ['Início', 'Índice Geral'],
      pinned: true,
      createdAt: now - 12 * day,
      updatedAt: now - 1 * day,
      content: `# Bem-vindo ao Órbita

Este espaço une o fluxo de notas em Markdown do **Obsidian** com um **mapa espacial gravitacional**:

- **Estrelas** são as pastas principais: quanto mais notas e ligações acumulam, maior é a sua massa e mais fundo elas curvam a malha do espaço-tempo.
- **Planetas** são suas notas orbitando ao redor de cada estrela.
- **Luas** são subnotas que giram diretamente ao redor de um planeta-mãe.
- **Pontes Gravitacionais** são os \`[[wikilinks]]\` que atraem ideias relacionadas e conectam sistemas estelares inteiros.

> [!tip] Experimente a Gravidade e o Zoom Infinito
> Use o scroll do mouse no mapa ao lado para afastar até o universo inteiro virar um único ponto luminoso — depois mergulhe na órbita de um planeta para ler seu texto diretamente no espaço.

## Pontos de partida

1. Entenda como links criam atração mútua em [[Campo Gravitacional]].
2. Veja como ideias distantes formam atalhos em [[Pontes de Einstein-Rosen]].
3. Confira o projeto visual em [[Carta Astronômica Minimalista]].

- [x] Estruturar sistemas estelares principais
- [x] Conectar ideias com \`[[wikilinks]]\`
- [ ] Registrar novas observações no [[Diário de Hoje]]

#cosmos #conhecimento`,
    },
    {
      id: 'note-campo-gravitacional',
      title: 'Campo Gravitacional',
      folderId: 'star-ideias',
      parentNoteId: null,
      maturity: 'star',
      tags: ['cognição', 'gravidade'],
      aliases: ['Grafo Gravitacional'],
      createdAt: now - 11 * day,
      updatedAt: now - 2 * day,
      content: `# Campo Gravitacional de Ideias

Pastas estáticas isolam arquivos em caixas fechadas. Num campo gravitacional, cada link \`[[...]]\` exerce **atração mútua**, aproximando conceitos afins mesmo quando pertencem a estrelas diferentes — como [[Curvatura do Espaço-Tempo]] conversando com [[Carta Astronômica Minimalista]].

## Princípios orbitais

- **Massa conceitual:** notas muito referenciadas ganham mais massa, atraindo satélites e curvando órbitas próximas, como descrito em [[Notas Atômicas]].
- **Velocidade orbital:** ideias jovens (nebulosas) giram rápido na periferia; referências maduras (estrelas douradas) estabilizam o centro em [[Ciclo Estelar]].

\`\`\`markdown
[[Conceito A]] <=== atração mútua ===> [[Conceito B]]
\`\`\`

#cognição #sistema`,
    },
    {
      id: 'note-notas-atomicas',
      title: 'Notas Atômicas',
      folderId: 'planet-zettelkasten',
      parentNoteId: null,
      maturity: 'planet',
      tags: ['zettelkasten', 'escrita'],
      aliases: [],
      createdAt: now - 10 * day,
      updatedAt: now - 3 * day,
      content: `# Notas Atômicas

Uma nota atômica encapsula **um único conceito completo** para que possa entrar em órbita de múltiplos sistemas sem perder clareza.

## Leis de formação

1. O título resume a ideia central do planeta.
2. Evite aglomerados gigantes; divida detalhes em **luas (subnotas)** ou novas notas ligadas por \`[[...]]\`.
3. Conecte toda nota recém-criada a pelo menos um corpo existente como [[Campo Gravitacional]].

#zettelkasten #escrita`,
    },
    {
      id: 'note-subnota-luas',
      title: 'Como nomear planetas',
      folderId: 'planet-zettelkasten',
      parentNoteId: 'note-notas-atomicas',
      maturity: 'nebula',
      tags: ['escrita'],
      aliases: [],
      createdAt: now - 9 * day,
      updatedAt: now - 3 * day,
      content: `# Como nomear planetas

Títulos claros funcionam como coordenadas estelares quando você digita \`[[\` no editor.

- Prefira nomes diretos como [[Notas Atômicas]] ou [[Pontes de Einstein-Rosen]].
- Evite nomes genéricos como "Rascunho 1" ou "Diversos".

#escrita`,
    },
    {
      id: 'note-ciclo-estelar',
      title: 'Ciclo Estelar',
      folderId: 'planet-zettelkasten',
      parentNoteId: null,
      maturity: 'planet',
      tags: ['cosmos', 'hábito'],
      aliases: ['Maturidade'],
      createdAt: now - 8 * day,
      updatedAt: now - 1 * day,
      content: `# Ciclo Estelar das Notas

Em vez de ordenar notas só por data, classificamos cada corpo pelo seu estágio evolutivo:

| Estágio | Corpo | Significado |
| --- | --- | --- |
| Nebulosa | Ciano difuso | Ideia recém-capturada, ainda em formação |
| Planeta | Azul estelar | Conceito estruturado em órbita estável |
| Estrela | Ouro solar | Nota madura, densa e altamente conectada |

Veja também [[Mapa Cósmico]] e [[Observatório]].

#cosmos #hábito`,
    },
    {
      id: 'note-pontes-einstein',
      title: 'Pontes de Einstein-Rosen',
      folderId: 'star-fisica',
      parentNoteId: null,
      maturity: 'star',
      tags: ['física', 'sistemas'],
      aliases: ['Buracos de Minhoca'],
      createdAt: now - 9 * day,
      updatedAt: now - 2 * day,
      content: `# Pontes de Einstein-Rosen

Na relatividade geral, pontes conectam regiões distantes do espaço-tempo através de atalhos geométricos.

> "A gravidade diz ao espaço como se curvar; o espaço diz à matéria como se mover."

No [[Campo Gravitacional]], cada \`[[wikilink]]\` entre estrelas diferentes traça uma ponte dourada ligando sistemas distantes.

Relacionado: [[Curvatura do Espaço-Tempo]] e [[Leis de Kepler]].

#física #sistemas`,
    },
    {
      id: 'note-curvatura',
      title: 'Curvatura do Espaço-Tempo',
      folderId: 'star-fisica',
      parentNoteId: null,
      maturity: 'planet',
      tags: ['física', 'design'],
      aliases: [],
      createdAt: now - 8 * day,
      updatedAt: now - 4 * day,
      content: `# Curvatura do Espaço-Tempo

Massas concentradas deformam a geometria ao redor. No mapa ao lado, a malha de fundo se curva em direção às estrelas mais densas.

- A dinâmica orbital segue [[Leis de Kepler]].
- A representação visual inspira [[Carta Astronômica Minimalista]].

#física #design`,
    },
    {
      id: 'note-kepler',
      title: 'Leis de Kepler',
      folderId: 'star-fisica',
      parentNoteId: 'note-curvatura',
      maturity: 'nebula',
      tags: ['geometria', 'física'],
      aliases: [],
      createdAt: now - 7 * day,
      updatedAt: now - 4 * day,
      content: `# Leis de Kepler

Planetas mais próximos da estrela completam sua órbita mais rápido do que planetas distantes.

Na simulação 2D do **Órbita**, cada planeta e cada lua segue essa proporção angular — e você pode pausar ou acelerar o tempo a qualquer momento.

#geometria #física`,
    },
    {
      id: 'note-carta-astronomica',
      title: 'Carta Astronômica Minimalista',
      folderId: 'star-projetos',
      parentNoteId: null,
      maturity: 'planet',
      tags: ['design', 'interface'],
      aliases: [],
      createdAt: now - 7 * day,
      updatedAt: now - 1 * day,
      content: `# Carta Astronômica Minimalista

A paleta **Obsidiana Cósmica + Ouro Solar + Azul Estelar** combina conforto noturno com leitura nítida:

- **Preto abissal do espaço** para foco total na escrita e nos anéis orbitais.
- **Azul estelar** para órbitas, planetas e conexões dentro do mesmo sistema.
- **Ouro solar** para estrelas centrais, pontes entre galáxias e notas maduras.

## Experimentos ativos

- [x] Simulação orbital com velocidade kepleriana
- [x] Malha de espaço-tempo curvando ao redor das estrelas
- [x] Painéis laterais arrastáveis e modo tela cheia
- [ ] Expandir anotações no [[Observatório]]

Inspirado por [[Curvatura do Espaço-Tempo]] e [[Mapa Cósmico]].

#design #interface`,
    },
    {
      id: 'note-observatorio',
      title: 'Observatório',
      folderId: 'star-projetos',
      parentNoteId: null,
      maturity: 'nebula',
      tags: ['pesquisa', 'hábito'],
      aliases: [],
      createdAt: now - 6 * day,
      updatedAt: now - 2 * day,
      content: `# Observatório

Espaço para registrar novas hipóteses antes de integrá-las a um sistema ou convertê-las em [[Notas Atômicas]].

- Registros diários no [[Diário de Hoje]]
- Revisão de maturidade no [[Ciclo Estelar]]

#pesquisa #hábito`,
    },
    {
      id: 'note-asteroide',
      title: 'Asteroide Errante: Escala Cósmica',
      folderId: null,
      parentNoteId: null,
      maturity: 'nebula',
      tags: ['geometria'],
      aliases: [],
      createdAt: now - 3 * day,
      updatedAt: now - 3 * day,
      content: `# Asteroide Errante: Escala Cósmica

Esta nota ainda não orbita nenhuma estrela nem possui \`[[wikilinks]]\`. No mapa cósmico, ela vaga como um **asteroide solitário** esperando ser capturado pela gravidade de uma ideia!

#geometria`,
    },
    {
      id: 'note-diario-hoje',
      title: 'Diário de Hoje',
      folderId: 'star-diario',
      parentNoteId: null,
      maturity: 'planet',
      tags: ['diário'],
      aliases: [],
      isDaily: true,
      createdAt: now - 1 * day,
      updatedAt: now,
      content: `# Diário de Hoje

## Missão do dia
- Revisar pontes gravitacionais entre [[Campo Gravitacional]] e [[Pontes de Einstein-Rosen]].
- Testar o zoom contínuo no [[Mapa Cósmico]] até o universo virar um pontinho.

## Diário de bordo
Quando pauso as órbitas ou aproximo na superfície de um planeta, o texto da nota aparece diretamente na órbita.

#diário`,
    },
  ],
  openTabIds: ['note-mapa-cosmico', 'note-campo-gravitacional', 'note-carta-astronomica'],
  activeNoteId: 'note-mapa-cosmico',
};
