import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FilePlus,
  Globe,
  Maximize2,
  Minus,
  Palette,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { CanvasColor, CanvasEdge, CanvasNode, CanvasState, Note } from '../types/vault';
import { MarkdownRenderer } from './MarkdownRenderer';

interface SpatialCanvasProps {
  canvas: CanvasState;
  notes: Note[];
  onChangeCanvas: (next: CanvasState) => void;
  onOpenNoteInEditor: (noteId: string) => void;
  onOpenWikilink: (title: string) => void;
  onPromoteTextCardToNote: (card: CanvasNode) => void;
}

const COLOR_STYLES: Record<
  CanvasColor,
  { border: string; headerBg: string; accent: string; dot: string }
> = {
  neutral: {
    border: 'border-[#223050]',
    headerBg: 'bg-[#0A0E19]',
    accent: 'text-[#ECEFF6]',
    dot: 'bg-[#7B88A6]',
  },
  amber: {
    border: 'border-[#E5A93B]/55',
    headerBg: 'bg-[#E5A93B]/10',
    accent: 'text-[#FBE6B2]',
    dot: 'bg-[#E5A93B]',
  },
  blue: {
    border: 'border-[#5CA9E6]/55',
    headerBg: 'bg-[#5CA9E6]/10',
    accent: 'text-[#BAE6FD]',
    dot: 'bg-[#5CA9E6]',
  },
  cyan: {
    border: 'border-[#38BDF8]/55',
    headerBg: 'bg-[#38BDF8]/10',
    accent: 'text-[#A5F3FC]',
    dot: 'bg-[#38BDF8]',
  },
};

const COLOR_CYCLE: CanvasColor[] = ['neutral', 'amber', 'blue', 'cyan'];

export const SpatialCanvas: React.FC<SpatialCanvasProps> = ({
  canvas,
  notes,
  onChangeCanvas,
  onOpenNoteInEditor,
  onOpenWikilink,
  onPromoteTextCardToNote,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState({ x: 80, y: 70, zoom: 0.92 });
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);

  const interactionRef = useRef<{
    mode: 'pan' | 'move-node' | 'resize-node';
    nodeId?: string;
    startClientX: number;
    startClientY: number;
    startCamX: number;
    startCamY: number;
    startNodeX: number;
    startNodeY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && linkingFromId) {
        setLinkingFromId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [linkingFromId]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const act = interactionRef.current;
      if (!act) return;
      const dx = e.clientX - act.startClientX;
      const dy = e.clientY - act.startClientY;

      if (act.mode === 'pan') {
        setCamera((prev) => ({
          ...prev,
          x: act.startCamX + dx,
          y: act.startCamY + dy,
        }));
      } else if (act.mode === 'move-node' && act.nodeId) {
        const wx = act.startNodeX + dx / camera.zoom;
        const wy = act.startNodeY + dy / camera.zoom;
        onChangeCanvas({
          ...canvas,
          nodes: canvas.nodes.map((n) =>
            n.id === act.nodeId ? { ...n, x: Math.round(wx), y: Math.round(wy) } : n
          ),
        });
      } else if (act.mode === 'resize-node' && act.nodeId) {
        const nw = Math.max(210, Math.round(act.startW + dx / camera.zoom));
        const nh = Math.max(130, Math.round(act.startH + dy / camera.zoom));
        onChangeCanvas({
          ...canvas,
          nodes: canvas.nodes.map((n) =>
            n.id === act.nodeId ? { ...n, width: nw, height: nh } : n
          ),
        });
      }
    };

    const onPointerUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [camera.zoom, canvas, onChangeCanvas]);

  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = clientX !== undefined && rect ? clientX - rect.left : (rect?.width || 800) / 2;
    const cy = clientY !== undefined && rect ? clientY - rect.top : (rect?.height || 600) / 2;
    setCamera((prev) => {
      const nextZoom = Math.min(2.4, Math.max(0.22, prev.zoom * factor));
      const ratio = nextZoom / prev.zoom;
      return {
        zoom: nextZoom,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      };
    });
  };

  const fitCanvas = () => {
    if (canvas.nodes.length === 0) {
      setCamera({ x: 80, y: 70, zoom: 0.92 });
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    const vw = rect?.width || 900;
    const vh = rect?.height || 600;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    canvas.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });
    const w = Math.max(200, maxX - minX);
    const h = Math.max(160, maxY - minY);
    const z = Math.min(1.15, Math.max(0.3, Math.min((vw - 120) / w, (vh - 120) / h)));
    setCamera({
      zoom: z,
      x: vw / 2 - ((minX + maxX) / 2) * z,
      y: vh / 2 - ((minY + maxY) / 2) * z,
    });
  };

  const addTextCard = (worldX?: number, worldY?: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = worldX ?? ((rect?.width || 700) / 2 - camera.x) / camera.zoom - 140;
    const cy = worldY ?? ((rect?.height || 500) / 2 - camera.y) / camera.zoom - 90;
    const newNode: CanvasNode = {
      id: `cnode-${Date.now().toString(36)}`,
      type: 'text',
      x: Math.round(cx),
      y: Math.round(cy),
      width: 280,
      height: 185,
      title: 'Nova Ideia',
      text: 'Escreva rascunhos livres aqui ou conecte a outros cartões.',
      color: 'amber',
    };
    onChangeCanvas({ ...canvas, nodes: [...canvas.nodes, newNode] });
  };

  const addNoteCard = (note: Note) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const offset = (canvas.nodes.length % 5) * 28;
    const cx = ((rect?.width || 700) / 2 - camera.x) / camera.zoom - 150 + offset;
    const cy = ((rect?.height || 500) / 2 - camera.y) / camera.zoom - 110 + offset;
    const newNode: CanvasNode = {
      id: `cnote-${Date.now().toString(36)}`,
      type: 'note',
      x: Math.round(cx),
      y: Math.round(cy),
      width: 310,
      height: 230,
      noteId: note.id,
      color: 'blue',
    };
    onChangeCanvas({ ...canvas, nodes: [...canvas.nodes, newNode] });
    setNotePickerOpen(false);
  };

  const completeLink = (targetNodeId: string) => {
    if (!linkingFromId || linkingFromId === targetNodeId) {
      setLinkingFromId(null);
      return;
    }
    const alreadyExists = canvas.edges.some(
      (e) =>
        (e.fromNodeId === linkingFromId && e.toNodeId === targetNodeId) ||
        (e.fromNodeId === targetNodeId && e.toNodeId === linkingFromId)
    );
    if (!alreadyExists) {
      const edge: CanvasEdge = {
        id: `cedge-${Date.now().toString(36)}`,
        fromNodeId: linkingFromId,
        toNodeId: targetNodeId,
        color: 'amber',
      };
      onChangeCanvas({ ...canvas, edges: [...canvas.edges, edge] });
    }
    setLinkingFromId(null);
  };

  const nodesById = useMemo(
    () => new Map(canvas.nodes.map((n) => [n.id, n])),
    [canvas.nodes]
  );

  return (
    <div
      ref={containerRef}
      onWheel={(e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        zoomAt(factor, e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBg) return;
        setNotePickerOpen(false);
        interactionRef.current = {
          mode: 'pan',
          startClientX: e.clientX,
          startClientY: e.clientY,
          startCamX: camera.x,
          startCamY: camera.y,
          startNodeX: 0,
          startNodeY: 0,
          startW: 0,
          startH: 0,
        };
      }}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBg) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const wx = (e.clientX - rect.left - camera.x) / camera.zoom - 140;
        const wy = (e.clientY - rect.top - camera.y) / camera.zoom - 90;
        addTextCard(wx, wy);
      }}
      className="relative w-full h-full overflow-hidden bg-[#000000] select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage: 'radial-gradient(rgba(92, 169, 230, 0.16) 1px, transparent 1px)',
        backgroundSize: `${26 * camera.zoom}px ${26 * camera.zoom}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
      }}
    >
      {/* Top-Left Canvas Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl border border-[#1B253B] bg-[#0B0F1A]/95 backdrop-blur-md shadow-xl">
          <button
            type="button"
            onClick={() => addTextCard()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#E5A93B] hover:bg-[#131C31] transition-colors cursor-pointer"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>+ Cartão Livre</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotePickerOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#5CA9E6] hover:bg-[#131C31] transition-colors cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>+ Embutir Planeta</span>
            </button>

            {notePickerOpen && (
              <div className="absolute left-0 top-10 w-64 max-h-72 overflow-y-auto rounded-xl border border-[#243456] bg-[#0B0F1A] shadow-2xl p-1.5 space-y-0.5 z-30">
                <div className="px-2 py-1 text-[11px] text-[#7B88A6] border-b border-[#161F34]">
                  Selecione uma nota do Vault
                </div>
                {notes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => addNoteCard(n)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs text-[#D7DFEE] hover:bg-[#131C31] hover:text-[#E5A93B] truncate cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-[#5CA9E6] shrink-0" />
                    <span className="truncate">{n.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {linkingFromId && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5A93B]/60 bg-[#E5A93B]/15 text-xs text-[#FBE6B2]">
            <span>Clique no cartão de destino para conectar</span>
            <button
              type="button"
              onClick={() => setLinkingFromId(null)}
              className="underline cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Transformed World Layer */}
      <div
        data-canvas-bg="true"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* SVG Edges Layer */}
        <svg
          className="overflow-visible absolute top-0 left-0 w-1 h-1 pointer-events-none"
          style={{ zIndex: 1 }}
        >
          <defs>
            <marker
              id="canvas-arrow-amber"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#E5A93B" />
            </marker>
            <marker
              id="canvas-arrow-blue"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#5CA9E6" />
            </marker>
          </defs>

          {canvas.edges.map((edge) => {
            const from = nodesById.get(edge.fromNodeId);
            const to = nodesById.get(edge.toNodeId);
            if (!from || !to) return null;

            const x1 = from.x + from.width / 2;
            const y1 = from.y + from.height / 2;
            const x2 = to.x + to.width / 2;
            const y2 = to.y + to.height / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const c1x = x1 + dx * 0.45;
            const c1y = y1;
            const c2x = x2 - dx * 0.45;
            const c2y = y2;
            const isAmber = edge.color !== 'blue';
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            void dy;

            return (
              <g key={edge.id} className="pointer-events-auto group">
                <path
                  d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onClick={() =>
                    onChangeCanvas({
                      ...canvas,
                      edges: canvas.edges.filter((e) => e.id !== edge.id),
                    })
                  }
                />
                <path
                  d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isAmber ? '#E5A93B' : '#5CA9E6'}
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  markerEnd={`url(#${isAmber ? 'canvas-arrow-amber' : 'canvas-arrow-blue'})`}
                  className="pointer-events-none group-hover:stroke-opacity-100"
                />
                <circle
                  cx={mx}
                  cy={my}
                  r={7}
                  fill="#0B0F1A"
                  stroke="#EF4444"
                  strokeWidth={1.2}
                  className="opacity-0 group-hover:opacity-100 cursor-pointer"
                  onClick={() =>
                    onChangeCanvas({
                      ...canvas,
                      edges: canvas.edges.filter((e) => e.id !== edge.id),
                    })
                  }
                />
                <text
                  x={mx}
                  y={my + 3.5}
                  textAnchor="middle"
                  fill="#FCA5A5"
                  fontSize={10}
                  className="opacity-0 group-hover:opacity-100 pointer-events-none"
                >
                  ×
                </text>
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {canvas.nodes.map((node) => {
          const theme = COLOR_STYLES[node.color || 'neutral'];
          const linkedNote = node.noteId ? notesById.get(node.noteId) : undefined;
          const isLinkSource = linkingFromId === node.id;

          return (
            <div
              key={node.id}
              onClick={(e) => {
                if (linkingFromId) {
                  e.stopPropagation();
                  completeLink(node.id);
                }
              }}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: isLinkSource ? 20 : 10,
              }}
              className={`pointer-events-auto absolute flex flex-col rounded-xl border bg-[#070B14]/96 backdrop-blur-md shadow-2xl overflow-hidden transition-shadow ${
                theme.border
              } ${isLinkSource ? 'ring-2 ring-[#E5A93B]' : ''} ${
                linkingFromId && !isLinkSource ? 'hover:ring-2 hover:ring-[#5CA9E6] cursor-crosshair' : ''
              }`}
            >
              {/* Card Header / Drag Handle */}
              <div
                onPointerDown={(e) => {
                  if (linkingFromId) return;
                  e.stopPropagation();
                  interactionRef.current = {
                    mode: 'move-node',
                    nodeId: node.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startCamX: camera.x,
                    startCamY: camera.y,
                    startNodeX: node.x,
                    startNodeY: node.y,
                    startW: node.width,
                    startH: node.height,
                  };
                }}
                className={`flex items-center justify-between gap-2 px-3 py-2 border-b border-[#161F34] cursor-move shrink-0 ${theme.headerBg}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                  {node.type === 'text' ? (
                    <input
                      type="text"
                      value={node.title || ''}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onChangeCanvas({
                          ...canvas,
                          nodes: canvas.nodes.map((n) =>
                            n.id === node.id ? { ...n, title: e.target.value } : n
                          ),
                        })
                      }
                      placeholder="Título..."
                      className={`w-full bg-transparent text-xs font-semibold focus:outline-none ${theme.accent}`}
                    />
                  ) : (
                    <span className={`text-xs font-semibold truncate ${theme.accent}`}>
                      {linkedNote?.title || 'Nota removida'}
                    </span>
                  )}
                </div>

                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 shrink-0"
                >
                  <button
                    type="button"
                    title="Alternar cor"
                    onClick={() => {
                      const nextIdx =
                        (COLOR_CYCLE.indexOf(node.color || 'neutral') + 1) % COLOR_CYCLE.length;
                      onChangeCanvas({
                        ...canvas,
                        nodes: canvas.nodes.map((n) =>
                          n.id === node.id ? { ...n, color: COLOR_CYCLE[nextIdx] } : n
                        ),
                      });
                    }}
                    className="p-1 rounded hover:bg-[#131C31] text-[#9AA7C4] hover:text-[#ECEFF6] cursor-pointer"
                  >
                    <Palette className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="Conectar a outro cartão"
                    onClick={() => setLinkingFromId(isLinkSource ? null : node.id)}
                    className={`p-1 rounded hover:bg-[#131C31] cursor-pointer ${
                      isLinkSource ? 'text-[#E5A93B]' : 'text-[#9AA7C4] hover:text-[#5CA9E6]'
                    }`}
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  {node.type === 'text' ? (
                    <button
                      type="button"
                      title="Promover cartão para Planeta no Vault"
                      onClick={() => onPromoteTextCardToNote(node)}
                      className="p-1 rounded hover:bg-[#131C31] text-[#9AA7C4] hover:text-[#E5A93B] cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                  ) : (
                    linkedNote && (
                      <button
                        type="button"
                        title="Abrir planeta no editor"
                        onClick={() => onOpenNoteInEditor(linkedNote.id)}
                        className="p-1 rounded hover:bg-[#131C31] text-[#9AA7C4] hover:text-[#E5A93B] cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    title="Remover do Canvas"
                    onClick={() =>
                      onChangeCanvas({
                        nodes: canvas.nodes.filter((n) => n.id !== node.id),
                        edges: canvas.edges.filter(
                          (e) => e.fromNodeId !== node.id && e.toNodeId !== node.id
                        ),
                      })
                    }
                    className="p-1 rounded hover:bg-[#131C31] text-[#9AA7C4] hover:text-[#EF4444] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-1 min-h-0 p-3 overflow-y-auto select-text"
              >
                {node.type === 'text' ? (
                  <textarea
                    value={node.text || ''}
                    onChange={(e) =>
                      onChangeCanvas({
                        ...canvas,
                        nodes: canvas.nodes.map((n) =>
                          n.id === node.id ? { ...n, text: e.target.value } : n
                        ),
                      })
                    }
                    placeholder="Escreva suas ideias livres..."
                    className="w-full h-full bg-transparent text-xs leading-relaxed text-[#D2DCF0] placeholder-[#4B5878] resize-none focus:outline-none"
                  />
                ) : linkedNote ? (
                  <MarkdownRenderer
                    content={linkedNote.content}
                    notes={notes}
                    onOpenWikilink={onOpenWikilink}
                    onClickTag={() => {}}
                    compact
                  />
                ) : (
                  <div className="text-xs text-[#7B88A6]">Nota não encontrada no Vault.</div>
                )}
              </div>

              {/* Resize Corner */}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  interactionRef.current = {
                    mode: 'resize-node',
                    nodeId: node.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startCamX: camera.x,
                    startCamY: camera.y,
                    startNodeX: node.x,
                    startNodeY: node.y,
                    startW: node.width,
                    startH: node.height,
                  };
                }}
                title="Arraste para redimensionar"
                className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize opacity-40 hover:opacity-100"
              >
                <svg viewBox="0 0 12 12" className="w-full h-full">
                  <path d="M 10 3 L 3 10 M 10 7 L 7 10" stroke="#7B88A6" strokeWidth="1.4" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom-Right Canvas Zoom HUD */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 p-1 rounded-xl border border-[#1B253B] bg-[#0B0F1A]/95 backdrop-blur-md shadow-2xl">
        <span className="px-2 text-[11px] text-[#7B88A6] hidden sm:inline">
          Duplo-clique no espaço cria cartão
        </span>
        <button
          type="button"
          onClick={fitCanvas}
          title="Ajustar todos os cartões"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[#D7DFEE] hover:bg-[#131C31] cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ajustar</span>
        </button>
        <button
          type="button"
          onClick={() => zoomAt(0.85)}
          className="p-1.5 rounded-lg text-[#D7DFEE] hover:bg-[#131C31] cursor-pointer"
          aria-label="Diminuir zoom"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 text-xs font-mono text-[#ECEFF6] tabular-nums min-w-[48px] text-center">
          {Math.round(camera.zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomAt(1.18)}
          className="p-1.5 rounded-lg text-[#D7DFEE] hover:bg-[#131C31] cursor-pointer"
          aria-label="Aumentar zoom"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
