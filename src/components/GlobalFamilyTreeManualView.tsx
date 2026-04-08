import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Position,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import type { PeopleMap } from "../types";

type GlobalFamilyTreeManualViewProps = {
  people: PeopleMap;
  editingEnabled: boolean;
  onBack: () => void;
  onOpenPerson: (personId: string) => void;
};

type EdgeStyleMap = Record<
  string,
  {
    parentId: string;
    childId: string;
    color: string;
  }
>;

const NODE_WIDTH = 190;
const NODE_HEIGHT = 58;
const DEFAULT_X_STEP = 240;
const DEFAULT_Y_STEP = 140;
const DEFAULT_EDGE_COLOR = "#1f2937";
const EDGE_STROKE_WIDTH = 4;

function extractSortableYear(value: string): number {
  const text = (value || "").trim();
  if (!text || text === "—") return Number.POSITIVE_INFINITY;

  const fourDigitYearMatch = text.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  if (fourDigitYearMatch) return Number(fourDigitYearMatch[1]);

  const anyNumberMatch = text.match(/\d+/);
  if (anyNumberMatch) return Number(anyNumberMatch[0]);

  return Number.POSITIVE_INFINITY;
}

function computeGenerations(people: PeopleMap): Record<string, number> {
  const cache: Record<string, number> = {};
  const visiting = new Set<string>();

  function getGeneration(personId: string): number {
    if (cache[personId] !== undefined) return cache[personId];
    if (visiting.has(personId)) return 0;

    visiting.add(personId);

    const person = people[personId];
    const parents = person?.parents || [];

    let generation = 0;

    if (parents.length > 0) {
      generation = Math.max(
        ...parents
          .filter((parentId) => Boolean(people[parentId]))
          .map((parentId) => getGeneration(parentId) + 1),
        0,
      );
    }

    cache[personId] = generation;
    visiting.delete(personId);
    return generation;
  }

  Object.keys(people).forEach((personId) => {
    getGeneration(personId);
  });

  return cache;
}

function buildDefaultNodes(
  people: PeopleMap,
  layoutMap: Map<string, { x: number; y: number }>,
  editingEnabled: boolean,
): Node[] {
  const generations = computeGenerations(people);
  const grouped = new Map<number, string[]>();

  Object.keys(people).forEach((personId) => {
    const generation = generations[personId] ?? 0;
    if (!grouped.has(generation)) grouped.set(generation, []);
    grouped.get(generation)?.push(personId);
  });

  const nodes: Node[] = [];

  [...grouped.keys()]
    .sort((a, b) => a - b)
    .forEach((generation) => {
      const ids = grouped.get(generation) || [];

      ids.sort((a, b) => {
        const personA = people[a];
        const personB = people[b];

        const yearA = extractSortableYear(personA?.birthDate || "");
        const yearB = extractSortableYear(personB?.birthDate || "");

        if (yearA !== yearB) return yearA - yearB;
        return (personA?.fullName || a).localeCompare(personB?.fullName || b, "pt");
      });

      ids.forEach((personId, index) => {
        const saved = layoutMap.get(personId);

        nodes.push({
          id: personId,
          position:
            saved || {
              x: index * DEFAULT_X_STEP,
              y: generation * DEFAULT_Y_STEP,
            },
          data: {
            label: people[personId]?.fullName || personId,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          draggable: editingEnabled,
          selectable: true,
          style: {
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            border: "1px solid #0f172a",
            borderRadius: 12,
            background: "white",
            color: "#111827",
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 10px",
            boxSizing: "border-box",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        });
      });
    });

  return nodes;
}

function buildDefaultEdgeStyles(people: PeopleMap): EdgeStyleMap {
  const result: EdgeStyleMap = {};

  Object.keys(people).forEach((childId) => {
    const child = people[childId];
    const parents = (child?.parents || []).filter((parentId) => Boolean(people[parentId]));

    parents.forEach((parentId) => {
      const edgeId = `edge-${parentId}-${childId}`;
      result[edgeId] = {
        parentId,
        childId,
        color: DEFAULT_EDGE_COLOR,
      };
    });
  });

  return result;
}

function buildEdges(people: PeopleMap, edgeStyles: EdgeStyleMap): Edge[] {
  const edges: Edge[] = [];

  Object.keys(people).forEach((childId) => {
    const child = people[childId];
    const parents = (child?.parents || []).filter((parentId) => Boolean(people[parentId]));

    parents.forEach((parentId) => {
      const edgeId = `edge-${parentId}-${childId}`;
      const color = edgeStyles[edgeId]?.color || DEFAULT_EDGE_COLOR;

      edges.push({
        id: edgeId,
        source: parentId,
        target: childId,
        type: "smoothstep",
        animated: false,
        style: {
          strokeWidth: EDGE_STROKE_WIDTH,
          stroke: color,
        },
      });
    });
  });

  return edges;
}

function GlobalFamilyTreeManualInner({
  people,
  editingEnabled,
  onBack,
  onOpenPerson,
}: GlobalFamilyTreeManualViewProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edgeStyles] = useState<EdgeStyleMap>({});
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);

  const mergedEdgeStyles = useMemo(() => {
    return {
      ...buildDefaultEdgeStyles(people),
      ...edgeStyles,
    };
  }, [people, edgeStyles]);

  const edges = useMemo(() => buildEdges(people, mergedEdgeStyles), [people, mergedEdgeStyles]);

  useEffect(() => {
    setNodes(buildDefaultNodes(people, new Map(), editingEnabled));
    setIsLoadingLayout(false);
  }, [people, editingEnabled]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        draggable: editingEnabled,
      })),
    );
  }, [editingEnabled]);

  function handleNodesChange(changes: NodeChange[]) {
    if (!editingEnabled) return;
    setNodes((current) => applyNodeChanges(changes, current));
  }

  function handleAutoArrangeByGeneration() {
    if (!editingEnabled) return;

    const generations = computeGenerations(people);
    const grouped = new Map<number, string[]>();

    Object.keys(people).forEach((personId) => {
      const generation = generations[personId] ?? 0;
      if (!grouped.has(generation)) grouped.set(generation, []);
      grouped.get(generation)?.push(personId);
    });

    const sortedGenerations = [...grouped.keys()].sort((a, b) => a - b);
    const nextNodes = [...nodes];

    sortedGenerations.forEach((generation) => {
      const ids = grouped.get(generation) || [];

      ids.sort((a, b) => {
        const personA = people[a];
        const personB = people[b];

        const yearA = extractSortableYear(personA?.birthDate || "");
        const yearB = extractSortableYear(personB?.birthDate || "");

        if (yearA !== yearB) return yearA - yearB;
        return (personA?.fullName || a).localeCompare(personB?.fullName || b, "pt");
      });

      ids.forEach((personId, index) => {
        const nodeIndex = nextNodes.findIndex((node) => node.id === personId);
        if (nodeIndex === -1) return;

        nextNodes[nodeIndex] = {
          ...nextNodes[nodeIndex],
          position: {
            x: index * DEFAULT_X_STEP,
            y: generation * DEFAULT_Y_STEP,
          },
        };
      });
    });

    setNodes(nextNodes);
  }

  if (isLoadingLayout) {
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #e7e5e4",
          borderRadius: 24,
          padding: 24,
        }}
      >
        A carregar layout da árvore global…
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e7e5e4",
        borderRadius: 24,
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#92400e",
              marginBottom: 8,
            }}
          >
            Árvore global manual
          </div>

          <h2 style={{ margin: 0 }}>Posicionamento livre</h2>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {editingEnabled ? (
            <button
              onClick={handleAutoArrangeByGeneration}
              style={{
                border: "1px solid #d6d3d1",
                background: "white",
                borderRadius: 14,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Organizar por geração
            </button>
          ) : (
            <div
              style={{
                color: "#78716c",
                fontSize: 14,
              }}
            >
              Vista bloqueada
            </div>
          )}

          <button
            onClick={onBack}
            style={{
              border: "1px solid #d6d3d1",
              background: "white",
              borderRadius: 14,
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            ← Voltar
          </button>
        </div>
      </div>

      <div
        style={{
          height: "78vh",
          minHeight: 620,
          border: "1px solid #e7e5e4",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            draggable: editingEnabled,
            data: {
              label: (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenPerson(node.id);
                  }}
                  title={people[node.id]?.fullName || node.id}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                    width: "100%",
                    color: "#111827",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {people[node.id]?.fullName || node.id}
                </button>
              ),
            },
          }))}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.02}
          maxZoom={2}
          onNodesChange={handleNodesChange}
          nodesDraggable={editingEnabled}
          nodesConnectable={false}
          elementsSelectable={editingEnabled}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function GlobalFamilyTreeManualView(props: GlobalFamilyTreeManualViewProps) {
  return (
    <ReactFlowProvider>
      <GlobalFamilyTreeManualInner {...props} />
    </ReactFlowProvider>
  );
}