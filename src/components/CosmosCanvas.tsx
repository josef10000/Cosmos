import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Globe,
  History,
  Maximize,
  Maximize2,
  Minimize,
  Minus,
  Orbit,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { CosmosBookmark, CosmosSettings, Folder, MaturityStage, Note, StarClass } from '../types/vault';
import { getAllNoteTags, getRootTrunk, GraphIndex } from '../utils/markdownGraph';

interface CosmosCanvasProps {
  folders: Folder[];
  notes: Note[];
  graphIndex: GraphIndex;
  activeNoteId: string | null;
  focusRequest: { noteId: string; nonce: number } | null;
  cameraJumpRequest?: { x: number; y: number; zoom: number; nonce: number } | null;
  bookmarks?: CosmosBookmark[];
  settings: CosmosSettings;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onUpdateSettings: (patch: Partial<CosmosSettings>) => void;
  onUpdateFolderStarClass: (folderId: string, starClass: StarClass) => void;
  onSelectNote: (noteId: string) => void;
  onOpenNoteInEditor: (noteId: string) => void;
  onCreateSubnote: (parentNoteId: string) => void;
  onUpdateFolderPos: (folderId: string, pos: { x: number; y: number }) => void;
  onUpdateNotePos: (noteId: string, pos: { x: number; y: number }) => void;
  onResetPositions: () => void;
  onSaveBookmark?: (name: string, camera: { x: number; y: number; zoom: number }) => void;
  onApplyBookmark?: (bookmark: CosmosBookmark) => void;
  onDeleteBookmark?: (id: string) => void;
}

interface StarLayout {
  folder: Folder;
  starClass: StarClass;
  x: number;
  y: number;
  radius: number;
  mass: number;
  noteCount: number;
}

interface SubHubLayout {
  folder: Folder;
  starId: string;
  orbitRadius: number;
  baseAngle: number;
  speed: number;
  x: number;
  y: number;
}

interface BodyLayout {
  note: Note;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  radius: number;
  starId: string | null;
  orbitCenterX: number;
  orbitCenterY: number;
  orbitRadius: number;
  isOrphan: boolean;
  isMoon: boolean;
  degree: number;
  asteroidPath?: string;
}

interface ConstellationCluster {
  tag: string;
  members: BodyLayout[];
  edges: { a: BodyLayout; b: BodyLayout }[];
  cx: number;
  cy: number;
  cloudRadius: number;
  paletteIndex: number;
  color: string;
  labelColor: string;
}

const MIN_ZOOM = 0.0025;
const MAX_ZOOM = 24;

function seededHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function makeAsteroidPolygon(id: string, r: number): string {
  const pts: string[] = [];
  const vertices = 7;
  for (let i = 0; i < vertices; i++) {
    const angle = (i / vertices) * Math.PI * 2;
    const jitter = 0.68 + seededHash(`${id}-ast-${i}`) * 0.45;
    const px = Math.cos(angle) * r * jitter;
    const py = Math.sin(angle) * r * jitter;
    pts.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return pts.join(' ') + ' Z';
}

interface PlanetTheme {
  base: string;
  light: string;
  deep: string;
  feature: string;
  ring: string;
}

const PLANET_THEMES: PlanetTheme[] = [
  {
    base: '#3B82C4',
    light: '#93C5FD',
    deep: '#15325E',
    feature: '#BAE6FD',
    ring: '#93C5FD',
  },
  {
    base: '#4C74D9',
    light: '#A5B4FC',
    deep: '#1B2861',
    feature: '#C7D2FE',
    ring: '#A5B4FC',
  },
  {
    base: '#2D9C95',
    light: '#7CE8D8',
    deep: '#113A42',
    feature: '#B8F3E8',
    ring: '#7CE8D8',
  },
  {
    base: '#CC8D3B',
    light: '#F5CB7C',
    deep: '#54300E',
    feature: '#FBE6B2',
    ring: '#E5A93B',
  },
  {
    base: '#B86B58',
    light: '#E7A28E',
    deep: '#471F17',
    feature: '#F2C6B8',
    ring: '#E7A28E',
  },
];

function getPlanetTheme(id: string, overrideColor?: string): PlanetTheme {
  if (overrideColor) {
    return {
      base: overrideColor,
      light: '#E0F2FE',
      deep: '#0B1326',
      feature: '#FFFFFF',
      ring: overrideColor,
    };
  }
  const idx = Math.floor(seededHash(`${id}-theme`) * PLANET_THEMES.length);
  return PLANET_THEMES[idx % PLANET_THEMES.length];
}

const CONSTELLATION_PALETTE = [
  { color: '#38BDF8', label: '#7DD3FC' },
  { color: '#818CF8', label: '#A5B4FC' },
  { color: '#E5A93B', label: '#FBE6B2' },
  { color: '#2DD4BF', label: '#99F6E4' },
  { color: '#A78BFA', label: '#DDD6FE' },
  { color: '#60A5FA', label: '#BFDBFE' },
];

function computeConstellationMST(members: BodyLayout[]): { a: BodyLayout; b: BodyLayout }[] {
  if (members.length < 2) return [];
  const visited = new Set<number>([0]);
  const edges: { a: BodyLayout; b: BodyLayout }[] = [];

  while (visited.size < members.length) {
    let bestU = -1;
    let bestV = -1;
    let bestDist = Infinity;

    visited.forEach((u) => {
      for (let v = 0; v < members.length; v++) {
        if (visited.has(v)) continue;
        const dx = members[u].x - members[v].x;
        const dy = members[u].y - members[v].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          bestU = u;
          bestV = v;
        }
      }
    });

    if (bestU === -1 || bestV === -1) break;
    visited.add(bestV);
    edges.push({ a: members[bestU], b: members[bestV] });
  }
  return edges;
}

export const CosmosCanvas: React.FC<CosmosCanvasProps> = ({
  folders,
  notes,
  graphIndex,
  activeNoteId,
  focusRequest,
  cameraJumpRequest,
  bookmarks = [],
  settings,
  isFullscreen,
  onToggleFullscreen,
  onUpdateSettings,
  onUpdateFolderStarClass,
  onSelectNote,
  onOpenNoteInEditor,
  onCreateSubnote,
  onUpdateFolderPos,
  onUpdateNotePos,
  onResetPositions,
  onSaveBookmark,
  onApplyBookmark,
  onDeleteBookmark,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 700 });
  const [camera, setCamera] = useState({ x: 500, y: 380, zoom: 0.52 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Live orbital simulation time + spring physics tick
  const [simTime, setSimTime] = useState(0);
  const [, setPhysicsTick] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [timelineActive, setTimelineActive] = useState(false);
  const [timelineRatio, setTimelineRatio] = useState(1);
  const [timelinePlaying, setTimelinePlaying] = useState(false);

  // Live gravitational displacement springs for bodies & stars
  const bodySpringRef = useRef<
    Record<string, { dx: number; dy: number; vx: number; vy: number; isOrphan?: boolean }>
  >({});
  const bodyHomeRef = useRef<
    Record<string, { x: number; y: number; starId: string | null; parentNoteId: string | null }>
  >({});
  const bodyTrailRef = useRef<Record<string, { x: number; y: number }[]>>({});
  const starLiveRef = useRef<
    Record<string, { x: number; y: number; vx: number; vy: number; dirty?: boolean }>
  >({});
  const lastTrailSampleRef = useRef(0);

  const dragRef = useRef<{
    type: 'pan' | 'star' | 'body';
    id?: string;
    startClientX: number;
    startClientY: number;
    startCamX: number;
    startCamY: number;
    startWorldX: number;
    startWorldY: number;
    lastWorldX: number;
    lastWorldY: number;
    lastTime: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);

  // Measure viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewport({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync star anchor positions when folders change externally (e.g. reset or added folder)
  useEffect(() => {
    const rootIds = new Set(folders.filter((f) => f.parentId === null).map((f) => f.id));
    Object.keys(starLiveRef.current).forEach((id) => {
      if (!rootIds.has(id)) delete starLiveRef.current[id];
    });
  }, [folders]);

  // Continuous Keplerian orbital & gravitational recapture physics loop
  useEffect(() => {
    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.001, (now - last) / 1000));
      last = now;

      let changed = false;

      if (settings.orbiting) {
        setSimTime((t) => t + dt * settings.orbitSpeed * 0.38);
        changed = true;
      }

      const activeDrag = dragRef.current;
      const draggingBodyId = activeDrag?.type === 'body' ? activeDrag.id : null;
      const draggingStarId = activeDrag?.type === 'star' ? activeDrag.id : null;

      // 1) Step gliding stars after release, pulling child planets gravitationally
      for (const starId of Object.keys(starLiveRef.current)) {
        if (starId === draggingStarId) continue;
        const st = starLiveRef.current[starId];
        const speed = Math.hypot(st.vx, st.vy);
        if (speed > 1.5) {
          const moveX = st.vx * dt;
          const moveY = st.vy * dt;
          st.x += moveX;
          st.y += moveY;
          const damp = Math.exp(-4.2 * dt);
          st.vx *= damp;
          st.vy *= damp;
          st.dirty = true;
          changed = true;

          // Transfer gravitational lag to all planets/moons of this star
          for (const bId of Object.keys(bodyHomeRef.current)) {
            if (bId === draggingBodyId) continue;
            if (bodyHomeRef.current[bId].starId === starId) {
              const sp = bodySpringRef.current[bId] || { dx: 0, dy: 0, vx: 0, vy: 0 };
              sp.dx -= moveX * 0.88;
              sp.dy -= moveY * 0.88;
              bodySpringRef.current[bId] = sp;
            }
          }
        } else if (st.dirty) {
          st.vx = 0;
          st.vy = 0;
          st.dirty = false;
          onUpdateFolderPos(starId, { x: st.x, y: st.y });
        }
      }

      // 2) Step spring recapture for displaced planets, moons, and asteroids
      const shouldSampleTrail = now - lastTrailSampleRef.current >= 36;
      if (shouldSampleTrail) {
        lastTrailSampleRef.current = now;
      }

      for (const bId of Object.keys(bodySpringRef.current)) {
        if (bId === draggingBodyId && activeDrag?.moved) {
          const home = bodyHomeRef.current[bId];
          if (home) {
            bodySpringRef.current[bId].dx = activeDrag.lastWorldX - home.x;
            bodySpringRef.current[bId].dy = activeDrag.lastWorldY - home.y;
          }
          continue;
        }
        const s = bodySpringRef.current[bId];
        const stiffness = s.isOrphan ? 1.05 : 2.15;
        const damping = s.isOrphan ? 1.85 : 2.45;

        const ax = -stiffness * s.dx - damping * s.vx;
        const ay = -stiffness * s.dy - damping * s.vy;
        s.vx += ax * dt;
        s.vy += ay * dt;
        s.dx += s.vx * dt;
        s.dy += s.vy * dt;

        const dist = Math.hypot(s.dx, s.dy);
        const vel = Math.hypot(s.vx, s.vy);
        if (dist < 0.35 && vel < 0.8) {
          delete bodySpringRef.current[bId];
          delete bodyTrailRef.current[bId];
        } else if (shouldSampleTrail) {
          const home = bodyHomeRef.current[bId];
          if (home) {
            const arr = bodyTrailRef.current[bId] || [];
            arr.push({ x: home.x + s.dx, y: home.y + s.dy });
            if (arr.length > 18) arr.shift();
            bodyTrailRef.current[bId] = arr;
          }
        }
        changed = true;
      }

      if (changed && !settings.orbiting) {
        setPhysicsTick((t) => (t + 1) % 1000000);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [settings.orbiting, settings.orbitSpeed, onUpdateFolderPos]);

  const timelineBounds = useMemo(() => {
    const timestamps = [
      ...notes.map((n) => n.createdAt),
      ...folders.map((f) => f.createdAt),
    ].filter((t) => Number.isFinite(t));
    const min = timestamps.length > 0 ? Math.min(...timestamps) : Date.now() - 86400000;
    const rawMax = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
    const max = rawMax <= min ? min + 86400000 : rawMax;
    return { min, max };
  }, [notes, folders]);

  const timelineCutoff = useMemo(
    () => timelineBounds.min + (timelineBounds.max - timelineBounds.min) * timelineRatio,
    [timelineBounds, timelineRatio]
  );

  useEffect(() => {
    if (!timelineActive || !timelinePlaying) return;
    const id = window.setInterval(() => {
      setTimelineRatio((r) => {
        if (r >= 1) {
          setTimelinePlaying(false);
          return 1;
        }
        return Math.min(1, r + 0.015);
      });
    }, 90);
    return () => window.clearInterval(id);
  }, [timelineActive, timelinePlaying]);

  const visibleNotes = useMemo(() => {
    const q = settings.searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (timelineActive && n.createdAt > timelineCutoff) return false;
      if (!settings.showSubnotes && n.parentNoteId) return false;
      const isOrphan = graphIndex.orphanIds.has(n.id) && !n.folderId;
      if (!settings.showOrphans && isOrphan) return false;
      if (settings.filterFolderId) {
        const root = getRootTrunk(n.folderId, folders);
        if (n.folderId !== settings.filterFolderId && root?.id !== settings.filterFolderId) {
          return false;
        }
      }
      if (settings.filterTag) {
        const tags = getAllNoteTags(n);
        if (!tags.includes(settings.filterTag.toLowerCase())) return false;
      }
      if (q) {
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchContent = n.content.toLowerCase().includes(q);
        if (!matchTitle && !matchContent) return false;
      }
      return true;
    });
  }, [notes, folders, graphIndex.orphanIds, settings, timelineActive, timelineCutoff]);

  const visibleNoteIds = useMemo(() => new Set(visibleNotes.map((n) => n.id)), [visibleNotes]);

  // Compute Star Systems, Sub-hubs, Orbital Bodies, Constellation Clouds & Curved Spacetime Grid
  const layout = useMemo(() => {
    const rootStars = folders.filter(
      (f) => f.parentId === null && (!timelineActive || f.createdAt <= timelineCutoff)
    );
    const spread = settings.spread;

    // Arrange Stars in a balanced galactic constellation
    const starMap = new Map<string, StarLayout>();
    const stars: StarLayout[] = rootStars.map((folder, idx) => {
      const total = Math.max(1, rootStars.length);
      const ringRadius = total === 1 ? 0 : 460 * spread;
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const defaultX = Math.cos(angle) * ringRadius * 1.25;
      const defaultY = Math.sin(angle) * ringRadius * 0.85;

      const anchorX = folder.customPos ? folder.customPos.x : defaultX;
      const anchorY = folder.customPos ? folder.customPos.y : defaultY;
      const liveStar = starLiveRef.current[folder.id];
      const x = liveStar ? liveStar.x : anchorX;
      const y = liveStar ? liveStar.y : anchorY;
      if (!liveStar) {
        starLiveRef.current[folder.id] = { x: anchorX, y: anchorY, vx: 0, vy: 0 };
      }

      const starNotes = visibleNotes.filter((n) => {
        const root = getRootTrunk(n.folderId, folders);
        return root?.id === folder.id;
      });
      const linkMass = starNotes.reduce(
        (acc, n) =>
          acc +
          (graphIndex.outgoingByNote[n.id]?.length || 0) +
          (graphIndex.backlinksByNote[n.id]?.length || 0),
        0
      );

      const starClass: StarClass =
        folder.starClass || (['solar', 'blue-giant', 'binary'][idx % 3] as StarClass);
      const radius = 24 + Math.min(18, starNotes.length * 2.2 + linkMass * 0.45);
      const mass = 1 + starNotes.length * 0.25 + linkMass * 0.08;

      const st: StarLayout = {
        folder,
        starClass,
        x,
        y,
        radius,
        mass,
        noteCount: starNotes.length,
      };
      starMap.set(folder.id, st);
      return st;
    });

    // Subfolders -> Sub-system Gas Giants orbiting their Star
    const subHubMap = new Map<string, SubHubLayout>();
    const subHubs: SubHubLayout[] = [];

    stars.forEach((star) => {
      const children = folders.filter((f) => f.parentId === star.folder.id);
      children.forEach((sf, sIdx) => {
        const orbitRadius = (165 + sIdx * 65) * spread;
        const baseAngle = seededHash(sf.id) * Math.PI * 2;
        const speed = 0.22 * Math.pow(180 / Math.max(80, orbitRadius), 1.15);
        const angle = baseAngle + simTime * speed;
        const x = sf.customPos ? sf.customPos.x : star.x + Math.cos(angle) * orbitRadius;
        const y = sf.customPos ? sf.customPos.y : star.y + Math.sin(angle) * orbitRadius * 0.82;

        const hub: SubHubLayout = {
          folder: sf,
          starId: star.folder.id,
          orbitRadius,
          baseAngle,
          speed,
          x,
          y,
        };
        subHubMap.set(sf.id, hub);
        subHubs.push(hub);

        // Deep subfolders map to parent sub-hub
        folders
          .filter((deep) => deep.parentId === sf.id)
          .forEach((deep) => subHubMap.set(deep.id, hub));
      });
    });

    // Primary Planet Notes
    const bodies: BodyLayout[] = [];
    const bodyMap = new Map<string, BodyLayout>();
    const primaryNotes = visibleNotes.filter((n) => !n.parentNoteId || !visibleNoteIds.has(n.parentNoteId));

    const notesByStar = new Map<string, Note[]>();
    const looseNotes: Note[] = [];

    for (const n of primaryNotes) {
      const root = getRootTrunk(n.folderId, folders);
      if (root && starMap.has(root.id)) {
        if (!notesByStar.has(root.id)) notesByStar.set(root.id, []);
        notesByStar.get(root.id)!.push(n);
      } else {
        looseNotes.push(n);
      }
    }

    // Place planets on Keplerian orbits with gravitational link attraction
    for (const star of stars) {
      const sNotes = notesByStar.get(star.folder.id) || [];
      sNotes.forEach((note, idx) => {
        const subHub = note.folderId ? subHubMap.get(note.folderId) : undefined;
        const centerX = subHub ? subHub.x : star.x;
        const centerY = subHub ? subHub.y : star.y;

        const sameOrbitNotes = sNotes.filter((other) => {
          const otherHub = other.folderId ? subHubMap.get(other.folderId) : undefined;
          return (otherHub?.folder.id || star.folder.id) === (subHub?.folder.id || star.folder.id);
        });
        const localIdx = sameOrbitNotes.findIndex((o) => o.id === note.id);
        const count = Math.max(1, sameOrbitNotes.length);

        const hash = seededHash(note.id);
        const orbitRadius = subHub
          ? (72 + (localIdx % 2) * 32 + Math.floor(localIdx / 3) * 28) * spread
          : (118 + localIdx * 36) * spread;

        // Initial angle distributed cleanly
        let baseAngle = (localIdx / count) * Math.PI * 2 + (hash - 0.5) * 0.45;

        // Gravitational pull from linked notes in OTHER star systems!
        if (settings.gravityPull > 0) {
          const linked = [
            ...(graphIndex.outgoingByNote[note.id] || []),
            ...(graphIndex.backlinksByNote[note.id]?.map((b) => b.sourceNote) || []),
          ];
          let pullX = 0;
          let pullY = 0;
          linked.forEach((other) => {
            const otherRoot = getRootTrunk(other.folderId, folders);
            if (otherRoot && otherRoot.id !== star.folder.id && starMap.has(otherRoot.id)) {
              const targetStar = starMap.get(otherRoot.id)!;
              const dx = targetStar.x - centerX;
              const dy = targetStar.y - centerY;
              const d = Math.max(1, Math.hypot(dx, dy));
              pullX += dx / d;
              pullY += dy / d;
            }
          });
          if (pullX !== 0 || pullY !== 0) {
            const targetAngle = Math.atan2(pullY, pullX);
            // Shortest angular interpolation
            let diff = targetAngle - baseAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            baseAngle += diff * (settings.gravityPull * 0.58);
          }
        }

        // Kepler's 3rd law approximation: closer planets orbit faster
        const angularVel = 0.48 * Math.pow(140 / Math.max(60, orbitRadius), 1.15);
        const angle = baseAngle + simTime * angularVel;

        const homeX = centerX + Math.cos(angle) * orbitRadius;
        const homeY = centerY + Math.sin(angle) * orbitRadius * 0.84;

        bodyHomeRef.current[note.id] = {
          x: homeX,
          y: homeY,
          starId: star.folder.id,
          parentNoteId: note.parentNoteId,
        };

        const spring = bodySpringRef.current[note.id];
        const x = homeX + (spring ? spring.dx : 0);
        const y = homeY + (spring ? spring.dy : 0);

        const degree =
          (graphIndex.outgoingByNote[note.id]?.length || 0) +
          (graphIndex.backlinksByNote[note.id]?.length || 0);

        const radius = 9.5 + Math.min(8, degree * 1.35) + (note.maturity === 'star' ? 2.5 : 0);

        const body: BodyLayout = {
          note,
          x,
          y,
          homeX,
          homeY,
          radius,
          starId: star.folder.id,
          orbitCenterX: centerX,
          orbitCenterY: centerY,
          orbitRadius,
          isOrphan: graphIndex.orphanIds.has(note.id),
          isMoon: false,
          degree,
        };
        bodies.push(body);
        bodyMap.set(note.id, body);
        void idx;
      });
    }

    // Loose / Orphan Notes -> Asteroids drifting in deep space belt
    looseNotes.forEach((note, idx) => {
      const hash = seededHash(note.id);
      const beltRadius = (720 + (idx % 3) * 75) * spread;
      const baseAngle = 0.85 + (idx / Math.max(1, looseNotes.length)) * 1.4 + hash * 0.35;
      const angle = baseAngle + simTime * 0.08;
      const homeX = Math.cos(angle) * beltRadius * 1.15;
      const homeY = Math.sin(angle) * beltRadius * 0.72;

      bodyHomeRef.current[note.id] = {
        x: homeX,
        y: homeY,
        starId: null,
        parentNoteId: note.parentNoteId,
      };
      const spring = bodySpringRef.current[note.id];
      const x = homeX + (spring ? spring.dx : 0);
      const y = homeY + (spring ? spring.dy : 0);
      const degree =
        (graphIndex.outgoingByNote[note.id]?.length || 0) +
        (graphIndex.backlinksByNote[note.id]?.length || 0);

      const radius = 8.5 + Math.min(5, degree);
      const body: BodyLayout = {
        note,
        x,
        y,
        homeX,
        homeY,
        radius,
        starId: null,
        orbitCenterX: 0,
        orbitCenterY: 0,
        orbitRadius: beltRadius,
        isOrphan: true,
        isMoon: false,
        degree,
        asteroidPath: makeAsteroidPolygon(note.id, radius),
      };
      bodies.push(body);
      bodyMap.set(note.id, body);
    });

    // Subnotes -> Moons orbiting around their parent Note-Planet
    if (settings.showSubnotes) {
      const subnotes = visibleNotes.filter(
        (n) => n.parentNoteId && visibleNoteIds.has(n.parentNoteId) && bodyMap.has(n.parentNoteId)
      );
      const countByParent = new Map<string, number>();
      subnotes.forEach((sn) => {
        countByParent.set(sn.parentNoteId!, (countByParent.get(sn.parentNoteId!) || 0) + 1);
      });
      const seenIdx = new Map<string, number>();

      subnotes.forEach((sn) => {
        const parent = bodyMap.get(sn.parentNoteId!)!;
        const idx = seenIdx.get(sn.parentNoteId!) || 0;
        seenIdx.set(sn.parentNoteId!, idx + 1);
        const total = countByParent.get(sn.parentNoteId!) || 1;
        const lunarOrbit = parent.radius + 28 + (idx % 2) * 12;
        const baseAngle = (idx / total) * Math.PI * 2 + seededHash(sn.id);
        const angle = baseAngle + simTime * 1.15;

        const homeX = parent.x + Math.cos(angle) * lunarOrbit;
        const homeY = parent.y + Math.sin(angle) * lunarOrbit * 0.85;

        bodyHomeRef.current[sn.id] = {
          x: homeX,
          y: homeY,
          starId: parent.starId,
          parentNoteId: sn.parentNoteId,
        };
        const spring = bodySpringRef.current[sn.id];
        const x = homeX + (spring ? spring.dx : 0);
        const y = homeY + (spring ? spring.dy : 0);

        const degree =
          (graphIndex.outgoingByNote[sn.id]?.length || 0) +
          (graphIndex.backlinksByNote[sn.id]?.length || 0);

        const moon: BodyLayout = {
          note: sn,
          x,
          y,
          homeX,
          homeY,
          radius: 5.5 + Math.min(3, degree * 0.6),
          starId: parent.starId,
          orbitCenterX: parent.x,
          orbitCenterY: parent.y,
          orbitRadius: lunarOrbit,
          isOrphan: false,
          isMoon: true,
          degree,
        };
        bodies.push(moon);
        bodyMap.set(sn.id, moon);
      });
    }

    // Constellation Clouds grouped by #tags (2+ tagged bodies form a constellation)
    const constellations: ConstellationCluster[] = [];
    if (settings.showConstellations ?? true) {
      const byTag = new Map<string, BodyLayout[]>();
      bodies.forEach((b) => {
        const tags = getAllNoteTags(b.note);
        tags.forEach((tag) => {
          const list = byTag.get(tag) || [];
          list.push(b);
          byTag.set(tag, list);
        });
      });

      byTag.forEach((members, tag) => {
        if (members.length < 2) return;
        let sumX = 0;
        let sumY = 0;
        members.forEach((m) => {
          sumX += m.x;
          sumY += m.y;
        });
        const cx = sumX / members.length;
        const cy = sumY / members.length;
        let maxD = 0;
        members.forEach((m) => {
          const d = Math.hypot(m.x - cx, m.y - cy);
          if (d > maxD) maxD = d;
        });

        const paletteIndex = Math.floor(
          seededHash(`const-${tag}`) * CONSTELLATION_PALETTE.length
        ) % CONSTELLATION_PALETTE.length;
        const pal = CONSTELLATION_PALETTE[paletteIndex];

        constellations.push({
          tag,
          members,
          edges: computeConstellationMST(members),
          cx,
          cy,
          cloudRadius: Math.max(115, maxD + 85),
          paletteIndex,
          color: pal.color,
          labelColor: pal.label,
        });
      });
    }

    // Gravitational Bridges ([[wikilinks]])
    const gravitationalLinks = settings.showLinks
      ? graphIndex.linkPairs
          .filter((pair) => bodyMap.has(pair.sourceId) && bodyMap.has(pair.targetId))
          .map((pair) => {
            const a = bodyMap.get(pair.sourceId)!;
            const b = bodyMap.get(pair.targetId)!;
            const crossStar = a.starId !== b.starId;
            return {
              id: `${pair.sourceId}--${pair.targetId}`,
              source: a,
              target: b,
              crossStar,
            };
          })
      : [];

    // World bounds
    let minX = -650;
    let maxX = 650;
    let minY = -480;
    let maxY = 480;
    if (stars.length > 0 || bodies.length > 0) {
      minX = Infinity;
      maxX = -Infinity;
      minY = Infinity;
      maxY = -Infinity;
      for (const s of stars) {
        minX = Math.min(minX, s.x - 280 * spread);
        maxX = Math.max(maxX, s.x + 280 * spread);
        minY = Math.min(minY, s.y - 240 * spread);
        maxY = Math.max(maxY, s.y + 240 * spread);
      }
      for (const b of bodies) {
        minX = Math.min(minX, b.x - 100);
        maxX = Math.max(maxX, b.x + 100);
        minY = Math.min(minY, b.y - 100);
        maxY = Math.max(maxY, b.y + 100);
      }
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Curved Spacetime Mesh lines warped inward by each Star's gravitational mass!
    const spacetimeLines: string[] = [];
    if (settings.showSpacetimeGrid) {
      const gridPad = 420;
      const gMinX = minX - gridPad;
      const gMaxX = maxX + gridPad;
      const gMinY = minY - gridPad;
      const gMaxY = maxY + gridPad;
      const step = 120;
      const subStep = 36;

      const warpPoint = (px: number, py: number) => {
        let wx = px;
        let wy = py;
        for (const s of stars) {
          const dx = s.x - px;
          const dy = s.y - py;
          const d2 = dx * dx + dy * dy + 6500;
          const pull = (s.mass * 185000) / d2;
          const clamped = Math.min(0.45, pull);
          wx += dx * clamped;
          wy += dy * clamped;
        }
        return [wx, wy];
      };

      for (let gx = gMinX; gx <= gMaxX; gx += step) {
        const pts: string[] = [];
        for (let gy = gMinY; gy <= gMaxY; gy += subStep) {
          const [wx, wy] = warpPoint(gx, gy);
          pts.push(`${pts.length === 0 ? 'M' : 'L'} ${wx.toFixed(1)} ${wy.toFixed(1)}`);
        }
        spacetimeLines.push(pts.join(' '));
      }

      for (let gy = gMinY; gy <= gMaxY; gy += step) {
        const pts: string[] = [];
        for (let gx = gMinX; gx <= gMaxX; gx += subStep) {
          const [wx, wy] = warpPoint(gx, gy);
          pts.push(`${pts.length === 0 ? 'M' : 'L'} ${wx.toFixed(1)} ${wy.toFixed(1)}`);
        }
        spacetimeLines.push(pts.join(' '));
      }
    }

    return {
      stars,
      subHubs,
      bodies,
      bodyMap,
      constellations,
      gravitationalLinks,
      spacetimeLines,
      bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, centerX, centerY },
    };
  }, [
    folders,
    visibleNotes,
    visibleNoteIds,
    graphIndex,
    simTime,
    settings.spread,
    settings.gravityPull,
    settings.showSubnotes,
    settings.showConstellations,
    settings.showLinks,
    settings.showSpacetimeGrid,
    timelineActive,
    timelineCutoff,
  ]);

  const animateCameraTo = useCallback((targetX: number, targetY: number, targetZoom: number, duration = 420) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const start = { ...cameraRef.current };
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setCamera({
        x: start.x + (targetX - start.x) * ease,
        y: start.y + (targetY - start.y) * ease,
        zoom: start.zoom * Math.pow(clampedZoom / start.zoom, ease),
      });
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  const fitCosmos = useCallback(
    (animate = true) => {
      const { bounds } = layout;
      const pad = 90;
      const w = Math.max(200, viewport.width - pad);
      const h = Math.max(200, viewport.height - pad);
      const fitZoom = Math.min(w / Math.max(1, bounds.width), h / Math.max(1, bounds.height), 1.05);
      const targetX = viewport.width / 2 - bounds.centerX * fitZoom;
      const targetY = viewport.height / 2 - bounds.centerY * fitZoom;
      if (animate) {
        animateCameraTo(targetX, targetY, fitZoom, 480);
      } else {
        setCamera({ x: targetX, y: targetY, zoom: fitZoom });
      }
    },
    [layout, viewport, animateCameraTo]
  );

  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedRef.current && viewport.width > 100) {
      hasInitializedRef.current = true;
      fitCosmos(false);
    }
  }, [viewport.width, fitCosmos]);

  useEffect(() => {
    if (!focusRequest) return;
    const body = layout.bodyMap.get(focusRequest.noteId);
    if (!body) return;
    const targetZoom = 1.55;
    const targetX = viewport.width / 2 - body.x * targetZoom;
    const targetY = viewport.height / 2 - body.y * targetZoom;
    animateCameraTo(targetX, targetY, targetZoom, 520);
  }, [focusRequest, layout.bodyMap, viewport, animateCameraTo]);

  useEffect(() => {
    if (!cameraJumpRequest) return;
    animateCameraTo(cameraJumpRequest.x, cameraJumpRequest.y, cameraJumpRequest.zoom, 520);
  }, [cameraJumpRequest, animateCameraTo]);

  const zoomToUniversePoint = () => {
    const targetZoom = 0.0065;
    const targetX = viewport.width / 2 - layout.bounds.centerX * targetZoom;
    const targetY = viewport.height / 2 - layout.bounds.centerY * targetZoom;
    animateCameraTo(targetX, targetY, targetZoom, 680);
  };

  const zoomAtPoint = useCallback((factor: number, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    setCamera((prev) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const worldX = (sx - prev.x) / prev.zoom;
      const worldY = (sy - prev.y) / prev.zoom;
      return {
        zoom: nextZoom,
        x: sx - worldX * nextZoom,
        y: sy - worldY * nextZoom,
      };
    });
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const sensitivity = e.ctrlKey ? 0.008 : 0.0018;
      const factor = Math.exp(-e.deltaY * sensitivity);
      zoomAtPoint(factor, e.clientX, e.clientY);
    },
    [zoomAtPoint]
  );

  const handlePointerDownCanvas = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCamX: cameraRef.current.x,
      startCamY: cameraRef.current.y,
      startWorldX: 0,
      startWorldY: 0,
      lastWorldX: 0,
      lastWorldY: 0,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      moved: false,
    };
  };

  const handlePointerDownBody = (e: React.PointerEvent, body: BodyLayout) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    (containerRef.current as Element | null)?.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      type: 'body',
      id: body.note.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCamX: cameraRef.current.x,
      startCamY: cameraRef.current.y,
      startWorldX: body.x,
      startWorldY: body.y,
      lastWorldX: body.x,
      lastWorldY: body.y,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      moved: false,
    };
  };

  const handlePointerDownStar = (e: React.PointerEvent, star: StarLayout) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    (containerRef.current as Element | null)?.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      type: 'star',
      id: star.folder.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCamX: cameraRef.current.x,
      startCamY: cameraRef.current.y,
      startWorldX: star.x,
      startWorldY: star.y,
      lastWorldX: star.x,
      lastWorldY: star.y,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
    }

    const now = performance.now();
    const dt = Math.max(0.004, (now - drag.lastTime) / 1000);

    if (drag.type === 'pan') {
      setCamera((prev) => ({
        ...prev,
        x: drag.startCamX + dx,
        y: drag.startCamY + dy,
      }));
    } else if (drag.type === 'body' && drag.id && drag.moved) {
      const z = cameraRef.current.zoom;
      const targetX = drag.startWorldX + dx / z;
      const targetY = drag.startWorldY + dy / z;
      const moveX = targetX - drag.lastWorldX;
      const moveY = targetY - drag.lastWorldY;

      const instVx = moveX / dt;
      const instVy = moveY / dt;
      drag.vx = drag.vx * 0.65 + instVx * 0.35;
      drag.vy = drag.vy * 0.65 + instVy * 0.35;
      drag.lastWorldX = targetX;
      drag.lastWorldY = targetY;
      drag.lastTime = now;

      const home = bodyHomeRef.current[drag.id];
      if (home) {
        const bodyObj = layout.bodyMap.get(drag.id);
        bodySpringRef.current[drag.id] = {
          dx: targetX - home.x,
          dy: targetY - home.y,
          vx: 0,
          vy: 0,
          isOrphan: bodyObj?.isOrphan,
        };
      }

      // Gently pull any orbiting moons when dragging their parent planet
      for (const bId of Object.keys(bodyHomeRef.current)) {
        if (bodyHomeRef.current[bId].parentNoteId === drag.id) {
          const mSp = bodySpringRef.current[bId] || { dx: 0, dy: 0, vx: 0, vy: 0 };
          mSp.dx -= moveX * 0.45;
          mSp.dy -= moveY * 0.45;
          bodySpringRef.current[bId] = mSp;
        }
      }

      if (!settings.orbiting) {
        setPhysicsTick((t) => (t + 1) % 1000000);
      }
    } else if (drag.type === 'star' && drag.id && drag.moved) {
      const z = cameraRef.current.zoom;
      const nextX = drag.startWorldX + dx / z;
      const nextY = drag.startWorldY + dy / z;
      const prev = starLiveRef.current[drag.id] || {
        x: drag.startWorldX,
        y: drag.startWorldY,
        vx: 0,
        vy: 0,
      };
      const moveX = nextX - prev.x;
      const moveY = nextY - prev.y;

      const instVx = moveX / dt;
      const instVy = moveY / dt;
      drag.vx = drag.vx * 0.65 + instVx * 0.35;
      drag.vy = drag.vy * 0.65 + instVy * 0.35;
      drag.lastWorldX = nextX;
      drag.lastWorldY = nextY;
      drag.lastTime = now;

      starLiveRef.current[drag.id] = {
        x: nextX,
        y: nextY,
        vx: 0,
        vy: 0,
        dirty: true,
      };

      // Gravitationally pull every planet and moon belonging to this star
      for (const bId of Object.keys(bodyHomeRef.current)) {
        if (bodyHomeRef.current[bId].starId === drag.id) {
          const sp = bodySpringRef.current[bId] || { dx: 0, dy: 0, vx: 0, vy: 0 };
          sp.dx -= moveX * 0.88;
          sp.dy -= moveY * 0.88;
          bodySpringRef.current[bId] = sp;
        }
      }

      if (!settings.orbiting) {
        setPhysicsTick((t) => (t + 1) % 1000000);
      }
    }
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (drag && drag.moved && drag.id) {
      const clampSpeed = (vx: number, vy: number, max: number) => {
        const sp = Math.hypot(vx, vy);
        if (sp <= max || sp === 0) return [vx, vy];
        const s = max / sp;
        return [vx * s, vy * s];
      };
      const stale = performance.now() - drag.lastTime > 90;

      if (drag.type === 'body') {
        const existing = bodySpringRef.current[drag.id];
        if (existing) {
          const [rvx, rvy] = stale ? [0, 0] : clampSpeed(drag.vx * 0.38, drag.vy * 0.38, 420);
          existing.vx = rvx;
          existing.vy = rvy;
        }
      } else if (drag.type === 'star') {
        const st = starLiveRef.current[drag.id];
        if (st) {
          const [rvx, rvy] = stale ? [0, 0] : clampSpeed(drag.vx * 0.45, drag.vy * 0.45, 520);
          st.vx = rvx;
          st.vy = rvy;
          st.dirty = true;
          if (Math.hypot(rvx, rvy) < 1.5) {
            st.dirty = false;
            onUpdateFolderPos(drag.id, { x: st.x, y: st.y });
          }
        }
      }
    }
    dragRef.current = null;
  };

  const focusedId = hoveredNoteId || activeNoteId;
  const highlightedIds = useMemo(() => {
    if (!focusedId) return null;
    const set = new Set<string>([focusedId]);
    graphIndex.outgoingByNote[focusedId]?.forEach((n) => set.add(n.id));
    graphIndex.backlinksByNote[focusedId]?.forEach((b) => set.add(b.sourceNote.id));
    notes.forEach((n) => {
      if (n.parentNoteId === focusedId) set.add(n.id);
    });
    const current = notes.find((n) => n.id === focusedId);
    if (current?.parentNoteId) set.add(current.parentNoteId);
    return set;
  }, [focusedId, graphIndex, notes]);

  const zoom = camera.zoom;
  const isPointLOD = zoom < 0.045;
  const isGalacticLOD = zoom >= 0.045 && zoom < 0.18;
  const isMacroLOD = zoom >= 2.35;

  const selectedBody = activeNoteId ? layout.bodyMap.get(activeNoteId) || null : null;
  const rootStars = useMemo(() => folders.filter((f) => f.parentId === null), [folders]);

  const getBodyPalette = (m: MaturityStage) => {
    if (m === 'star') return { fill: '#E5A93B', stroke: '#FBE6B2', glow: '#E5A93B' };
    if (m === 'nebula') return { fill: '#38BDF8', stroke: '#BAE6FD', glow: '#38BDF8' };
    return { fill: '#5CA9E6', stroke: '#C7E2FA', glow: '#5CA9E6' };
  };

  void onUpdateNotePos;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full h-full overflow-hidden bg-[#000000] select-none touch-none"
    >
      <svg
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDownCanvas}
      >
        <defs>
          <radialGradient id="universePointGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FBE6B2" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#E5A93B" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#5CA9E6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="solarCorona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.98" />
            <stop offset="22%" stopColor="#FBBF24" stopOpacity="0.58" />
            <stop offset="52%" stopColor="#D97706" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blueCorona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F0F9FF" stopOpacity="0.98" />
            <stop offset="22%" stopColor="#60A5FA" stopOpacity="0.55" />
            <stop offset="52%" stopColor="#2563EB" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="solarPhotosphere" cx="46%" cy="46%" r="54%">
            <stop offset="0%" stopColor="#FFFDF5" />
            <stop offset="42%" stopColor="#FCD34D" />
            <stop offset="78%" stopColor="#E59A23" />
            <stop offset="100%" stopColor="#B45309" />
          </radialGradient>
          <radialGradient id="bluePhotosphere" cx="46%" cy="46%" r="54%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#BAE6FD" />
            <stop offset="76%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
          <linearGradient id="spikeH" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFBEB" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spikeV" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFBEB" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="planetSphereOverlay" cx="50%" cy="50%" r="52%">
            <stop offset="55%" stopColor="#000000" stopOpacity="0" />
            <stop offset="88%" stopColor="#000000" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.65" />
          </radialGradient>
          <linearGradient id="starDayNight" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#FFFDF5" stopOpacity="0.16" />
            <stop offset="28%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="54%" stopColor="#020510" stopOpacity="0.46" />
            <stop offset="78%" stopColor="#000000" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.97" />
          </linearGradient>
          <linearGradient id="lunarDayNight" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
            <stop offset="44%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="56%" stopColor="#000000" stopOpacity="0.72" />
            <stop offset="72%" stopColor="#000000" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.98" />
          </linearGradient>
          <radialGradient id="moonSurfaceGrad" cx="44%" cy="44%" r="60%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="65%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
          <radialGradient id="gasGiantGrad" cx="48%" cy="48%" r="56%">
            <stop offset="0%" stopColor="#7CC4FA" />
            <stop offset="56%" stopColor="#2B5B94" />
            <stop offset="100%" stopColor="#13294B" />
          </radialGradient>
          <radialGradient id="starPlanetGrad" cx="46%" cy="46%" r="56%">
            <stop offset="0%" stopColor="#FFFDF2" />
            <stop offset="48%" stopColor="#F5BA42" />
            <stop offset="100%" stopColor="#B86B14" />
          </radialGradient>
          <radialGradient id="nebulaCloudGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.52" />
            <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="protostarCoreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.98" />
            <stop offset="35%" stopColor="#7DD3FC" stopOpacity="0.72" />
            <stop offset="72%" stopColor="#38BDF8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="asteroidGrad" cx="42%" cy="42%" r="68%">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="60%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E293B" />
          </radialGradient>
          {CONSTELLATION_PALETTE.map((pal, idx) => (
            <radialGradient key={`cg-${idx}`} id={`constCloud-${idx}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={pal.color} stopOpacity="0.2" />
              <stop offset="46%" stopColor={pal.color} stopOpacity="0.075" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          ))}
          <filter id="cosmicGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {layout.stars.map((star) => (
            <clipPath key={`cs-${star.folder.id}`} id={`clip-star-${star.folder.id}`}>
              <circle r={star.radius} />
            </clipPath>
          ))}
          {layout.subHubs.map((hub) => {
            const hStar = layout.stars.find((s) => s.folder.id === hub.starId);
            const hLightDeg = hStar
              ? (Math.atan2(hStar.y - hub.y, hStar.x - hub.x) * 180) / Math.PI
              : -135;
            return (
              <React.Fragment key={`hubdefs-${hub.folder.id}`}>
                <clipPath id={`clip-hub-${hub.folder.id}`}>
                  <circle r={12.5} />
                </clipPath>
                <mask id={`mask-hub-ring-${hub.folder.id}`} maskUnits="userSpaceOnUse" x={-40} y={-40} width={80} height={80}>
                  <rect x={-40} y={-40} width={80} height={80} fill="#FFFFFF" />
                  <g transform={`rotate(${hLightDeg})`}>
                    <path d="M 0 -12.2 L -36 -14.5 L -36 14.5 L 0 12.2 Z" fill="#181818" />
                  </g>
                </mask>
              </React.Fragment>
            );
          })}
          {layout.bodies.map((body) => {
            const br = body.radius * (isGalacticLOD ? 1.4 : 1);
            const clipRadius =
              !body.isMoon && body.note.maturity === 'nebula' ? br * 0.72 : br;
            const bStar =
              (body.starId && layout.stars.find((s) => s.folder.id === body.starId)) ||
              layout.stars[0];
            const bLightDeg = bStar
              ? (Math.atan2(bStar.y - body.y, bStar.x - body.x) * 180) / Math.PI
              : -135;
            return (
              <React.Fragment key={`cb-${body.note.id}`}>
                <clipPath id={`clip-body-${body.note.id}`}>
                  <circle r={clipRadius} />
                </clipPath>
                {!body.isMoon && !body.isOrphan && body.note.maturity === 'planet' && (
                  <mask
                    id={`mask-ring-${body.note.id}`}
                    maskUnits="userSpaceOnUse"
                    x={-br * 2.6}
                    y={-br * 2.6}
                    width={br * 5.2}
                    height={br * 5.2}
                  >
                    <rect
                      x={-br * 2.6}
                      y={-br * 2.6}
                      width={br * 5.2}
                      height={br * 5.2}
                      fill="#FFFFFF"
                    />
                    <g transform={`rotate(${bLightDeg})`}>
                      <path
                        d={`M 0 ${-br * 0.98} L ${-br * 2.5} ${-br * 1.15} L ${-br * 2.5} ${br * 1.15} L 0 ${br * 0.98} Z`}
                        fill="#141414"
                      />
                    </g>
                  </mask>
                )}
              </React.Fragment>
            );
          })}
        </defs>

        <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>

          {/* LOD 1: Ultra-distant Universe Point */}
          {isPointLOD && (
            <g onClick={() => fitCosmos(true)} className="cursor-pointer">
              <circle
                cx={layout.bounds.centerX}
                cy={layout.bounds.centerY}
                r={56 / zoom}
                fill="url(#universePointGlow)"
              />
              <circle
                cx={layout.bounds.centerX}
                cy={layout.bounds.centerY}
                r={24 / zoom}
                fill="none"
                stroke="#5CA9E6"
                strokeOpacity={0.35}
                strokeWidth={1 / zoom}
              />
              <circle
                cx={layout.bounds.centerX}
                cy={layout.bounds.centerY}
                r={5.5 / zoom}
                fill="#FBE6B2"
                stroke="#E5A93B"
                strokeWidth={1.4 / zoom}
              />
              <text
                x={layout.bounds.centerX}
                y={layout.bounds.centerY + 26 / zoom}
                textAnchor="middle"
                fill="#D7DFEE"
                fontSize={12 / zoom}
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight={500}
              >
                Universo · {visibleNotes.length} corpos · {layout.stars.length} estrelas
              </text>
              <text
                x={layout.bounds.centerX}
                y={layout.bounds.centerY + 42 / zoom}
                textAnchor="middle"
                fill="#E5A93B"
                fontSize={10.5 / zoom}
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                Aproxime ou clique para mergulhar nos sistemas
              </text>
            </g>
          )}

          {/* LOD 2+: Cosmic Systems & Gravitation */}
          {!isPointLOD && (
            <>
              {/* Layer 0: #tag Constellation Clouds */}
              {(settings.showConstellations ?? true) &&
                layout.constellations.map((c) => {
                  const isFiltered = settings.filterTag?.toLowerCase() === c.tag;
                  const isHoveredMember =
                    hoveredNoteId !== null && c.members.some((m) => m.note.id === hoveredNoteId);
                  const isHighlighted = isFiltered || isHoveredMember;
                  return (
                    <g
                      key={`const-${c.tag}`}
                      className="pointer-events-none transition-opacity duration-200"
                      opacity={
                        hoveredNoteId && !isHighlighted ? 0.35 : isHighlighted ? 1 : 0.85
                      }
                    >
                      {/* Central diffused tag cloud */}
                      <circle
                        cx={c.cx}
                        cy={c.cy}
                        r={c.cloudRadius}
                        fill={`url(#constCloud-${c.paletteIndex})`}
                        opacity={isHighlighted ? 0.85 : 0.48}
                      />
                      {/* Member planet localized nebula puffs */}
                      {c.members.map((m) => (
                        <circle
                          key={`cp-${c.tag}-${m.note.id}`}
                          cx={m.x}
                          cy={m.y}
                          r={82 + m.radius * 3.2}
                          fill={`url(#constCloud-${c.paletteIndex})`}
                          opacity={isHighlighted ? 0.85 : 0.55}
                        />
                      ))}
                      {/* Constellation star-chart lines (MST) */}
                      {!isGalacticLOD &&
                        c.edges.map((edge, ei) => (
                          <line
                            key={`ce-${c.tag}-${ei}`}
                            x1={edge.a.x}
                            y1={edge.a.y}
                            x2={edge.b.x}
                            y2={edge.b.y}
                            stroke={c.color}
                            strokeOpacity={isHighlighted ? 0.38 : 0.14}
                            strokeWidth={
                              isHighlighted
                                ? Math.max(0.85, 1.15 / Math.sqrt(zoom))
                                : Math.max(0.55, 0.78 / Math.sqrt(zoom))
                            }
                            strokeDasharray="2.5 5"
                          />
                        ))}
                      {/* Constellation #tag label */}
                      {settings.showLabels && zoom > 0.12 && !isMacroLOD && (
                        <text
                          x={c.cx}
                          y={c.cy}
                          textAnchor="middle"
                          fill={c.labelColor}
                          fillOpacity={isHighlighted ? 0.88 : 0.5}
                          fontSize={isGalacticLOD ? 14 / Math.sqrt(zoom * 4) : 11.5}
                          fontFamily="Fraunces, Georgia, serif"
                          fontStyle="italic"
                          letterSpacing="0.06em"
                          style={{
                            paintOrder: 'stroke',
                            stroke: '#000000',
                            strokeWidth: 3.5,
                            strokeLinejoin: 'round',
                          }}
                        >
                          #{c.tag}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* Layer 1: Subtle Curved Spacetime Grid (Gravity Wells) */}
              {settings.showSpacetimeGrid && !isGalacticLOD && (
                <g className="pointer-events-none" opacity={Math.min(0.13, Math.max(0.035, zoom * 0.16))}>
                  {layout.spacetimeLines.map((d, idx) => (
                    <path
                      key={`st-${idx}`}
                      d={d}
                      fill="none"
                      stroke="#182745"
                      strokeWidth={Math.max(0.42, 0.58 / Math.sqrt(zoom))}
                    />
                  ))}
                </g>
              )}

              {/* Layer 2: Whisper-Thin Elliptical Orbital Rings */}
              {settings.showOrbitRings && !isGalacticLOD && (
                <g className="pointer-events-none">
                  {layout.bodies
                    .filter((b) => !b.isOrphan)
                    .map((b) => {
                      const isOrbitFocused =
                        b.note.id === hoveredNoteId || b.note.id === activeNoteId;
                      return (
                        <ellipse
                          key={`orb-${b.note.id}`}
                          cx={b.orbitCenterX}
                          cy={b.orbitCenterY}
                          rx={b.orbitRadius}
                          ry={b.orbitRadius * (b.isMoon ? 0.85 : 0.84)}
                          fill="none"
                          stroke={
                            isOrbitFocused
                              ? b.note.id === activeNoteId
                                ? '#E5A93B'
                                : '#5CA9E6'
                              : b.isMoon
                                ? '#26395E'
                                : '#1B2A48'
                          }
                          strokeWidth={isOrbitFocused ? 0.95 : 0.55}
                          strokeDasharray={b.isMoon ? '2 3.5' : '3 6'}
                          strokeOpacity={
                            isOrbitFocused
                              ? 0.48
                              : hoveredNoteId
                                ? 0.05
                                : b.isMoon
                                  ? 0.1
                                  : 0.14
                          }
                        />
                      );
                    })}
                </g>
              )}

              {/* Layer 3: Subtle Gravitational Bridges ([[wikilinks]]) */}
              <g>
                {layout.gravitationalLinks.map((link) => {
                  const isHighlighted =
                    !hoveredNoteId ||
                    link.source.note.id === hoveredNoteId ||
                    link.target.note.id === hoveredNoteId;
                  const isActiveLink =
                    activeNoteId === link.source.note.id || activeNoteId === link.target.note.id;

                  const dx = link.target.x - link.source.x;
                  const dy = link.target.y - link.source.y;
                  const dist = Math.hypot(dx, dy);
                  const nx = -dy / Math.max(1, dist);
                  const ny = dx / Math.max(1, dist);
                  const bend = link.crossStar ? Math.min(120, dist * 0.18) : Math.min(45, dist * 0.14);
                  const mx = (link.source.x + link.target.x) / 2 + nx * bend;
                  const my = (link.source.y + link.target.y) / 2 + ny * bend;

                  return (
                    <path
                      key={link.id}
                      d={`M ${link.source.x} ${link.source.y} Q ${mx} ${my} ${link.target.x} ${link.target.y}`}
                      fill="none"
                      stroke={link.crossStar || isActiveLink ? '#E5A93B' : '#5CA9E6'}
                      strokeWidth={
                        isActiveLink || (hoveredNoteId && isHighlighted)
                          ? Math.max(1.15, 1.65 / Math.sqrt(zoom))
                          : Math.max(0.5, 0.72 / Math.sqrt(zoom))
                      }
                      strokeOpacity={
                        !isHighlighted
                          ? 0.035
                          : isActiveLink || hoveredNoteId
                            ? 0.72
                            : link.crossStar
                              ? 0.17
                              : 0.095
                      }
                      strokeDasharray={link.crossStar ? undefined : '3 5'}
                      className="transition-opacity duration-150 pointer-events-none"
                    />
                  );
                })}
              </g>

              {/* Layer 4: Sub-system 2D Ringed Gas Giants (Subfolders) */}
              {!isGalacticLOD &&
                layout.subHubs.map((hub) => {
                  const clipId = `clip-hub-${hub.folder.id}`;
                  const maskId = `mask-hub-ring-${hub.folder.id}`;
                  const hStar = layout.stars.find((s) => s.folder.id === hub.starId);
                  const hLightDeg = hStar
                    ? (Math.atan2(hStar.y - hub.y, hStar.x - hub.x) * 180) / Math.PI
                    : -135;
                  const hubShift = (simTime * 5.2) % 38;
                  return (
                    <g
                      key={`hub-${hub.folder.id}`}
                      transform={`translate(${hub.x}, ${hub.y})`}
                      className="pointer-events-none"
                    >
                      {/* Cassini-divided multi-band ring back arc with real planet umbra shadow */}
                      <g mask={`url(#${maskId})`}>
                        <g transform="rotate(-18)">
                          <path d="M -28 0 A 28 8.2 0 0 1 28 0" fill="none" stroke="#93C5FD" strokeOpacity={0.36} strokeWidth={1.3} />
                          <path d="M -23.2 0 A 23.2 6.7 0 0 1 23.2 0" fill="none" stroke="#BAE6FD" strokeOpacity={0.44} strokeWidth={2.2} />
                          <path d="M -18.2 0 A 18.2 5.1 0 0 1 18.2 0" fill="none" stroke="#7CC4FA" strokeOpacity={0.22} strokeWidth={1.1} />
                        </g>
                      </g>

                      {/* 2D Gas Giant Sphere with rotating undulating belts + star-facing illumination */}
                      <circle r={12.5} fill="#25548F" />
                      <g clipPath={`url(#${clipId})`}>
                        <g transform="rotate(-18)">
                          {[0, -38].map((tileX) => (
                            <g key={tileX} transform={`translate(${hubShift + tileX}, 0)`}>
                              <path
                                d="M -20 -6 Q -10 -7.2 0 -5.8 T 20 -6 L 20 -3.2 Q 10 -2.4 0 -3.6 T -20 -3.2 Z"
                                fill="#BAE6FD"
                                fillOpacity={0.24}
                              />
                              <path
                                d="M -20 -1.5 Q -10 -0.4 0 -1.8 T 20 -1.5 L 20 1.8 Q 10 2.6 0 1.4 T -20 1.8 Z"
                                fill="#0D1F3F"
                                fillOpacity={0.38}
                              />
                              <path
                                d="M -20 4.2 Q -10 5.1 0 3.8 T 20 4.2 L 20 6.8 Q 10 7.4 0 6.2 T -20 6.8 Z"
                                fill="#7DD3FC"
                                fillOpacity={0.2}
                              />
                              <ellipse cx={6} cy={2.4} rx={3.2} ry={1.6} fill="#E0F2FE" fillOpacity={0.28} />
                            </g>
                          ))}
                        </g>
                        <circle r={12.5} fill="url(#planetSphereOverlay)" />
                        <g transform={`rotate(${hLightDeg})`}>
                          <circle r={12.5} fill="url(#starDayNight)" />
                          <path
                            d="M 0 -12.5 A 12.5 12.5 0 0 1 0 12.5"
                            fill="none"
                            stroke="#BAE6FD"
                            strokeOpacity={0.55}
                            strokeWidth={1.1}
                          />
                        </g>
                      </g>

                      {/* Ring front arc passing cleanly across the gas giant */}
                      <g transform="rotate(-18)">
                        <path d="M -28 0 A 28 8.2 0 0 0 28 0" fill="none" stroke="#93C5FD" strokeOpacity={0.46} strokeWidth={1.3} />
                        <path d="M -23.2 0 A 23.2 6.7 0 0 0 23.2 0" fill="none" stroke="#E0F2FE" strokeOpacity={0.58} strokeWidth={2.2} />
                        <path d="M -18.2 0 A 18.2 5.1 0 0 0 18.2 0" fill="none" stroke="#7CC4FA" strokeOpacity={0.28} strokeWidth={1.1} />
                      </g>

                      {settings.showLabels && zoom > 0.32 && (
                        <text
                          y={26}
                          textAnchor="middle"
                          fill="#8CA3C9"
                          fontSize={10.5}
                          fontFamily="Plus Jakarta Sans, sans-serif"
                          style={{
                            paintOrder: 'stroke',
                            stroke: '#000000',
                            strokeWidth: 3.5,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {hub.folder.name}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* Layer 5: Living Stars (Photosphere, Granulation, Corona & Barycentric Binaries) */}
              {layout.stars.map((star) => {
                const isBlue = star.starClass === 'blue-giant';
                const isBinary = star.starClass === 'binary';
                const starClipId = `clip-star-${star.folder.id}`;
                const plasmaRot = (simTime * 10) % 360;
                return (
                  <g
                    key={`star-${star.folder.id}`}
                    transform={`translate(${star.x}, ${star.y})`}
                    onPointerDown={(e) => handlePointerDownStar(e, star)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const z = 0.88;
                      animateCameraTo(
                        viewport.width / 2 - star.x * z,
                        viewport.height / 2 - star.y * z,
                        z,
                        460
                      );
                    }}
                    className="cursor-pointer group"
                  >
                    {/* Wide Gravitational Corona (no hard borders) */}
                    <circle
                      r={star.radius * 3.8}
                      fill={isBlue ? 'url(#blueCorona)' : 'url(#solarCorona)'}
                      className="pointer-events-none"
                    />
                    {/* Tapered Diffraction Spikes */}
                    <g className="pointer-events-none" opacity={0.55}>
                      <rect
                        x={-star.radius * 2.4}
                        y={-0.65}
                        width={star.radius * 4.8}
                        height={1.3}
                        fill="url(#spikeH)"
                      />
                      <rect
                        x={-0.65}
                        y={-star.radius * 2.4}
                        width={1.3}
                        height={star.radius * 4.8}
                        fill="url(#spikeV)"
                      />
                    </g>

                    {isBinary ? (
                      <g transform={`rotate(${(simTime * 38) % 360})`}>
                        {/* Faint Roche-lobe plasma stream between binary stars */}
                        <path
                          d={`M ${-star.radius * 0.3} ${-star.radius * 0.14} Q ${star.radius * 0.16} ${-star.radius * 0.34} ${star.radius * 0.56} ${-star.radius * 0.08}`}
                          fill="none"
                          stroke="#93C5FD"
                          strokeOpacity={0.32}
                          strokeWidth={1.4}
                          strokeLinecap="round"
                        />
                        {/* Primary Golden Star closer to barycenter */}
                        <circle
                          cx={-star.radius * 0.34}
                          cy={0}
                          r={star.radius * 0.9}
                          fill="url(#solarCorona)"
                          opacity={0.75}
                        />
                        <circle
                          cx={-star.radius * 0.34}
                          cy={0}
                          r={star.radius * 0.54}
                          fill="url(#solarPhotosphere)"
                          filter="url(#cosmicGlow)"
                        />
                        <circle
                          cx={-star.radius * 0.34}
                          cy={0}
                          r={star.radius * 0.24}
                          fill="#FFFDF5"
                          fillOpacity={0.55}
                        />
                        {/* Hot Blue Companion orbiting farther from barycenter */}
                        <circle
                          cx={star.radius * 0.58}
                          cy={0}
                          r={star.radius * 0.65}
                          fill="url(#blueCorona)"
                          opacity={0.75}
                        />
                        <circle
                          cx={star.radius * 0.58}
                          cy={0}
                          r={star.radius * 0.36}
                          fill="url(#bluePhotosphere)"
                          filter="url(#cosmicGlow)"
                        />
                        <circle
                          cx={star.radius * 0.58}
                          cy={0}
                          r={star.radius * 0.16}
                          fill="#FFFFFF"
                          fillOpacity={0.65}
                        />
                      </g>
                    ) : (
                      <g>
                        {/* Chromosphere rim glow */}
                        <circle
                          r={star.radius * 1.18}
                          fill={isBlue ? '#60A5FA' : '#F59E0B'}
                          fillOpacity={0.18}
                        />
                        {/* Photosphere disc */}
                        <circle
                          r={star.radius}
                          fill={isBlue ? 'url(#bluePhotosphere)' : 'url(#solarPhotosphere)'}
                          filter="url(#cosmicGlow)"
                        />
                        {/* Subtle rotating convective granulation & sunspots */}
                        <g clipPath={`url(#${starClipId})`} className="pointer-events-none">
                          <g transform={`rotate(${plasmaRot})`}>
                            <ellipse
                              cx={-star.radius * 0.32}
                              cy={-star.radius * 0.22}
                              rx={star.radius * 0.45}
                              ry={star.radius * 0.28}
                              fill="#FFFFFF"
                              fillOpacity={0.14}
                            />
                            <ellipse
                              cx={star.radius * 0.34}
                              cy={star.radius * 0.28}
                              rx={star.radius * 0.38}
                              ry={star.radius * 0.22}
                              fill={isBlue ? '#1D4ED8' : '#92400E'}
                              fillOpacity={0.18}
                            />
                            <circle
                              cx={star.radius * 0.22}
                              cy={-star.radius * 0.26}
                              r={star.radius * 0.08}
                              fill={isBlue ? '#1E3A8A' : '#78350F'}
                              fillOpacity={0.35}
                            />
                            <circle
                              cx={-star.radius * 0.28}
                              cy={star.radius * 0.34}
                              r={star.radius * 0.055}
                              fill={isBlue ? '#1E3A8A' : '#78350F'}
                              fillOpacity={0.3}
                            />
                          </g>
                        </g>
                        {/* Hot radiative core */}
                        <circle
                          r={star.radius * 0.46}
                          fill="#FFFDF5"
                          fillOpacity={0.38}
                          className="pointer-events-none"
                        />
                      </g>
                    )}

                    {/* Star Title */}
                    {(settings.showLabels || isGalacticLOD) && (
                      <g transform={`translate(0, ${star.radius + 20})`}>
                        <text
                          textAnchor="middle"
                          fill="#ECEFF6"
                          fontSize={isGalacticLOD ? 15 / Math.sqrt(zoom * 4) : 14}
                          fontFamily="Fraunces, Georgia, serif"
                          fontWeight={600}
                          style={{
                            paintOrder: 'stroke',
                            stroke: '#000000',
                            strokeWidth: 4.5,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {star.folder.name}
                        </text>
                        {!isGalacticLOD && (
                          <text
                            y={15}
                            textAnchor="middle"
                            fill="#7B88A6"
                            fontSize={10.5}
                            fontFamily="Plus Jakarta Sans, sans-serif"
                          >
                            {star.noteCount} {star.noteCount === 1 ? 'corpo' : 'corpos'}
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Gravitational Recapture Trails for displaced bodies returning to orbit */}
              <g className="pointer-events-none">
                {layout.bodies.map((body) => {
                  const pts = bodyTrailRef.current[body.note.id];
                  if (!pts || pts.length < 2) return null;
                  const d = pts
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                    .join(' ');
                  return (
                    <path
                      key={`trail-${body.note.id}`}
                      d={d}
                      fill="none"
                      stroke={body.note.maturity === 'star' ? '#E5A93B' : '#5CA9E6'}
                      strokeOpacity={0.28}
                      strokeWidth={Math.max(0.8, 1.15 / Math.sqrt(zoom))}
                      strokeDasharray="2 4"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>

              {/* Layer 6: Astronomically Lit & Rotating 2D Planets, Moons, Nebulae & Asteroids */}
              {layout.bodies.map((body) => {
                const isActive = body.note.id === activeNoteId;
                const isHovered = body.note.id === hoveredNoteId;
                const isDimmed =
                  hoveredNoteId !== null &&
                  highlightedIds !== null &&
                  !highlightedIds.has(body.note.id);

                const starColor =
                  settings.colorBy === 'star' && body.starId
                    ? folders.find((f) => f.id === body.starId)?.color
                    : undefined;
                const theme = getPlanetTheme(body.note.id, starColor);
                const palette =
                  settings.colorBy === 'star' && starColor
                    ? { fill: starColor, stroke: '#E0F2FE', glow: starColor }
                    : getBodyPalette(body.note.maturity);

                const r = body.radius * (isGalacticLOD ? 1.4 : 1);
                const clipId = `clip-body-${body.note.id}`;
                const maskId = `mask-ring-${body.note.id}`;
                const variant = Math.floor(seededHash(`${body.note.id}-var`) * 5);
                const axialTilt = (seededHash(`${body.note.id}-tilt`) - 0.5) * 34;
                const hasRings =
                  !body.isMoon &&
                  !body.isOrphan &&
                  body.note.maturity === 'planet' &&
                  (body.degree >= 2 || seededHash(`${body.note.id}-ring`) > 0.72);
                const ringTilt = -18 + (seededHash(`${body.note.id}-rtilt`) - 0.5) * 18;

                // Real star-relative illumination direction (rotates day/night hemispheres dynamically)
                const lightStar =
                  (body.starId && layout.stars.find((s) => s.folder.id === body.starId)) ||
                  layout.stars[0];
                const lightAngleDeg = lightStar
                  ? (Math.atan2(lightStar.y - body.y, lightStar.x - body.x) * 180) / Math.PI
                  : -135;

                // Continuous axial rotation tile offset
                const tilePeriod = r * 3.2;
                const spinSpeed = 2.6 + seededHash(`${body.note.id}-spin`) * 3.8;
                const spinShift = (simTime * spinSpeed) % tilePeriod;
                const cloudShift = (simTime * spinSpeed * 1.42) % tilePeriod;

                const showThisLabel =
                  !isGalacticLOD &&
                  !isMacroLOD &&
                  settings.showLabels &&
                  (zoom > 0.34 || body.degree >= 2 || isActive || isHovered);

                return (
                  <g
                    key={`body-${body.note.id}`}
                    transform={`translate(${body.x}, ${body.y})`}
                    opacity={isDimmed ? 0.18 : 1}
                    onPointerEnter={() => setHoveredNoteId(body.note.id)}
                    onPointerLeave={() =>
                      setHoveredNoteId((prev) => (prev === body.note.id ? null : prev))
                    }
                    onPointerDown={(e) => handlePointerDownBody(e, body)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!dragRef.current?.moved) {
                        onSelectNote(body.note.id);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onOpenNoteInEditor(body.note.id);
                    }}
                    className="cursor-pointer transition-opacity duration-150"
                  >
                    {/* Active / Hover Selection Halo */}
                    {(isActive || isHovered) && (
                      <circle
                        r={r + (hasRings ? 13 : 8.5)}
                        fill={isActive ? '#E5A93B' : palette.glow}
                        fillOpacity={isActive ? 0.1 : 0.08}
                        stroke={isActive ? '#FBE6B2' : palette.stroke}
                        strokeWidth={0.9}
                        strokeOpacity={0.58}
                      />
                    )}

                    {/* Faceted Rock Asteroid (Orphan Note) with Star-Relative Shading */}
                    {body.isOrphan && body.asteroidPath ? (
                      <g>
                        <path d={body.asteroidPath} fill="url(#asteroidGrad)" />
                        <path
                          d={`M ${-r * 0.45} ${-r * 0.32} L ${r * 0.1} ${-r * 0.05} L ${r * 0.42} ${-r * 0.38} M ${r * 0.1} ${-r * 0.05} L ${-r * 0.12} ${r * 0.52}`}
                          fill="none"
                          stroke="#CBD5E1"
                          strokeOpacity={0.22}
                          strokeWidth={0.65}
                        />
                        <circle cx={-r * 0.24} cy={-r * 0.18} r={r * 0.19} fill="#1E293B" fillOpacity={0.5} />
                        <circle cx={r * 0.22} cy={r * 0.18} r={r * 0.13} fill="#0F172A" fillOpacity={0.55} />
                        <g transform={`rotate(${lightAngleDeg})`}>
                          <path d={body.asteroidPath} transform={`rotate(${-lightAngleDeg})`} fill="url(#lunarDayNight)" opacity={0.85} />
                        </g>
                      </g>
                    ) : body.isMoon ? (
                      /* Cratered 2D Moon (Subnote) with Real Lunar Phases */
                      <g>
                        <circle r={r} fill="url(#moonSurfaceGrad)" />
                        <g clipPath={`url(#${clipId})`} className="pointer-events-none">
                          {/* Lunar Maria & Craters */}
                          <ellipse cx={-r * 0.22} cy={r * 0.15} rx={r * 0.48} ry={r * 0.34} fill="#475569" fillOpacity={0.32} />
                          <circle cx={r * 0.28} cy={-r * 0.22} r={r * 0.26} fill="#334155" fillOpacity={0.35} />
                          <circle cx={-r * 0.28} cy={-r * 0.2} r={r * 0.22} fill="#1E293B" fillOpacity={0.42} />
                          <circle cx={r * 0.3} cy={r * 0.25} r={r * 0.16} fill="#0F172A" fillOpacity={0.45} />
                          <circle cx={r * 0.06} cy={-r * 0.42} r={r * 0.11} fill="#334155" fillOpacity={0.35} />
                          {/* Star-relative lunar phase shadow (crescent/quarter/full) */}
                          <g transform={`rotate(${lightAngleDeg})`}>
                            <circle r={r} fill="url(#lunarDayNight)" />
                          </g>
                        </g>
                        {isActive && (
                          <circle r={r} fill="none" stroke="#FBE6B2" strokeOpacity={0.85} strokeWidth={1.1} />
                        )}
                      </g>
                    ) : body.note.maturity === 'nebula' ? (
                      /* Stellar Nursery Nebula (Draft Note) — organic gas veils + protoplanetary disk */
                      <g className="pointer-events-none">
                        <circle r={r * 2.1} fill="url(#nebulaCloudGrad)" />
                        <g transform={`rotate(${axialTilt + simTime * 3.5})`}>
                          <ellipse
                            cx={-r * 0.28}
                            cy={-r * 0.1}
                            rx={r * 1.25}
                            ry={r * 0.62}
                            fill={starColor || '#38BDF8'}
                            fillOpacity={0.22}
                          />
                          <ellipse
                            cx={r * 0.26}
                            cy={r * 0.18}
                            rx={r * 1.05}
                            ry={r * 0.54}
                            fill={starColor || '#818CF8'}
                            fillOpacity={0.2}
                          />
                          <ellipse
                            cx={0}
                            cy={0}
                            rx={r * 0.85}
                            ry={r * 0.26}
                            transform="rotate(-24)"
                            fill="none"
                            stroke="#BAE6FD"
                            strokeOpacity={0.34}
                            strokeWidth={1.2}
                          />
                        </g>
                        {/* Glowing protostar core (no hard border) */}
                        <circle r={r * 0.85} fill="url(#protostarCoreGrad)" />
                      </g>
                    ) : body.note.maturity === 'star' ? (
                      /* Luminous Golden Pillar Star Note (no hard border) */
                      <g>
                        <circle
                          r={r * 2.4}
                          fill="url(#solarCorona)"
                          fillOpacity={0.85}
                          className="pointer-events-none"
                        />
                        <g className="pointer-events-none" opacity={0.48}>
                          <rect x={-r * 1.8} y={-0.5} width={r * 3.6} height={1} fill="url(#spikeH)" />
                          <rect x={-0.5} y={-r * 1.8} width={1} height={r * 3.6} fill="url(#spikeV)" />
                        </g>
                        <circle
                          r={r}
                          fill={starColor || 'url(#solarPhotosphere)'}
                          filter="url(#cosmicGlow)"
                        />
                        <circle r={r * 0.45} fill="#FFFDF5" fillOpacity={0.42} className="pointer-events-none" />
                      </g>
                    ) : (
                      /* Sculpted, Rotating, Star-Lit 2D Planet */
                      <g>
                        {/* Back Half of Cassini-Divided Rings with Real Planet Shadow */}
                        {hasRings && (
                          <g mask={`url(#${maskId})`} className="pointer-events-none">
                            <g transform={`rotate(${ringTilt})`}>
                              <path
                                d={`M ${-r * 2.02} 0 A ${r * 2.02} ${r * 0.57} 0 0 1 ${r * 2.02} 0`}
                                fill="none"
                                stroke={theme.ring}
                                strokeOpacity={0.34}
                                strokeWidth={1.15}
                              />
                              <path
                                d={`M ${-r * 1.66} 0 A ${r * 1.66} ${r * 0.46} 0 0 1 ${r * 1.66} 0`}
                                fill="none"
                                stroke="#F8FAFC"
                                strokeOpacity={0.38}
                                strokeWidth={2}
                              />
                              <path
                                d={`M ${-r * 1.32} 0 A ${r * 1.32} ${r * 0.36} 0 0 1 ${r * 1.32} 0`}
                                fill="none"
                                stroke={theme.light}
                                strokeOpacity={0.2}
                                strokeWidth={0.95}
                              />
                            </g>
                          </g>
                        )}

                        {/* Planet Base Sphere */}
                        <circle r={r} fill={theme.base} />

                        {/* Clipped Rotating Surface Layer + Star-Relative Day/Night Terminator */}
                        <g clipPath={`url(#${clipId})`} className="pointer-events-none">
                          <g transform={`rotate(${axialTilt})`}>
                            {variant === 0 && (
                              /* Variant 0: Turbulent Jovian Gas Giant (Undulating Waves + Storm Eye) */
                              <>
                                {[0, -tilePeriod].map((tileX) => (
                                  <g key={tileX} transform={`translate(${spinShift + tileX}, 0)`}>
                                    <path
                                      d={`M 0 ${-r * 0.65} Q ${tilePeriod * 0.25} ${-r * 0.74} ${tilePeriod * 0.5} ${-r * 0.62} T ${tilePeriod} ${-r * 0.65} L ${tilePeriod} ${-r * 0.4} Q ${tilePeriod * 0.75} ${-r * 0.32} ${tilePeriod * 0.5} ${-r * 0.42} T 0 ${-r * 0.4} Z`}
                                      fill={theme.feature}
                                      fillOpacity={0.3}
                                    />
                                    <path
                                      d={`M 0 ${-r * 0.26} Q ${tilePeriod * 0.25} ${-r * 0.15} ${tilePeriod * 0.5} ${-r * 0.28} T ${tilePeriod} ${-r * 0.26} L ${tilePeriod} ${r * 0.04} Q ${tilePeriod * 0.75} ${r * 0.14} ${tilePeriod * 0.5} ${r * 0.02} T 0 ${r * 0.04} Z`}
                                      fill={theme.deep}
                                      fillOpacity={0.36}
                                    />
                                    <path
                                      d={`M 0 ${r * 0.22} Q ${tilePeriod * 0.25} ${r * 0.31} ${tilePeriod * 0.5} ${r * 0.2} T ${tilePeriod} ${r * 0.22} L ${tilePeriod} ${r * 0.46} Q ${tilePeriod * 0.75} ${r * 0.52} ${tilePeriod * 0.5} ${r * 0.44} T 0 ${r * 0.46} Z`}
                                      fill={theme.light}
                                      fillOpacity={0.26}
                                    />
                                    <ellipse cx={tilePeriod * 0.58} cy={r * 0.16} rx={r * 0.28} ry={r * 0.15} fill={theme.feature} fillOpacity={0.42} />
                                    <ellipse cx={tilePeriod * 0.58} cy={r * 0.16} rx={r * 0.14} ry={r * 0.07} fill={theme.deep} fillOpacity={0.35} />
                                  </g>
                                ))}
                              </>
                            )}
                            {variant === 1 && (
                              /* Variant 1: Oceanic Exoplanet (Continents + Independent Drifting Cloud Layer) */
                              <>
                                {[0, -tilePeriod].map((tileX) => (
                                  <g key={`land-${tileX}`} transform={`translate(${spinShift + tileX}, 0)`}>
                                    <path
                                      d={`M ${tilePeriod * 0.12} ${-r * 0.34} Q ${tilePeriod * 0.28} ${-r * 0.62} ${tilePeriod * 0.46} ${-r * 0.22} Q ${tilePeriod * 0.55} ${r * 0.08} ${tilePeriod * 0.34} ${r * 0.22} Q ${tilePeriod * 0.15} ${r * 0.16} ${tilePeriod * 0.12} ${-r * 0.34} Z`}
                                      fill={theme.feature}
                                      fillOpacity={0.38}
                                    />
                                    <path
                                      d={`M ${tilePeriod * 0.66} ${r * 0.05} Q ${tilePeriod * 0.84} ${-r * 0.15} ${tilePeriod * 0.92} ${r * 0.24} Q ${tilePeriod * 0.78} ${r * 0.55} ${tilePeriod * 0.64} ${r * 0.35} Z`}
                                      fill={theme.feature}
                                      fillOpacity={0.32}
                                    />
                                  </g>
                                ))}
                                {[0, -tilePeriod].map((tileX) => (
                                  <g key={`cld-${tileX}`} transform={`translate(${cloudShift + tileX}, 0)`}>
                                    <path
                                      d={`M ${tilePeriod * 0.15} ${-r * 0.18} Q ${tilePeriod * 0.3} ${-r * 0.26} ${tilePeriod * 0.48} ${-r * 0.14} Q ${tilePeriod * 0.32} ${-r * 0.05} ${tilePeriod * 0.15} ${-r * 0.18} Z`}
                                      fill="#FFFFFF"
                                      fillOpacity={0.34}
                                    />
                                    <path
                                      d={`M ${tilePeriod * 0.56} ${r * 0.24} Q ${tilePeriod * 0.74} ${r * 0.14} ${tilePeriod * 0.88} ${r * 0.28} Q ${tilePeriod * 0.72} ${r * 0.36} ${tilePeriod * 0.56} ${r * 0.24} Z`}
                                      fill="#FFFFFF"
                                      fillOpacity={0.3}
                                    />
                                  </g>
                                ))}
                              </>
                            )}
                            {variant === 2 && (
                              /* Variant 2: Ice World (Polar Caps + Tectonic Ice Fractures) */
                              <>
                                <ellipse cx={0} cy={-r * 0.86} rx={r * 0.82} ry={r * 0.34} fill="#F8FAFC" fillOpacity={0.38} />
                                <ellipse cx={0} cy={r * 0.88} rx={r * 0.74} ry={r * 0.28} fill="#E0F2FE" fillOpacity={0.28} />
                                {[0, -tilePeriod].map((tileX) => (
                                  <g key={`ice-${tileX}`} transform={`translate(${spinShift + tileX}, 0)`}>
                                    <path
                                      d={`M ${tilePeriod * 0.08} ${-r * 0.35} L ${tilePeriod * 0.52} ${r * 0.18} L ${tilePeriod * 0.9} ${-r * 0.22}`}
                                      fill="none"
                                      stroke={theme.light}
                                      strokeOpacity={0.34}
                                      strokeWidth={0.8}
                                    />
                                    <path
                                      d={`M ${tilePeriod * 0.24} ${r * 0.36} L ${tilePeriod * 0.68} ${-r * 0.28}`}
                                      fill="none"
                                      stroke={theme.deep}
                                      strokeOpacity={0.36}
                                      strokeWidth={0.9}
                                    />
                                  </g>
                                ))}
                              </>
                            )}
                            {variant === 3 && (
                              /* Variant 3: Rocky Cratered World (Basalt Maria + Lit Crater Rims) */
                              <>
                                {[0, -tilePeriod].map((tileX) => (
                                  <g key={`rock-${tileX}`} transform={`translate(${spinShift + tileX}, 0)`}>
                                    <ellipse cx={tilePeriod * 0.32} cy={-r * 0.12} rx={r * 0.38} ry={r * 0.26} fill={theme.deep} fillOpacity={0.34} />
                                    <circle cx={tilePeriod * 0.28} cy={r * 0.26} r={r * 0.2} fill={theme.deep} fillOpacity={0.42} />
                                    <circle cx={tilePeriod * 0.28} cy={r * 0.26} r={r * 0.2} fill="none" stroke={theme.light} strokeOpacity={0.28} strokeWidth={0.7} />
                                    <circle cx={tilePeriod * 0.7} cy={-r * 0.24} r={r * 0.16} fill={theme.deep} fillOpacity={0.38} />
                                    <circle cx={tilePeriod * 0.7} cy={-r * 0.24} r={r * 0.16} fill="none" stroke={theme.feature} strokeOpacity={0.26} strokeWidth={0.65} />
                                  </g>
                                ))}
                              </>
                            )}
                            {variant === 4 && (
                              /* Variant 4: Arid Canyon World (Equatorial Rift + Atmospheric Dust) */
                              <>
                                {[0, -tilePeriod].map((tileX) => (
                                  <g key={`arid-${tileX}`} transform={`translate(${spinShift + tileX}, 0)`}>
                                    <path
                                      d={`M 0 ${-r * 0.04} Q ${tilePeriod * 0.28} ${r * 0.12} ${tilePeriod * 0.56} ${-r * 0.06} T ${tilePeriod} ${-r * 0.04} L ${tilePeriod} ${r * 0.14} Q ${tilePeriod * 0.72} ${r * 0.26} ${tilePeriod * 0.45} ${r * 0.1} T 0 ${r * 0.14} Z`}
                                      fill={theme.deep}
                                      fillOpacity={0.38}
                                    />
                                    <ellipse cx={tilePeriod * 0.42} cy={-r * 0.42} rx={r * 0.42} ry={r * 0.16} fill={theme.feature} fillOpacity={0.24} />
                                  </g>
                                ))}
                              </>
                            )}
                          </g>

                          {/* Subtle Spherical Limb Darkening */}
                          <circle r={r} fill="url(#planetSphereOverlay)" />

                          {/* Dynamic Star-Relative Day/Night Terminator + Sunlit Atmospheric Limb */}
                          <g transform={`rotate(${lightAngleDeg})`}>
                            <circle r={r} fill="url(#starDayNight)" />
                            {/* Thin glowing atmospheric crescent ONLY on sunlit hemisphere */}
                            <path
                              d={`M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r}`}
                              fill="none"
                              stroke={theme.light}
                              strokeOpacity={0.62}
                              strokeWidth={Math.max(0.85, r * 0.09)}
                            />
                          </g>
                        </g>

                        {/* Faint Atmospheric Scattering Halo on Sunlit Side Only */}
                        <g transform={`rotate(${lightAngleDeg})`} className="pointer-events-none">
                          <path
                            d={`M 0 ${-(r + 1.2)} A ${r + 1.2} ${r + 1.2} 0 0 1 0 ${r + 1.2}`}
                            fill="none"
                            stroke={theme.light}
                            strokeOpacity={0.22}
                            strokeWidth={1.1}
                          />
                        </g>

                        {isActive && (
                          <circle r={r + 0.5} fill="none" stroke="#FBE6B2" strokeOpacity={0.85} strokeWidth={1.1} />
                        )}

                        {/* Front Half of Cassini-Divided Rings (in front of sphere) */}
                        {hasRings && (
                          <g transform={`rotate(${ringTilt})`} className="pointer-events-none">
                            <path
                              d={`M ${-r * 2.02} 0 A ${r * 2.02} ${r * 0.57} 0 0 0 ${r * 2.02} 0`}
                              fill="none"
                              stroke={theme.ring}
                              strokeOpacity={0.5}
                              strokeWidth={1.15}
                            />
                            <path
                              d={`M ${-r * 1.66} 0 A ${r * 1.66} ${r * 0.46} 0 0 0 ${r * 1.66} 0`}
                              fill="none"
                              stroke="#F8FAFC"
                              strokeOpacity={0.56}
                              strokeWidth={2}
                            />
                            <path
                              d={`M ${-r * 1.32} 0 A ${r * 1.32} ${r * 0.36} 0 0 0 ${r * 1.32} 0`}
                              fill="none"
                              stroke={theme.light}
                              strokeOpacity={0.28}
                              strokeWidth={0.95}
                            />
                          </g>
                        )}
                      </g>
                    )}

                    {showThisLabel && (
                      <g transform={`translate(0, ${r + 14})`}>
                        <text
                          textAnchor="middle"
                          fill={isActive || isHovered ? '#FBE6B2' : '#D5DDF0'}
                          fontSize={Math.max(10, Math.min(13, 11.5 / Math.pow(zoom, 0.25)))}
                          fontWeight={isActive ? 600 : 500}
                          fontFamily="Plus Jakarta Sans, sans-serif"
                          style={{
                            paintOrder: 'stroke',
                            stroke: '#000000',
                            strokeWidth: 4,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {body.note.title || 'Sem título'}
                        </text>
                      </g>
                    )}

                    {/* LOD 4: Macro Surface Dossier inside/beside the Planet */}
                    {isMacroLOD && (
                      <g transform={`translate(${r + 14}, -46)`}>
                        <rect
                          x={0}
                          y={0}
                          width={168}
                          height={98}
                          rx={6}
                          fill="#0B0F1A"
                          fillOpacity={0.96}
                          stroke={isActive ? '#E5A93B' : '#243456'}
                          strokeWidth={0.9}
                        />
                        <foreignObject x={8} y={6} width={152} height={86}>
                          <div className="h-full flex flex-col justify-between text-[#ECEFF6] overflow-hidden">
                            <div>
                              <div className="text-[7px] font-semibold text-[#E5A93B] truncate mb-0.5">
                                {body.note.title || 'Sem título'}
                              </div>
                              <div className="text-[5.5px] leading-[1.35] text-[#A8B6D1] line-clamp-5">
                                {body.note.content.replace(/[#*`[\]]/g, '').slice(0, 170) ||
                                  'Corpo sem conteúdo...'}
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-[#1B253B] text-[5px] text-[#5CA9E6]">
                              <span>{body.degree} conexões</span>
                              <span>Duplo-clique para abrir</span>
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    )}
                  </g>
                );
              })}
            </>
          )}
        </g>
      </svg>

      {/* ==================== ISOLATED HUD OVERLAYS ==================== */}

      {/* Top-Left Minimal Status */}
      <div className="pointer-events-auto absolute top-4 left-4 flex items-center gap-3 px-3.5 py-2 rounded-lg bg-[#080B12]/90 border border-[#1B253B] backdrop-blur-sm text-xs text-[#7B88A6]">
        <span className="inline-flex items-center gap-1.5 text-[#ECEFF6] font-medium">
          <Sun className="w-3.5 h-3.5 text-[#E5A93B]" />
          <span>{layout.stars.length} estrelas</span>
        </span>
        <span aria-hidden="true">·</span>
        <span>{visibleNotes.length} corpos</span>
        <span aria-hidden="true">·</span>
        <span className="text-[#5CA9E6]">{layout.gravitationalLinks.length} pontes</span>
        {layout.constellations.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-[#A5B4FC]">{layout.constellations.length} constelações</span>
          </>
        )}
      </div>

      {/* Top-Right Controls, Timeline, Bookmarks & Fullscreen */}
      <div className="pointer-events-auto absolute top-4 right-4 flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setTimelineActive((v) => {
                const next = !v;
                if (next) {
                  setTimelineRatio(0.35);
                  setTimelinePlaying(true);
                } else {
                  setTimelinePlaying(false);
                }
                return next;
              });
            }}
            title="Linha do Tempo Gravitacional (Replay da criação do universo)"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              timelineActive
                ? 'bg-[#121B30] border-[#5CA9E6]/60 text-[#BAE6FD]'
                : 'bg-[#0B0F1A]/92 border-[#1B253B] text-[#D7DFEE] hover:border-[#5CA9E6]/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Histórico</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowBookmarks((v) => !v);
              setShowControls(false);
            }}
            title="Constelações Favoritas (Salvar e saltar para vistas do Cosmos)"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              showBookmarks
                ? 'bg-[#121B30] border-[#E5A93B]/50 text-[#FBE6B2]'
                : 'bg-[#0B0F1A]/92 border-[#1B253B] text-[#D7DFEE] hover:border-[#E5A93B]/60'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Favoritos</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Cosmos em tela cheia'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              isFullscreen
                ? 'bg-[#E5A93B] border-[#FBE6B2] text-[#05070D] font-semibold'
                : 'bg-[#0B0F1A]/92 border-[#1B253B] text-[#D7DFEE] hover:border-[#5CA9E6]/60'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-3.5 h-3.5" />
                <span>Sair da tela cheia</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5" />
                <span>Tela cheia</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowControls((s) => !s);
              setShowBookmarks(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              showControls
                ? 'bg-[#121B30] border-[#E5A93B]/50 text-[#FBE6B2]'
                : 'bg-[#0B0F1A]/92 border-[#1B253B] text-[#D7DFEE] hover:border-[#5CA9E6]/60'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Controles do Cosmos</span>
          </button>
        </div>

        {showBookmarks && (
          <div className="w-76 rounded-xl border border-[#1B253B] bg-[#0B0F1A]/96 backdrop-blur-md p-3.5 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#ECEFF6]">Constelações Favoritas</span>
              <button
                type="button"
                onClick={() => setShowBookmarks(false)}
                className="text-[#7B88A6] hover:text-[#ECEFF6] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {onSaveBookmark && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newBookmarkName.trim()) {
                      onSaveBookmark(newBookmarkName.trim(), camera);
                      setNewBookmarkName('');
                    }
                  }}
                  placeholder="Nome da vista atual..."
                  className="flex-1 px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none focus:border-[#E5A93B]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const label = newBookmarkName.trim() || `Vista ${bookmarks.length + 1}`;
                    onSaveBookmark(label, camera);
                    setNewBookmarkName('');
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-[#E5A93B] text-[#05070D] font-semibold hover:bg-[#F3BA52] cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            )}

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {bookmarks.length === 0 ? (
                <p className="text-[#7B88A6] text-[11px] leading-relaxed">
                  Salve o zoom, posição e filtros atuais como um atalho estelar.
                </p>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#05070D] border border-[#182238] hover:border-[#E5A93B]/50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onApplyBookmark?.(bm);
                        animateCameraTo(bm.camera.x, bm.camera.y, bm.camera.zoom, 520);
                        setShowBookmarks(false);
                      }}
                      className="flex-1 text-left truncate text-[#D7DFEE] hover:text-[#E5A93B] cursor-pointer"
                    >
                      <div className="font-medium truncate">{bm.name}</div>
                      <div className="text-[10px] font-mono text-[#7B88A6]">
                        {Math.round(bm.camera.zoom * 100)}%
                        {bm.filterTag ? ` · #${bm.filterTag}` : ''}
                      </div>
                    </button>
                    {onDeleteBookmark && (
                      <button
                        type="button"
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="p-1 text-[#7B88A6] hover:text-[#EF4444] cursor-pointer"
                        title="Remover favorito"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showControls && (
          <div className="w-76 rounded-xl border border-[#1B253B] bg-[#0B0F1A]/96 backdrop-blur-md p-4 shadow-2xl space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#ECEFF6]">Física & Carta Estelar</span>
              <button
                type="button"
                onClick={() => setShowControls(false)}
                className="text-[#7B88A6] hover:text-[#ECEFF6] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7B88A6] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={settings.searchQuery}
                onChange={(e) => onUpdateSettings({ searchQuery: e.target.value })}
                placeholder="Filtrar corpos celestes..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] placeholder-[#7B88A6] focus:outline-none focus:border-[#E5A93B]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[#9AA7C4]">Sistema estelar</label>
              <select
                value={settings.filterFolderId || ''}
                onChange={(e) =>
                  onUpdateSettings({ filterFolderId: e.target.value || null })
                }
                className="w-full px-2.5 py-1.5 rounded-md bg-[#05070D] border border-[#1B253B] text-[#ECEFF6] focus:outline-none focus:border-[#E5A93B]"
              >
                <option value="">Todo o universo</option>
                {rootStars.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {rootStars.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[#161F34]">
                <div className="text-[#9AA7C4] font-medium">Classe das estrelas</div>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {rootStars.map((star, idx) => {
                    const currentClass =
                      star.starClass || (['solar', 'blue-giant', 'binary'][idx % 3] as StarClass);
                    return (
                      <div key={star.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-[#D7DFEE]">{star.name}</span>
                        <select
                          value={currentClass}
                          onChange={(e) =>
                            onUpdateFolderStarClass(star.id, e.target.value as StarClass)
                          }
                          className="px-2 py-1 rounded bg-[#05070D] border border-[#1B253B] text-[11px] text-[#E5A93B] focus:outline-none"
                        >
                          <option value="solar">Anã Dourada</option>
                          <option value="blue-giant">Gigante Azul</option>
                          <option value="binary">Binária</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-[#161F34]">
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Órbitas em movimento</span>
                <input
                  type="checkbox"
                  checked={settings.orbiting}
                  onChange={(e) => onUpdateSettings({ orbiting: e.target.checked })}
                  className="accent-[#E5A93B]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Malha de espaço-tempo</span>
                <input
                  type="checkbox"
                  checked={settings.showSpacetimeGrid}
                  onChange={(e) => onUpdateSettings({ showSpacetimeGrid: e.target.checked })}
                  className="accent-[#5CA9E6]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Anéis orbitais</span>
                <input
                  type="checkbox"
                  checked={settings.showOrbitRings}
                  onChange={(e) => onUpdateSettings({ showOrbitRings: e.target.checked })}
                  className="accent-[#5CA9E6]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Nuvens de constelação (#tags)</span>
                <input
                  type="checkbox"
                  checked={settings.showConstellations ?? true}
                  onChange={(e) => onUpdateSettings({ showConstellations: e.target.checked })}
                  className="accent-[#818CF8]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Pontes gravitacionais ([[...]])</span>
                <input
                  type="checkbox"
                  checked={settings.showLinks}
                  onChange={(e) => onUpdateSettings({ showLinks: e.target.checked })}
                  className="accent-[#E5A93B]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Luas (subnotas)</span>
                <input
                  type="checkbox"
                  checked={settings.showSubnotes}
                  onChange={(e) => onUpdateSettings({ showSubnotes: e.target.checked })}
                  className="accent-[#5CA9E6]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Asteroides (órfãs)</span>
                <input
                  type="checkbox"
                  checked={settings.showOrphans}
                  onChange={(e) => onUpdateSettings({ showOrphans: e.target.checked })}
                  className="accent-[#5CA9E6]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#D7DFEE]">
                <span>Exibir títulos</span>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => onUpdateSettings({ showLabels: e.target.checked })}
                  className="accent-[#5CA9E6]"
                />
              </label>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#161F34]">
              <div>
                <div className="flex justify-between text-[#9AA7C4] mb-1">
                  <span>Velocidade orbital</span>
                  <span className="font-mono tabular-nums">{settings.orbitSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  value={settings.orbitSpeed}
                  onChange={(e) => onUpdateSettings({ orbitSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-[#E5A93B]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#9AA7C4] mb-1">
                  <span>Atração por links</span>
                  <span className="font-mono tabular-nums">{Math.round(settings.gravityPull * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.gravityPull}
                  onChange={(e) => onUpdateSettings({ gravityPull: parseFloat(e.target.value) })}
                  className="w-full accent-[#5CA9E6]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#9AA7C4] mb-1">
                  <span>Abertura dos sistemas</span>
                  <span className="font-mono tabular-nums">{settings.spread.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.65}
                  max={1.75}
                  step={0.05}
                  value={settings.spread}
                  onChange={(e) => onUpdateSettings({ spread: parseFloat(e.target.value) })}
                  className="w-full accent-[#5CA9E6]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[#9AA7C4] mb-1">
                  <span>Colorir corpos por</span>
                </div>
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-[#05070D] border border-[#1B253B]">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ colorBy: 'maturity' })}
                    className={`py-1 rounded text-[11px] font-medium cursor-pointer ${
                      settings.colorBy === 'maturity'
                        ? 'bg-[#131C31] text-[#E5A93B]'
                        : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                    }`}
                  >
                    Ciclo Estelar
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ colorBy: 'star' })}
                    className={`py-1 rounded text-[11px] font-medium cursor-pointer ${
                      settings.colorBy === 'star'
                        ? 'bg-[#131C31] text-[#5CA9E6]'
                        : 'text-[#7B88A6] hover:text-[#D7DFEE]'
                    }`}
                  >
                    Estrela
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#161F34] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  bodySpringRef.current = {};
                  bodyTrailRef.current = {};
                  starLiveRef.current = {};
                  onResetPositions();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-[#101626] border border-[#1B253B] text-[#D7DFEE] hover:border-[#E5A93B]/50 hover:text-[#E5A93B] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reorganizar órbitas</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[#161F34] grid grid-cols-3 gap-2 text-[11px] text-[#9AA7C4]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#38BDF8]" /> Nebulosa
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-[#5CA9E6]" /> Planeta
              </span>
              <span className="flex items-center gap-1">
                <Sun className="w-3 h-3 text-[#E5A93B]" /> Estrela
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left Selected Body Card */}
      {selectedBody && (
        <div className="pointer-events-auto absolute bottom-4 left-4 w-72 rounded-xl border border-[#1B253B] bg-[#0B0F1A]/95 backdrop-blur-md p-3.5 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-display text-sm font-semibold text-[#ECEFF6] truncate">
              {selectedBody.note.title || 'Sem título'}
            </h3>
            <span className="text-[11px] font-mono text-[#E5A93B] shrink-0 tabular-nums">
              {selectedBody.degree} links
            </span>
          </div>
          <p className="text-xs text-[#9AA7C4] line-clamp-2 mb-3 leading-relaxed">
            {selectedBody.note.content.replace(/[#*`[\]]/g, '').trim() || 'Corpo sem texto.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenNoteInEditor(selectedBody.note.id)}
              className="flex-1 py-1.5 px-3 rounded-md bg-[#E5A93B] text-[#05070D] text-xs font-semibold hover:bg-[#F3BA52] transition-colors whitespace-nowrap cursor-pointer"
            >
              Abrir planeta
            </button>
            <button
              type="button"
              onClick={() => onCreateSubnote(selectedBody.note.id)}
              className="py-1.5 px-2.5 rounded-md bg-[#101626] border border-[#1E2A45] text-xs text-[#D7DFEE] hover:text-[#5CA9E6] hover:border-[#5CA9E6]/50 transition-colors whitespace-nowrap cursor-pointer"
            >
              + Lua
            </button>
          </div>
        </div>
      )}

      {/* Bottom-Right Infinite Zoom & Orbit HUD */}
      <div className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-1 p-1 rounded-xl border border-[#1B253B] bg-[#0B0F1A]/95 backdrop-blur-md shadow-2xl">
        <button
          type="button"
          onClick={() => onUpdateSettings({ orbiting: !settings.orbiting })}
          title={settings.orbiting ? 'Pausar movimento orbital' : 'Iniciar movimento orbital'}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer ${
            settings.orbiting
              ? 'text-[#5CA9E6] hover:bg-[#131C31]'
              : 'text-[#7B88A6] hover:bg-[#131C31] hover:text-[#ECEFF6]'
          }`}
        >
          {settings.orbiting ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{settings.orbiting ? 'Orbitando' : 'Pausado'}</span>
        </button>

        <button
          type="button"
          onClick={zoomToUniversePoint}
          title="Afastar até virar um pequeno ponto (Zoom Infinito)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#E5A93B] hover:bg-[#131C31] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ponto</span>
        </button>

        <button
          type="button"
          onClick={() => fitCosmos(true)}
          title="Ajustar todo o cosmos na tela"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#D7DFEE] hover:bg-[#131C31] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ajustar</span>
        </button>

        {selectedBody && (
          <button
            type="button"
            onClick={() => {
              const z = 2.6;
              animateCameraTo(
                viewport.width / 2 - selectedBody.x * z,
                viewport.height / 2 - selectedBody.y * z,
                z,
                500
              );
            }}
            title="Aproximar na superfície do planeta selecionado"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#5CA9E6] hover:bg-[#131C31] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Focus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inspecionar</span>
          </button>
        )}

        <div className="h-4 w-px bg-[#1B253B] mx-0.5" />

        <button
          type="button"
          onClick={() =>
            zoomAtPoint(
              0.65,
              viewport.width / 2 + (containerRef.current?.getBoundingClientRect().left || 0),
              viewport.height / 2 + (containerRef.current?.getBoundingClientRect().top || 0)
            )
          }
          title="Zoom Out"
          className="p-1.5 rounded-lg text-[#D7DFEE] hover:bg-[#131C31] hover:text-[#ECEFF6] transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <span
          className="px-2 text-xs font-mono text-[#ECEFF6] tabular-nums min-w-[54px] text-center"
          title="Escala atual do zoom infinito"
        >
          {zoom < 0.1 ? `${(zoom * 100).toFixed(1)}%` : `${Math.round(zoom * 100)}%`}
        </span>

        <button
          type="button"
          onClick={() =>
            zoomAtPoint(
              1.5,
              viewport.width / 2 + (containerRef.current?.getBoundingClientRect().left || 0),
              viewport.height / 2 + (containerRef.current?.getBoundingClientRect().top || 0)
            )
          }
          title="Zoom In"
          className="p-1.5 rounded-lg text-[#D7DFEE] hover:bg-[#131C31] hover:text-[#ECEFF6] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onUpdateSettings({ showLabels: !settings.showLabels })}
          title={settings.showLabels ? 'Ocultar títulos' : 'Mostrar títulos'}
          className="p-1.5 rounded-lg text-[#7B88A6] hover:bg-[#131C31] hover:text-[#ECEFF6] transition-colors cursor-pointer"
        >
          {settings.showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Gravitational Timeline Replay Scrubber */}
      {timelineActive && (
        <div className="pointer-events-auto absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-xl border border-[#223050] bg-[#0B0F1A]/96 backdrop-blur-md shadow-2xl text-xs max-w-[92vw]">
          <button
            type="button"
            onClick={() => {
              if (timelineRatio >= 1 && !timelinePlaying) {
                setTimelineRatio(0);
              }
              setTimelinePlaying((p) => !p);
            }}
            className="p-1.5 rounded-md bg-[#131C31] text-[#E5A93B] hover:bg-[#1C2845] cursor-pointer shrink-0"
            title={timelinePlaying ? 'Pausar replay' : 'Reproduzir evolução'}
          >
            {timelinePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={timelineRatio}
            onChange={(e) => {
              setTimelinePlaying(false);
              setTimelineRatio(parseFloat(e.target.value));
            }}
            className="w-40 sm:w-56 accent-[#5CA9E6] cursor-pointer"
          />

          <span className="font-mono text-[#BAE6FD] tabular-nums whitespace-nowrap">
            {new Date(timelineCutoff).toLocaleDateString('pt-BR')}
          </span>
          <span className="text-[#7B88A6] tabular-nums whitespace-nowrap hidden sm:inline">
            {visibleNotes.length}/{notes.length} corpos
          </span>

          <button
            type="button"
            onClick={() => {
              setTimelinePlaying(false);
              setTimelineActive(false);
            }}
            className="p-1 rounded text-[#7B88A6] hover:text-[#ECEFF6] cursor-pointer"
            title="Fechar Linha do Tempo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

void Orbit;
