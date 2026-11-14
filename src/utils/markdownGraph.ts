import { Folder, Note } from '../types/vault';
import { parseFrontmatter } from './frontmatter';

export interface ParsedWikilink {
  raw: string;
  target: string;
  alias?: string;
}

export interface BacklinkMatch {
  sourceNote: Note;
  snippets: string[];
}

export interface UnlinkedMentionMatch {
  sourceNote: Note;
  snippet: string;
}

export interface HeadingItem {
  level: number;
  text: string;
  lineIndex: number;
}

export interface GraphIndex {
  outgoingByNote: Record<string, Note[]>;
  unresolvedByNote: Record<string, string[]>;
  backlinksByNote: Record<string, BacklinkMatch[]>;
  unlinkedMentionsByNote: Record<string, UnlinkedMentionMatch[]>;
  allTags: { tag: string; count: number; noteIds: string[] }[];
  orphanIds: Set<string>;
  linkPairs: { sourceId: string; targetId: string }[];
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function extractWikilinks(content: string): ParsedWikilink[] {
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const regex = /\[\[([^[\]]+)\]\]/g;
  const results: ParsedWikilink[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(withoutCode)) !== null) {
    const inner = match[1].trim();
    if (!inner) continue;
    const [targetPart, aliasPart] = inner.split('|');
    const cleanTarget = targetPart.split('#')[0].trim();
    if (cleanTarget) {
      results.push({
        raw: match[0],
        target: cleanTarget,
        alias: aliasPart?.trim(),
      });
    }
  }
  return results;
}

export function extractInlineTags(content: string): string[] {
  const body = parseFrontmatter(content).body;
  const withoutCode = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const regex = /(?:^|[\s(])#([a-zA-ZÀ-ÿ0-9_-][a-zA-ZÀ-ÿ0-9_/-]*)/g;
  const set = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(withoutCode)) !== null) {
    const tag = match[1].toLowerCase();
    // Ignore pure numeric hex-like tokens
    if (!/^\d+$/.test(tag)) {
      set.add(tag);
    }
  }
  return Array.from(set);
}

export function getAllNoteTags(note: Note): string[] {
  const inline = extractInlineTags(note.content);
  const manual = (note.tags || []).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
  const fm = parseFrontmatter(note.content).properties.find(
    (p) => p.key.toLowerCase() === 'tags' || p.key.toLowerCase() === 'tag'
  );
  const fmTags = fm
    ? (Array.isArray(fm.value) ? fm.value : String(fm.value).split(','))
        .map((t) => t.replace(/^#/, '').trim().toLowerCase())
        .filter(Boolean)
    : [];
  return Array.from(new Set([...manual, ...fmTags, ...inline]));
}

export function extractHeadings(content: string): HeadingItem[] {
  const lines = content.split('\n');
  const headings: HeadingItem[] = [];
  let inCodeBlock = false;
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;
    const match = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_, t, a) => a || t),
        lineIndex: idx,
      });
    }
  });
  return headings;
}

export function countWordsAndChars(content: string): { words: number; chars: number; minutes: number } {
  const clean = parseFrontmatter(content).body.trim();
  if (!clean) return { words: 0, chars: 0, minutes: 0 };
  const words = clean.split(/\s+/).filter(Boolean).length;
  const chars = clean.length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return { words, chars, minutes };
}

export function computeGraphIndex(notes: Note[]): GraphIndex {
  const byNormalizedTitle = new Map<string, Note>();
  for (const n of notes) {
    byNormalizedTitle.set(normalizeTitle(n.title), n);
    for (const alias of n.aliases || []) {
      const key = normalizeTitle(alias);
      if (key && !byNormalizedTitle.has(key)) {
        byNormalizedTitle.set(key, n);
      }
    }
  }

  const outgoingByNote: Record<string, Note[]> = {};
  const unresolvedByNote: Record<string, string[]> = {};
  const backlinksByNote: Record<string, BacklinkMatch[]> = {};
  const unlinkedMentionsByNote: Record<string, UnlinkedMentionMatch[]> = {};
  const tagMap = new Map<string, Set<string>>();
  const linkPairSet = new Set<string>();
  const linkPairs: { sourceId: string; targetId: string }[] = [];

  for (const note of notes) {
    outgoingByNote[note.id] = [];
    unresolvedByNote[note.id] = [];
    backlinksByNote[note.id] = [];
    unlinkedMentionsByNote[note.id] = [];
  }

  for (const note of notes) {
    const tags = getAllNoteTags(note);
    for (const tag of tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, new Set());
      tagMap.get(tag)!.add(note.id);
    }

    const links = extractWikilinks(note.content);
    const seenTargets = new Set<string>();
    const seenUnresolved = new Set<string>();

    for (const link of links) {
      const targetNote = byNormalizedTitle.get(normalizeTitle(link.target));
      if (targetNote && targetNote.id !== note.id) {
        if (!seenTargets.has(targetNote.id)) {
          seenTargets.add(targetNote.id);
          outgoingByNote[note.id].push(targetNote);

          const pairKey = [note.id, targetNote.id].sort().join('::');
          if (!linkPairSet.has(pairKey)) {
            linkPairSet.add(pairKey);
            linkPairs.push({ sourceId: note.id, targetId: targetNote.id });
          }

          // Collect context snippets
          const lines = note.content.split('\n');
          const snippets: string[] = [];
          for (const line of lines) {
            if (line.toLowerCase().includes(`[[${link.target.toLowerCase()}`)) {
              snippets.push(line.trim());
            }
          }
          backlinksByNote[targetNote.id].push({
            sourceNote: note,
            snippets: snippets.length > 0 ? snippets.slice(0, 2) : [note.content.slice(0, 110)],
          });
        }
      } else if (!targetNote && !seenUnresolved.has(normalizeTitle(link.target))) {
        seenUnresolved.add(normalizeTitle(link.target));
        unresolvedByNote[note.id].push(link.target);
      }
    }
  }

  // Unlinked mentions
  for (const target of notes) {
    const titleLower = target.title.trim().toLowerCase();
    if (titleLower.length < 3) continue;
    for (const source of notes) {
      if (source.id === target.id) continue;
      const alreadyLinked = outgoingByNote[source.id]?.some((n) => n.id === target.id);
      if (alreadyLinked) continue;

      const lines = source.content.split('\n');
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        const idx = lowerLine.indexOf(titleLower);
        if (idx !== -1 && !lowerLine.includes(`[[${titleLower}`)) {
          unlinkedMentionsByNote[target.id].push({
            sourceNote: source,
            snippet: line.trim(),
          });
          break;
        }
      }
    }
  }

  const orphanIds = new Set<string>();
  const parentIds = new Set(notes.map((n) => n.parentNoteId).filter(Boolean));
  for (const note of notes) {
    const outCount = outgoingByNote[note.id]?.length || 0;
    const inCount = backlinksByNote[note.id]?.length || 0;
    const hasParentOrChild = Boolean(note.parentNoteId) || parentIds.has(note.id);
    if (outCount === 0 && inCount === 0 && !hasParentOrChild) {
      orphanIds.add(note.id);
    }
  }

  const allTags = Array.from(tagMap.entries())
    .map(([tag, set]) => ({
      tag,
      count: set.size,
      noteIds: Array.from(set),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    outgoingByNote,
    unresolvedByNote,
    backlinksByNote,
    unlinkedMentionsByNote,
    allTags,
    orphanIds,
    linkPairs,
  };
}

export function getRootTrunk(folderId: string | null, folders: Folder[]): Folder | null {
  if (!folderId) return null;
  let current = folders.find((f) => f.id === folderId) || null;
  let guard = 0;
  while (current && current.parentId && guard < 20) {
    const parent = folders.find((f) => f.id === current!.parentId) || null;
    if (!parent) break;
    current = parent;
    guard++;
  }
  return current;
}

export function getFolderPath(folderId: string | null, folders: Folder[]): Folder[] {
  if (!folderId) return [];
  const path: Folder[] = [];
  let current = folders.find((f) => f.id === folderId) || null;
  let guard = 0;
  while (current && guard < 20) {
    path.unshift(current);
    current = current.parentId ? folders.find((f) => f.id === current!.parentId) || null : null;
    guard++;
  }
  return path;
}
