import PersonCard from "./PersonCard";
import type { PeopleMap } from "../types";

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        border: "1px dashed #d6d3d1",
        background: "#fafaf9",
        borderRadius: 20,
        padding: 16,
        color: "#78716c",
      }}
    >
      {text}
    </div>
  );
}

type TreeViewProps = {
  people: PeopleMap;
  selectedId: string;
  focusId: string;
  focusCoupleIds: string[];
  ancestorIds: string[];
  descendantIds: string[];
  activeSpouseId: string | null;
  activeSpouseIndex: number;
  totalSpouses: number;
  onSelect: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onPreviousSpouse: () => void;
  onNextSpouse: () => void;
};

function ParentsBlock({
  parentIds,
  people,
  sideLabel,
  selectedId,
  onSelect,
}: {
  parentIds: string[];
  people: PeopleMap;
  sideLabel: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "#78716c",
          marginBottom: 12,
        }}
      >
        Pais {sideLabel}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {parentIds.length ? (
          parentIds.map((id) =>
            people[id] ? (
              <PersonCard
                key={id}
                fullName={people[id].fullName}
                birthDate={people[id].birthDate}
                deathDate={people[id].deathDate}
                birthPlace={people[id].birthPlace}
                photo={people[id].photo}
                minimal
                highlight={selectedId === id}
                onClick={() => onSelect(id)}
              />
            ) : null,
          )
        ) : (
          <div style={{ gridColumn: "1 / -1" }}>
            <EmptyState text="Sem registos nesta geração." />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TreeView({
  people,
  selectedId,
  focusId,
  focusCoupleIds,
  ancestorIds: _ancestorIds,
  descendantIds,
  activeSpouseId,
  activeSpouseIndex,
  totalSpouses,
  onSelect,
  onOpenDetails,
  onPreviousSpouse,
  onNextSpouse,
}: TreeViewProps) {
  const activeSpouseName = activeSpouseId ? people[activeSpouseId]?.fullName || activeSpouseId : null;

  const leftPersonId = focusCoupleIds[0] || null;
  const rightPersonId = focusCoupleIds[1] || null;

  const leftParentIds = leftPersonId ? (people[leftPersonId]?.parents || []).slice(0, 2) : [];
  const rightParentIds = rightPersonId ? (people[rightPersonId]?.parents || []).slice(0, 2) : [];

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e7e5e4",
        borderRadius: 24,
        padding: 24,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 24 }}>Navegação por gerações</h2>

      <section style={{ marginTop: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#78716c",
            }}
          >
            Casal em foco
          </div>

          {totalSpouses > 1 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={onPreviousSpouse}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "white",
                  borderRadius: 12,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                ← Cônjuge anterior
              </button>

              <div style={{ color: "#57534e", fontSize: 14 }}>
                {activeSpouseName
                  ? `Cônjuge ${activeSpouseIndex + 1} de ${totalSpouses}: ${activeSpouseName}`
                  : `Sem cônjuge ativo`}
              </div>

              <button
                onClick={onNextSpouse}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "white",
                  borderRadius: 12,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                Cônjuge seguinte →
              </button>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: rightPersonId ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          {leftPersonId && people[leftPersonId] ? (
            <div
              style={{
                display: "grid",
                gap: 16,
                alignContent: "start",
              }}
            >
              <ParentsBlock
                parentIds={leftParentIds}
                people={people}
                sideLabel=" "
                selectedId={selectedId}
                onSelect={onSelect}
              />

              <PersonCard
                fullName={people[leftPersonId].fullName}
                birthDate={people[leftPersonId].birthDate}
                deathDate={people[leftPersonId].deathDate}
                birthPlace={people[leftPersonId].birthPlace}
                photo={people[leftPersonId].photo}
                label="Pessoa em foco"
                highlight={selectedId === leftPersonId || focusId === leftPersonId}
                onClick={() => onSelect(leftPersonId)}
                onDetails={() => onOpenDetails(leftPersonId)}
              />
            </div>
          ) : null}

          {rightPersonId && people[rightPersonId] ? (
            <div
              style={{
                display: "grid",
                gap: 16,
                alignContent: "start",
              }}
            >
              <ParentsBlock
                parentIds={rightParentIds}
                people={people}
                sideLabel=" "
                selectedId={selectedId}
                onSelect={onSelect}
              />

              <PersonCard
                fullName={people[rightPersonId].fullName}
                birthDate={people[rightPersonId].birthDate}
                deathDate={people[rightPersonId].deathDate}
                birthPlace={people[rightPersonId].birthPlace}
                photo={people[rightPersonId].photo}
                label="Cônjuge"
                highlight={selectedId === rightPersonId}
                onClick={() => onSelect(rightPersonId)}
                onDetails={() => onOpenDetails(rightPersonId)}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "#78716c",
            marginBottom: 12,
          }}
        >
          1 geração seguinte
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {descendantIds.length ? (
            descendantIds.map((id) =>
              people[id] ? (
                <PersonCard
                  key={id}
                  fullName={people[id].fullName}
                  birthDate={people[id].birthDate}
                  deathDate={people[id].deathDate}
                  birthPlace={people[id].birthPlace}
                  photo={people[id].photo}
                  compact
                  highlight={selectedId === id}
                  onClick={() => onSelect(id)}
                />
              ) : null,
            )
          ) : (
            <EmptyState text="Sem registos nesta geração." />
          )}
        </div>
      </section>
    </div>
  );
}