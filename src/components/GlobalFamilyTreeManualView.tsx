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
import { supabase } from "../lib/supabase";
import type { PeopleMap } from "../types";

type GlobalFamilyTreeManualViewProps = {
  people: PeopleMap;
  editingEnabled: boolean;
  onBack: () => void;
  onOpenPerson: (personId: string) => void;
};

type LayoutRow = {
  person_id: string;
  x: number;
  y: number;
};

type EdgeStyleRow = {
  edge_id: string;
  parent_id: string;
  child_id: string;
  color: string;
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

  for (const [generation, ids] of grouped.entries()) {
    ids.sort((a, b) => {
      const personA = people[a];
      const personB = people[b];

      const yearA = extractSortableYear(personA?.birthDate || "");
      const yearB = extractSortableYear(personB?.birthDate || "");

      if (yearA !== yearB) return yearA - yearB;
      return (personA?.fullName || a).localeCompare(personB?.fullName || b, "pt");
    });

    grouped.set(generation, ids);
  }

  const nodes: Node[] = [];
  const sortedGenerations = [...grouped.keys()].sort((a, b) => a - b);

  sortedGenerations.forEach((generation) => {
    const ids = grouped.get(generation) || [];

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
  const [edgeStyles, setEdgeStyles] = useState<EdgeStyleMap>({});
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isSavingEdgeStyles, setIsSavingEdgeStyles] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const edges = useMemo(() => buildEdges(people, edgeStyles), [people, edgeStyles]);

  const sortedEdgeList = useMemo(() => {
    return Object.entries(edgeStyles).sort(([, a], [, b]) => {
      const parentCompare = (people[a.parentId]?.fullName || a.parentId).localeCompare(
        people[b.parentId]?.fullName || b.parentId,
        "pt",
      );

      if (parentCompare !== 0) return parentCompare;

      return (people[a.childId]?.fullName || a.childId).localeCompare(
        people[b.childId]?.fullName || b.childId,
        "pt",
      );
    });
  }, [edgeStyles, people]);

  useEffect(() => {
    let active = true;

    async function loadLayout() {
      setIsLoadingLayout(true);
      setStatusMessage("");

      try {
        const [
          { data: layoutData, error: layoutError },
          { data: edgeStyleData, error: edgeStyleError },
        ] = await Promise.all([
          supabase.from("person_tree_layouts").select("person_id, x, y"),
          supabase.from("person_tree_edge_styles").select("edge_id, parent_id, child_id, color"),
        ]);

        if (layoutError) throw layoutError;
        if (edgeStyleError) throw edgeStyleError;
        if (!active) return;

        const layoutMap = new Map<string, { x: number; y: number }>();
        (layoutData as LayoutRow[] | null)?.forEach((row) => {
          layoutMap.set(row.person_id, {
            x: row.x,
            y: row.y,
          });
        });

        const nextEdgeStyles = buildDefaultEdgeStyles(people);
        (edgeStyleData as EdgeStyleRow[] | null)?.forEach((row) => {
          nextEdgeStyles[row.edge_id] = {
            parentId: row.parent_id,
            childId: row.child_id,
            color: row.color || DEFAULT_EDGE_COLOR,
          };
        });

        setNodes(buildDefaultNodes(people, layoutMap, editingEnabled));
        setEdgeStyles(nextEdgeStyles);
      } catch (error: any) {
        if (!active) return;
        setNodes(buildDefaultNodes(people, new Map(), editingEnabled));
        setEdgeStyles(buildDefaultEdgeStyles(people));
        setStatusMessage(error?.message || "Não foi possível carregar o layout guardado.");
      } finally {
        if (active) setIsLoadingLayout(false);
      }
    }

    loadLayout();

    return () => {
      active = false;
    };
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

  async function handleSaveLayout() {
    if (!editingEnabled) {
      setStatusMessage("Tens de iniciar sessão para guardar o layout.");
      return;
    }

    setIsSavingLayout(true);
    setStatusMessage("");

    try {
      const rows = nodes.map((node) => ({
        person_id: node.id,
        x: node.position.x,
        y: node.position.y,
      }));

      const { error } = await supabase.from("person_tree_layouts").upsert(rows);

      if (error) throw error;

      setStatusMessage("Layout guardado no Supabase.");
    } catch (error: any) {
      setStatusMessage(error?.message || "Erro ao guardar o layout.");
    } finally {
      setIsSavingLayout(false);
    }
  }

  async function handleSaveEdgeStyles() {
    if (!editingEnabled) {
      setStatusMessage("Tens de iniciar sessão para guardar as cores das linhas.");
      return;
    }

    setIsSavingEdgeStyles(true);
    setStatusMessage("");

    try {
      const rows = Object.entries(edgeStyles).map(([edgeId, item]) => ({
        edge_id: edgeId,
        parent_id: item.parentId,
        child_id: item.childId,
        color: item.color,
      }));

      const { error } = await supabase.from("person_tree_edge_styles").upsert(rows);

      if (error) throw error;

      setStatusMessage("Cores das linhas guardadas no Supabase.");
    } catch (error: any) {
      setStatusMessage(error?.message || "Erro ao guardar as cores das linhas.");
    } finally {
      setIsSavingEdgeStyles(false);
    }
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
    setStatusMessage("Layout reorganizado por geração. Ajusta manualmente e guarda.");
  }

  function updateEdgeColor(edgeId: string, color: string) {
    if (!editingEnabled) return;

    setEdgeStyles((current) => ({
      ...current,
      [edgeId]: {
        ...current[edgeId],
        color,
      },
    }));
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
            
          </div>

          <h2 style={{ margin: 0 }}>Árvore Global</h2>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {editingEnabled ? (
            <>
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

              <button
                onClick={handleSaveLayout}
                disabled={isSavingLayout}
                style={{
                  border: "1px solid #15803d",
                  background: "#16a34a",
                  color: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                  opacity: isSavingLayout ? 0.7 : 1,
                }}
              >
                {isSavingLayout ? "A guardar..." : "Guardar layout"}
              </button>

              <button
                onClick={handleSaveEdgeStyles}
                disabled={isSavingEdgeStyles}
                style={{
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                  opacity: isSavingEdgeStyles ? 0.7 : 1,
                }}
              >
                {isSavingEdgeStyles ? "A guardar cores..." : "Guardar cores"}
              </button>
            </>
          ) : (
            <div
              style={{
                color: "#78716c",
                fontSize: 14,
              }}
            >
              
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

      {statusMessage ? (
        <div
          style={{
            marginBottom: 16,
            color: "#57534e",
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: editingEnabled ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
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

        {editingEnabled ? (
          <div
            style={{
              border: "1px solid #e7e5e4",
              borderRadius: 18,
              background: "#fafaf9",
              padding: 16,
              maxHeight: "78vh",
              minHeight: 620,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#78716c",
                marginBottom: 12,
              }}
            >
              Cores das linhas
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {sortedEdgeList.length ? (
                sortedEdgeList.map(([edgeId, item]) => (
                  <div
                    key={edgeId}
                    style={{
                      border: "1px solid #e7e5e4",
                      background: "white",
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        color: "#292524",
                        marginBottom: 10,
                        lineHeight: 1.4,
                      }}
                    >
                      <strong>{people[item.parentId]?.fullName || item.parentId}</strong>
                      {" → "}
                      <strong>{people[item.childId]?.fullName || item.childId}</strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <input
                        type="color"
                        value={item.color}
                        onChange={(e) => updateEdgeColor(edgeId, e.target.value)}
                        style={{
                          width: 48,
                          height: 36,
                          border: "1px solid #d6d3d1",
                          borderRadius: 8,
                          padding: 0,
                          background: "white",
                          cursor: "pointer",
                        }}
                      />

                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 999,
                          background: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: "#78716c" }}>Sem ligações definidas.</div>
              )}
            </div>
          </div>
        ) : null}
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