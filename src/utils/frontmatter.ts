export type FrontmatterType = 'text' | 'number' | 'boolean' | 'date' | 'list';

export interface FrontmatterProperty {
  key: string;
  value: string | number | boolean | string[];
  type: FrontmatterType;
}

export interface ParsedFrontmatter {
  hasFrontmatter: boolean;
  properties: FrontmatterProperty[];
  body: string;
  rawBlock: string;
}

function inferTypeAndValue(rawVal: string): {
  type: FrontmatterType;
  value: string | number | boolean | string[];
} {
  const trimmed = rawVal.trim();
  if (trimmed === 'true' || trimmed === 'false') {
    return { type: 'boolean', value: trimmed === 'true' };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { type: 'date', value: trimmed };
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { type: 'number', value: Number(trimmed) };
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    const list = inner
      ? inner
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
      : [];
    return { type: 'list', value: list };
  }
  return { type: 'text', value: trimmed.replace(/^["']|["']$/g, '') };
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) {
    return {
      hasFrontmatter: false,
      properties: [],
      body: content,
      rawBlock: '',
    };
  }

  const yamlBody = match[1];
  const rawBlock = match[0];
  const body = content.slice(rawBlock.length);
  const lines = yamlBody.split(/\r?\n/);
  const properties: FrontmatterProperty[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const kv = /^([a-zA-ZÀ-ÿ0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].trim();
    const rawVal = kv[2].trim();

    if (!rawVal) {
      // Check for YAML indented list (- item)
      const listItems: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+(.+)$/.test(lines[j])) {
        const itemMatch = /^\s*-\s+(.+)$/.exec(lines[j]);
        if (itemMatch) {
          listItems.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
        }
        j++;
      }
      if (listItems.length > 0) {
        properties.push({ key, type: 'list', value: listItems });
        i = j - 1;
      } else {
        properties.push({ key, type: 'text', value: '' });
      }
      continue;
    }

    const parsed = inferTypeAndValue(rawVal);
    properties.push({ key, type: parsed.type, value: parsed.value });
  }

  return {
    hasFrontmatter: true,
    properties,
    body,
    rawBlock,
  };
}

export function serializeFrontmatter(properties: FrontmatterProperty[]): string {
  if (properties.length === 0) return '';
  const lines = properties.map((p) => {
    if (p.type === 'list') {
      const items = Array.isArray(p.value) ? p.value : [];
      return `${p.key}: [${items.join(', ')}]`;
    }
    if (p.type === 'boolean') {
      return `${p.key}: ${Boolean(p.value)}`;
    }
    if (p.type === 'number') {
      const num = Number(p.value);
      return `${p.key}: ${Number.isFinite(num) ? num : 0}`;
    }
    const str = String(p.value ?? '');
    if (str.includes(':') && !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return `${p.key}: "${str.replace(/"/g, '\\"')}"`;
    }
    return `${p.key}: ${str}`;
  });
  return `---\n${lines.join('\n')}\n---\n`;
}

export function applyFrontmatterProperties(
  content: string,
  properties: FrontmatterProperty[]
): string {
  const parsed = parseFrontmatter(content);
  const block = serializeFrontmatter(properties);
  const cleanBody = parsed.body.replace(/^\r?\n/, '');
  if (!block) return cleanBody;
  return `${block}${cleanBody ? '\n' + cleanBody : ''}`;
}

export function setFrontmatterProperty(
  content: string,
  key: string,
  value: string | number | boolean | string[],
  type?: FrontmatterType
): string {
  const cleanKey = key.trim().replace(/\s+/g, '_');
  if (!cleanKey) return content;
  const parsed = parseFrontmatter(content);
  const inferredType: FrontmatterType =
    type ||
    (Array.isArray(value)
      ? 'list'
      : typeof value === 'boolean'
        ? 'boolean'
        : typeof value === 'number'
          ? 'number'
          : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
            ? 'date'
            : 'text');

  const existingIdx = parsed.properties.findIndex(
    (p) => p.key.toLowerCase() === cleanKey.toLowerCase()
  );
  const nextProps = [...parsed.properties];
  if (existingIdx >= 0) {
    nextProps[existingIdx] = { key: nextProps[existingIdx].key, value, type: inferredType };
  } else {
    nextProps.push({ key: cleanKey, value, type: inferredType });
  }
  return applyFrontmatterProperties(content, nextProps);
}

export function removeFrontmatterProperty(content: string, key: string): string {
  const parsed = parseFrontmatter(content);
  const nextProps = parsed.properties.filter(
    (p) => p.key.toLowerCase() !== key.toLowerCase()
  );
  return applyFrontmatterProperties(content, nextProps);
}

export function getFrontmatterMap(
  content: string
): Record<string, string | number | boolean | string[]> {
  const parsed = parseFrontmatter(content);
  const map: Record<string, string | number | boolean | string[]> = {};
  for (const prop of parsed.properties) {
    map[prop.key.toLowerCase()] = prop.value;
  }
  return map;
}

export function stripFrontmatter(content: string): string {
  return parseFrontmatter(content).body;
}
