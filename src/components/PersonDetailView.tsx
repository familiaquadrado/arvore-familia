import type { PeopleMap, Person, PhotoFaceTag, TimelineEvent } from "../types";
import { useEffect, useMemo, useRef, useState } from "react";

type PersonDetailViewProps = {
  person: Person;
  people: PeopleMap;
  editingEnabled?: boolean;
  saveMessage?: string;
  isUploadingPhoto?: boolean;
  galleryNoteDraft: string;
  onBack: () => void;
  onChange?: (nextPerson: Person) => void;
  onSave?: () => void;
  onGalleryNoteDraftChange: (value: string) => void;
  onProfilePhotoUploadClick: () => void;
  onGalleryPhotoUploadClick: () => void;
  onRemoveGalleryPhoto: (photoId: string) => void;
  onOpenPerson?: (personId: string) => void;
};

type TaggedPhotoReference = {
  sourcePersonId: string;
  sourcePersonName: string;
  photoId: string;
  url: string;
  note: string;
  taggedPersonIds: string[];
  faceTags: PhotoFaceTag[];
};

type LightboxState =
  | {
      kind: "own";
      photoId: string;
    }
  | {
      kind: "tagged";
      sourcePersonId: string;
      photoId: string;
    }
  | null;

type DraftFaceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

function PersonLinkChip({
  label,
  personId,
  onOpenPerson,
}: {
  label: string;
  personId: string;
  onOpenPerson?: (personId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenPerson?.(personId)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid #d6d3d1",
        background: "#ffffff",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        color: "#44403c",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function PersonLinkText({
  label,
  personId,
  onOpenPerson,
}: {
  label: string;
  personId: string;
  onOpenPerson?: (personId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenPerson?.(personId)}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        color: "#2563eb",
        cursor: "pointer",
        fontSize: "inherit",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function PersonDetailView({
  person,
  people,
  editingEnabled = true,
  saveMessage = "",
  isUploadingPhoto = false,
  galleryNoteDraft,
  onBack,
  onChange,
  onSave,
  onGalleryNoteDraftChange,
  onProfilePhotoUploadClick,
  onGalleryPhotoUploadClick,
  onRemoveGalleryPhoto,
  onOpenPerson,
}: PersonDetailViewProps) {
  const [lightboxState, setLightboxState] = useState<LightboxState>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [faceMarkingMode, setFaceMarkingMode] = useState(false);
  const [isDrawingFace, setIsDrawingFace] = useState(false);
  const [faceStartPoint, setFaceStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [draftFaceRect, setDraftFaceRect] = useState<DraftFaceRect>(null);

  const imageAreaRef = useRef<HTMLDivElement | null>(null);

  const sortedPeople = useMemo(
    () => Object.values(people).sort((a, b) => a.fullName.localeCompare(b.fullName, "pt")),
    [people],
  );

  const taggedPhotosForPerson = useMemo(() => {
    const references: TaggedPhotoReference[] = [];

    Object.values(people).forEach((sourcePerson) => {
      (sourcePerson.gallery || []).forEach((photo) => {
        if ((photo.taggedPersonIds || []).includes(person.id)) {
          references.push({
            sourcePersonId: sourcePerson.id,
            sourcePersonName: sourcePerson.fullName,
            photoId: photo.id,
            url: photo.url,
            note: photo.note || "",
            taggedPersonIds: photo.taggedPersonIds || [],
            faceTags: Array.isArray(photo.faceTags) ? photo.faceTags : [],
          });
        }
      });
    });

    return references;
  }, [people, person.id]);

  const ownLightboxPhoto = useMemo(() => {
    if (!lightboxState || lightboxState.kind !== "own") return null;
    return (person.gallery || []).find((photo) => photo.id === lightboxState.photoId) || null;
  }, [lightboxState, person.gallery]);

  const taggedLightboxPhoto = useMemo(() => {
    if (!lightboxState || lightboxState.kind !== "tagged") return null;
    return (
      taggedPhotosForPerson.find(
        (photo) =>
          photo.sourcePersonId === lightboxState.sourcePersonId &&
          photo.photoId === lightboxState.photoId,
      ) || null
    );
  }, [lightboxState, taggedPhotosForPerson]);

  useEffect(() => {
    if (!lightboxState) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      setFaceMarkingMode(false);
      setIsDrawingFace(false);
      setFaceStartPoint(null);
      setDraftFaceRect(null);
    }
  }, [lightboxState]);

  function resetZoom() {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }

  function resetFaceDraft() {
    setIsDrawingFace(false);
    setFaceStartPoint(null);
    setDraftFaceRect(null);
  }

  function openOwnLightbox(photoId: string) {
    resetZoom();
    resetFaceDraft();
    setFaceMarkingMode(false);
    setLightboxState({ kind: "own", photoId });
  }

  function openTaggedLightbox(sourcePersonId: string, photoId: string) {
    resetZoom();
    resetFaceDraft();
    setFaceMarkingMode(false);
    setLightboxState({ kind: "tagged", sourcePersonId, photoId });
  }

  function handleZoomWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (faceMarkingMode) return;

    e.preventDefault();

    const delta = -e.deltaY;
    setZoom((currentZoom) => {
      const nextZoom = currentZoom + delta * 0.001;
      return Math.min(Math.max(nextZoom, 0.5), 4);
    });
  }

  function handleDragStart(e: React.MouseEvent<HTMLDivElement>) {
    if (faceMarkingMode) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }

  function handleDragMove(e: React.MouseEvent<HTMLDivElement>) {
    if (faceMarkingMode || !isDragging) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  function getRelativePoint(event: React.MouseEvent<HTMLDivElement>) {
    if (!imageAreaRef.current) return null;

    const rect = imageAreaRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);

    return { x, y };
  }

  function handleFaceDrawStart(event: React.MouseEvent<HTMLDivElement>) {
    if (!editingEnabled || !faceMarkingMode) return;

    const point = getRelativePoint(event);
    if (!point) return;

    setIsDrawingFace(true);
    setFaceStartPoint(point);
    setDraftFaceRect({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });
  }

  function handleFaceDrawMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!editingEnabled || !faceMarkingMode || !isDrawingFace || !faceStartPoint) return;

    const point = getRelativePoint(event);
    if (!point) return;

    const x = Math.min(faceStartPoint.x, point.x);
    const y = Math.min(faceStartPoint.y, point.y);
    const width = Math.abs(point.x - faceStartPoint.x);
    const height = Math.abs(point.y - faceStartPoint.y);

    setDraftFaceRect({
      x,
      y,
      width,
      height,
    });
  }

  function handleFaceDrawEnd() {
    if (!editingEnabled || !faceMarkingMode) return;
    setIsDrawingFace(false);
    setFaceStartPoint(null);
  }

  function updateGalleryPhoto(
    photoId: string,
    updater: (photo: (typeof person.gallery)[number]) => (typeof person.gallery)[number],
  ) {
    onChange?.({
      ...person,
      gallery: (person.gallery || []).map((photo) => (photo.id === photoId ? updater(photo) : photo)),
    });
  }

  function updateGalleryPhotoNote(photoId: string, nextNote: string) {
    updateGalleryPhoto(photoId, (photo) => ({
      ...photo,
      note: nextNote,
    }));
  }

  function toggleTaggedPerson(photoId: string, taggedPersonId: string) {
    updateGalleryPhoto(photoId, (photo) => {
      const currentIds = Array.isArray(photo.taggedPersonIds) ? photo.taggedPersonIds : [];
      const nextIds = currentIds.includes(taggedPersonId)
        ? currentIds.filter((id) => id !== taggedPersonId)
        : [...currentIds, taggedPersonId];

      return {
        ...photo,
        taggedPersonIds: nextIds,
      };
    });
  }

  function addFaceTag(photoId: string, personId: string) {
    if (!draftFaceRect) return;
    if (draftFaceRect.width < 0.03 || draftFaceRect.height < 0.03) return;

    updateGalleryPhoto(photoId, (photo) => {
      const currentFaceTags = Array.isArray(photo.faceTags) ? photo.faceTags : [];
      const currentTaggedIds = Array.isArray(photo.taggedPersonIds) ? photo.taggedPersonIds : [];

      return {
        ...photo,
        taggedPersonIds: currentTaggedIds.includes(personId)
          ? currentTaggedIds
          : [...currentTaggedIds, personId],
        faceTags: [
          ...currentFaceTags,
          {
            id: `face_${Date.now()}`,
            personId,
            x: draftFaceRect.x,
            y: draftFaceRect.y,
            width: draftFaceRect.width,
            height: draftFaceRect.height,
          },
        ],
      };
    });

    resetFaceDraft();
  }

  function removeFaceTag(photoId: string, faceTagId: string) {
    updateGalleryPhoto(photoId, (photo) => ({
      ...photo,
      faceTags: (photo.faceTags || []).filter((tag) => tag.id !== faceTagId),
    }));
  }

  function addParent(parentId: string) {
    if (!parentId) return;
    if (parentId === person.id) return;
    if ((person.parents || []).includes(parentId)) return;
    if ((person.parents || []).length >= 2) return;

    onChange?.({
      ...person,
      parents: [...(person.parents || []), parentId],
    });
  }

  function removeParent(parentId: string) {
    onChange?.({
      ...person,
      parents: (person.parents || []).filter((id) => id !== parentId),
    });
  }

  function addChild(childId: string) {
    if (!childId) return;
    if (childId === person.id) return;
    if ((person.children || []).includes(childId)) return;

    onChange?.({
      ...person,
      children: [...(person.children || []), childId],
    });
  }

  function removeChild(childId: string) {
    onChange?.({
      ...person,
      children: (person.children || []).filter((id) => id !== childId),
    });
  }

  function addSpouse(spouseId: string) {
    if (!spouseId) return;
    if (spouseId === person.id) return;
    if ((person.spouses || []).includes(spouseId)) return;

    onChange?.({
      ...person,
      spouses: [...(person.spouses || []), spouseId],
    });
  }

  function removeSpouse(spouseId: string) {
    const nextMarriageDates = { ...(person.marriageDates || {}) };
    delete nextMarriageDates[spouseId];

    onChange?.({
      ...person,
      spouses: (person.spouses || []).filter((id) => id !== spouseId),
      marriageDates: nextMarriageDates,
    });
  }

  function updateMarriageDate(spouseId: string, value: string) {
    onChange?.({
      ...person,
      marriageDates: {
        ...(person.marriageDates || {}),
        [spouseId]: value,
      },
    });
  }

  function addTimelineEvent() {
    const newEvent: TimelineEvent = {
      id: `timeline_${Date.now()}`,
      date: "",
      title: "",
      description: "",
    };

    onChange?.({
      ...person,
      timeline: [...(person.timeline || []), newEvent],
    });
  }

  function updateTimelineEvent(eventId: string, patch: Partial<TimelineEvent>) {
    onChange?.({
      ...person,
      timeline: (person.timeline || []).map((event) =>
        event.id === eventId ? { ...event, ...patch } : event,
      ),
    });
  }

  function removeTimelineEvent(eventId: string) {
    onChange?.({
      ...person,
      timeline: (person.timeline || []).filter((event) => event.id !== eventId),
    });
  }

  const availableParents = Object.values(people)
    .filter((candidate) => candidate.id !== person.id && !(person.parents || []).includes(candidate.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt"));

  const availableChildren = Object.values(people)
    .filter((candidate) => candidate.id !== person.id && !(person.children || []).includes(candidate.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt"));

  const availableSpouses = Object.values(people)
    .filter((candidate) => candidate.id !== person.id && !(person.spouses || []).includes(candidate.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt"));

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e7e5e4",
        borderRadius: 24,
        padding: 24,
      }}
    >
      {ownLightboxPhoto ? (
        <div
          onClick={() => setLightboxState(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              width: "min(1100px, 100%)",
              background: "#ffffff",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 340px",
                gap: 0,
              }}
            >
              <div
                style={{
                  background: "#111827",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 400,
                }}
              >
                <div
                  ref={imageAreaRef}
                  onWheel={handleZoomWheel}
                  onMouseDown={faceMarkingMode ? handleFaceDrawStart : handleDragStart}
                  onMouseMove={faceMarkingMode ? handleFaceDrawMove : handleDragMove}
                  onMouseUp={faceMarkingMode ? handleFaceDrawEnd : handleDragEnd}
                  onMouseLeave={faceMarkingMode ? handleFaceDrawEnd : handleDragEnd}
                  style={{
                    width: "100%",
                    height: "80vh",
                    overflow: "hidden",
                    cursor: faceMarkingMode
                      ? "crosshair"
                      : isDragging
                        ? "grabbing"
                        : "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <img
                    src={ownLightboxPhoto.url}
                    alt={ownLightboxPhoto.note || "Foto da galeria"}
                    style={{
                      transform: faceMarkingMode
                        ? "none"
                        : `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                      transformOrigin: "center",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: faceMarkingMode ? "100%" : "auto",
                      height: faceMarkingMode ? "100%" : "auto",
                      objectFit: "contain",
                      userSelect: "none",
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />

                  {(ownLightboxPhoto.faceTags || []).map((faceTag) => (
                    <div
                      key={faceTag.id}
                      style={{
                        position: "absolute",
                        left: `${faceTag.x * 100}%`,
                        top: `${faceTag.y * 100}%`,
                        width: `${faceTag.width * 100}%`,
                        height: `${faceTag.height * 100}%`,
                        border: "2px solid #fbbf24",
                        borderRadius: 8,
                        boxSizing: "border-box",
                        pointerEvents: "auto",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPerson?.(faceTag.personId);
                          setLightboxState(null);
                        }}
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "100%",
                          transform: "translateY(6px)",
                          border: "none",
                          background: "#fbbf24",
                          color: "#1c1917",
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {people[faceTag.personId]?.fullName || faceTag.personId}
                      </button>
                    </div>
                  ))}

                  {draftFaceRect ? (
                    <div
                      style={{
                        position: "absolute",
                        left: `${draftFaceRect.x * 100}%`,
                        top: `${draftFaceRect.y * 100}%`,
                        width: `${draftFaceRect.width * 100}%`,
                        height: `${draftFaceRect.height * 100}%`,
                        border: "2px dashed #60a5fa",
                        borderRadius: 8,
                        boxSizing: "border-box",
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  padding: 20,
                  overflowY: "auto",
                  maxHeight: "80vh",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "#78716c",
                    marginBottom: 10,
                  }}
                >
                  Foto
                </div>

                <div style={{ marginBottom: 12, color: "#57534e", fontSize: 14 }}>
                  Zoom: {Math.round(zoom * 100)}%
                </div>

                {!faceMarkingMode ? (
                  <button
                    onClick={resetZoom}
                    style={{
                      marginBottom: 12,
                      border: "1px solid #d6d3d1",
                      background: "white",
                      borderRadius: 12,
                      padding: "10px 12px",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    Reset zoom
                  </button>
                ) : null}

                {editingEnabled ? (
                  <button
                    onClick={() => {
                      setFaceMarkingMode((current) => !current);
                      resetFaceDraft();
                      resetZoom();
                    }}
                    style={{
                      marginBottom: 18,
                      border: "1px solid #d6d3d1",
                      background: faceMarkingMode ? "#292524" : "white",
                      color: faceMarkingMode ? "white" : "#292524",
                      borderRadius: 12,
                      padding: "10px 12px",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    {faceMarkingMode ? "Sair do modo marcar rostos" : "Marcar rostos"}
                  </button>
                ) : null}

                <div style={{ marginBottom: 18 }}>
                  <div style={{ marginBottom: 8, color: "#57534e", fontSize: 14 }}>
                    Descrição
                  </div>

                  {editingEnabled ? (
                    <textarea
                      value={ownLightboxPhoto.note || ""}
                      onChange={(e) => updateGalleryPhotoNote(ownLightboxPhoto.id, e.target.value)}
                      placeholder="Descrição da foto"
                      style={{
                        width: "100%",
                        minHeight: 100,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #d6d3d1",
                        resize: "vertical",
                        fontSize: 14,
                      }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: "#57534e" }}>
                      {ownLightboxPhoto.note || "Sem descrição."}
                    </p>
                  )}
                </div>

                <div>
                  <div style={{ marginBottom: 8, color: "#57534e", fontSize: 14 }}>
                    Pessoas identificadas
                  </div>

                  {(ownLightboxPhoto.taggedPersonIds || []).length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: editingEnabled ? 12 : 0,
                      }}
                    >
                      {(ownLightboxPhoto.taggedPersonIds || []).map((taggedId) => (
                        <PersonLinkChip
                          key={taggedId}
                          label={people[taggedId]?.fullName || taggedId}
                          personId={taggedId}
                          onOpenPerson={(id) => {
                            setLightboxState(null);
                            onOpenPerson?.(id);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px dashed #d6d3d1",
                        background: "#fafaf9",
                        borderRadius: 16,
                        padding: 12,
                        color: "#78716c",
                        fontSize: 14,
                        marginBottom: editingEnabled ? 12 : 0,
                      }}
                    >
                      Sem pessoas identificadas.
                    </div>
                  )}

                  {editingEnabled ? (
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        toggleTaggedPerson(ownLightboxPhoto.id, e.target.value);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #d6d3d1",
                        background: "white",
                        marginBottom: 12,
                      }}
                    >
                      <option value="">Adicionar pessoa identificada...</option>
                      {sortedPeople
                        .filter((candidate) => !(ownLightboxPhoto.taggedPersonIds || []).includes(candidate.id))
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.fullName}
                          </option>
                        ))}
                    </select>
                  ) : null}

                  {editingEnabled && faceMarkingMode && draftFaceRect ? (
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        addFaceTag(ownLightboxPhoto.id, e.target.value);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #d6d3d1",
                        background: "white",
                        marginBottom: 12,
                      }}
                    >
                      <option value="">Associar a caixa desenhada a uma pessoa...</option>
                      {sortedPeople.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.fullName}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {editingEnabled && draftFaceRect ? (
                    <button
                      onClick={resetFaceDraft}
                      style={{
                        marginBottom: 12,
                        border: "1px solid #d6d3d1",
                        background: "white",
                        borderRadius: 12,
                        padding: "10px 12px",
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      Cancelar caixa em desenho
                    </button>
                  ) : null}

                  {editingEnabled && (ownLightboxPhoto.faceTags || []).length ? (
                    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                      {(ownLightboxPhoto.faceTags || []).map((faceTag) => (
                        <button
                          key={faceTag.id}
                          onClick={() => removeFaceTag(ownLightboxPhoto.id, faceTag.id)}
                          style={{
                            border: "1px solid #d6d3d1",
                            background: "white",
                            borderRadius: 12,
                            padding: "8px 10px",
                            cursor: "pointer",
                            fontSize: 14,
                            textAlign: "left",
                          }}
                        >
                          Remover rosto: {people[faceTag.personId]?.fullName || faceTag.personId}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {editingEnabled && (ownLightboxPhoto.taggedPersonIds || []).length ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {(ownLightboxPhoto.taggedPersonIds || []).map((taggedId) => (
                        <button
                          key={taggedId}
                          onClick={() => toggleTaggedPerson(ownLightboxPhoto.id, taggedId)}
                          style={{
                            border: "1px solid #d6d3d1",
                            background: "white",
                            borderRadius: 12,
                            padding: "8px 10px",
                            cursor: "pointer",
                            fontSize: 14,
                            textAlign: "left",
                          }}
                        >
                          Remover identificação: {people[taggedId]?.fullName || taggedId}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => setLightboxState(null)}
                  style={{
                    marginTop: 18,
                    border: "1px solid #d6d3d1",
                    background: "white",
                    color: "#292524",
                    borderRadius: 12,
                    padding: "10px 12px",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {taggedLightboxPhoto ? (
        <div
          onClick={() => setLightboxState(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              width: "min(1100px, 100%)",
              background: "#ffffff",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 340px",
                gap: 0,
              }}
            >
              <div
                style={{
                  background: "#111827",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 400,
                }}
              >
                <div
                  onWheel={handleZoomWheel}
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  style={{
                    width: "100%",
                    height: "80vh",
                    overflow: "hidden",
                    cursor: isDragging ? "grabbing" : "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <img
                    src={taggedLightboxPhoto.url}
                    alt={taggedLightboxPhoto.note || "Foto identificada"}
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                      transformOrigin: "center",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      userSelect: "none",
                      pointerEvents: "none",
                      display: "block",
                    }}
                  />

                  {(taggedLightboxPhoto.faceTags || []).map((faceTag) => (
                    <div
                      key={faceTag.id}
                      style={{
                        position: "absolute",
                        left: `${faceTag.x * 100}%`,
                        top: `${faceTag.y * 100}%`,
                        width: `${faceTag.width * 100}%`,
                        height: `${faceTag.height * 100}%`,
                        border: "2px solid #fbbf24",
                        borderRadius: 8,
                        boxSizing: "border-box",
                        pointerEvents: "auto",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPerson?.(faceTag.personId);
                          setLightboxState(null);
                        }}
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "100%",
                          transform: "translateY(6px)",
                          border: "none",
                          background: "#fbbf24",
                          color: "#1c1917",
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {people[faceTag.personId]?.fullName || faceTag.personId}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: 20,
                  overflowY: "auto",
                  maxHeight: "80vh",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "#78716c",
                    marginBottom: 10,
                  }}
                >
                  Foto identificada
                </div>

                <div style={{ marginBottom: 12, color: "#57534e", fontSize: 14 }}>
                  Zoom: {Math.round(zoom * 100)}%
                </div>

                <button
                  onClick={resetZoom}
                  style={{
                    marginBottom: 18,
                    border: "1px solid #d6d3d1",
                    background: "white",
                    borderRadius: 12,
                    padding: "10px 12px",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Reset zoom
                </button>

                <div
                  style={{
                    fontSize: 14,
                    color: "#57534e",
                    marginBottom: 14,
                  }}
                >
                  Na galeria de{" "}
                  <PersonLinkText
                    label={taggedLightboxPhoto.sourcePersonName}
                    personId={taggedLightboxPhoto.sourcePersonId}
                    onOpenPerson={(id) => {
                      setLightboxState(null);
                      onOpenPerson?.(id);
                    }}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ marginBottom: 8, color: "#57534e", fontSize: 14 }}>
                    Descrição
                  </div>

                  <p style={{ margin: 0, color: "#57534e" }}>
                    {taggedLightboxPhoto.note || "Sem descrição."}
                  </p>
                </div>

                <div>
                  <div style={{ marginBottom: 8, color: "#57534e", fontSize: 14 }}>
                    Pessoas identificadas
                  </div>

                  {(taggedLightboxPhoto.taggedPersonIds || []).length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {(taggedLightboxPhoto.taggedPersonIds || []).map((taggedId) => (
                        <PersonLinkChip
                          key={taggedId}
                          label={people[taggedId]?.fullName || taggedId}
                          personId={taggedId}
                          onOpenPerson={(id) => {
                            setLightboxState(null);
                            onOpenPerson?.(id);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px dashed #d6d3d1",
                        background: "#fafaf9",
                        borderRadius: 16,
                        padding: 12,
                        color: "#78716c",
                        fontSize: 14,
                        marginBottom: 12,
                      }}
                    >
                      Sem pessoas identificadas.
                    </div>
                  )}
                </div>

                {onOpenPerson ? (
                  <button
                    onClick={() => {
                      setLightboxState(null);
                      onOpenPerson(taggedLightboxPhoto.sourcePersonId);
                    }}
                    style={{
                      marginTop: 8,
                      border: "1px solid #d6d3d1",
                      background: "white",
                      color: "#292524",
                      borderRadius: 12,
                      padding: "10px 12px",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    Ir para {taggedLightboxPhoto.sourcePersonName}
                  </button>
                ) : null}

                <button
                  onClick={() => setLightboxState(null)}
                  style={{
                    marginTop: 12,
                    border: "1px solid #d6d3d1",
                    background: "white",
                    color: "#292524",
                    borderRadius: 12,
                    padding: "10px 12px",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        onClick={onBack}
        style={{
          border: "1px solid #d6d3d1",
          background: "white",
          borderRadius: 14,
          padding: "10px 14px",
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        ← Voltar à árvore
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "#f5f5f4",
            border: "1px solid #e7e5e4",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <img
            src={person.photo}
            alt={person.fullName}
            style={{
              width: "100%",
              height: 420,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#92400e",
              marginBottom: 10,
            }}
          >
            Página individual
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div style={{ flex: 1 }}>
              {editingEnabled ? (
                <input
                  value={person.fullName}
                  onChange={(e) =>
                    onChange?.({
                      ...person,
                      fullName: e.target.value,
                    })
                  }
                  placeholder="Nome completo"
                  style={{
                    width: "100%",
                    fontSize: 30,
                    fontWeight: 700,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid #d6d3d1",
                  }}
                />
              ) : (
                <h2 style={{ marginTop: 0, marginBottom: 0 }}>{person.fullName}</h2>
              )}
            </div>

            {editingEnabled ? (
              <button
                onClick={onProfilePhotoUploadClick}
                disabled={isUploadingPhoto}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: isUploadingPhoto ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: isUploadingPhoto ? 0.7 : 1,
                }}
              >
                {isUploadingPhoto ? "A enviar..." : "Upload foto"}
              </button>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ marginBottom: 6, color: "#78716c", fontSize: 14 }}>
                Profissão
              </div>
              {editingEnabled ? (
                <input
                  value={person.profession || ""}
                  onChange={(e) =>
                    onChange?.({
                      ...person,
                      profession: e.target.value,
                    })
                  }
                  placeholder="Profissão"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #d6d3d1",
                  }}
                />
              ) : (
                <div style={{ color: "#57534e" }}>{person.profession || "—"}</div>
              )}
            </div>

            <div>
              <div style={{ marginBottom: 6, color: "#78716c", fontSize: 14 }}>
                Nascimento
              </div>
              {editingEnabled ? (
                <input
                  value={person.birthDate}
                  onChange={(e) =>
                    onChange?.({
                      ...person,
                      birthDate: e.target.value,
                    })
                  }
                  placeholder="Data de nascimento"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #d6d3d1",
                  }}
                />
              ) : (
                <div style={{ color: "#57534e" }}>{person.birthDate}</div>
              )}
            </div>

            <div>
              <div style={{ marginBottom: 6, color: "#78716c", fontSize: 14 }}>
                Falecimento
              </div>
              {editingEnabled ? (
                <input
                  value={person.deathDate}
                  onChange={(e) =>
                    onChange?.({
                      ...person,
                      deathDate: e.target.value,
                    })
                  }
                  placeholder="Data de falecimento"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #d6d3d1",
                  }}
                />
              ) : (
                <div style={{ color: "#57534e" }}>{person.deathDate}</div>
              )}
            </div>

            <div>
              <div style={{ marginBottom: 6, color: "#78716c", fontSize: 14 }}>
                Local de nascimento
              </div>
              {editingEnabled ? (
                <input
                  value={person.birthPlace}
                  onChange={(e) =>
                    onChange?.({
                      ...person,
                      birthPlace: e.target.value,
                    })
                  }
                  placeholder="Local de nascimento"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #d6d3d1",
                  }}
                />
              ) : (
                <div style={{ color: "#57534e" }}>{person.birthPlace}</div>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>História</h3>
            {editingEnabled ? (
              <textarea
                value={person.story}
                onChange={(e) =>
                  onChange?.({
                    ...person,
                    story: e.target.value,
                  })
                }
                placeholder="Escreve aqui a história desta pessoa"
                style={{
                  width: "100%",
                  minHeight: 140,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #d6d3d1",
                  resize: "vertical",
                }}
              />
            ) : (
              <p style={{ color: "#57534e", margin: 0 }}>
                {person.story || "Sem texto ainda."}
              </p>
            )}
          </div>

          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Pais</h3>

            {(person.parents || []).length ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {(person.parents || []).map((parentId) => (
                  <div
                    key={parentId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid #d6d3d1",
                      background: "#fafaf9",
                      borderRadius: 999,
                      padding: "8px 12px",
                    }}
                  >
                    <PersonLinkText
                      label={people[parentId]?.fullName || parentId}
                      personId={parentId}
                      onOpenPerson={onOpenPerson}
                    />

                    {editingEnabled ? (
                      <button
                        onClick={() => removeParent(parentId)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#78716c",
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #d6d3d1",
                  background: "#fafaf9",
                  borderRadius: 20,
                  padding: 16,
                  color: "#78716c",
                  marginBottom: 12,
                }}
              >
                Sem pais definidos.
              </div>
            )}

            {editingEnabled ? (
              <select
                value=""
                onChange={(e) => addParent(e.target.value)}
                disabled={(person.parents || []).length >= 2}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #d6d3d1",
                  background: "white",
                }}
              >
                <option value="">
                  {(person.parents || []).length >= 2
                    ? "Máximo de 2 pais selecionados"
                    : "Adicionar pai ou mãe..."}
                </option>
                {availableParents.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Filhos</h3>

            {(person.children || []).length ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {(person.children || []).map((childId) => (
                  <div
                    key={childId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid #d6d3d1",
                      background: "#fafaf9",
                      borderRadius: 999,
                      padding: "8px 12px",
                    }}
                  >
                    <PersonLinkText
                      label={people[childId]?.fullName || childId}
                      personId={childId}
                      onOpenPerson={onOpenPerson}
                    />

                    {editingEnabled ? (
                      <button
                        onClick={() => removeChild(childId)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#78716c",
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #d6d3d1",
                  background: "#fafaf9",
                  borderRadius: 20,
                  padding: 16,
                  color: "#78716c",
                  marginBottom: 12,
                }}
              >
                Sem filhos definidos.
              </div>
            )}

            {editingEnabled ? (
              <select
                value=""
                onChange={(e) => addChild(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #d6d3d1",
                  background: "white",
                }}
              >
                <option value="">Adicionar filho...</option>
                {availableChildren.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Cônjuges</h3>

            {(person.spouses || []).length ? (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {(person.spouses || []).map((spouseId) => (
                  <div
                    key={spouseId}
                    style={{
                      border: "1px solid #d6d3d1",
                      background: "#fafaf9",
                      borderRadius: 16,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        <PersonLinkText
                          label={people[spouseId]?.fullName || spouseId}
                          personId={spouseId}
                          onOpenPerson={onOpenPerson}
                        />
                      </div>

                      {editingEnabled ? (
                        <button
                          onClick={() => removeSpouse(spouseId)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "#78716c",
                            fontSize: 14,
                          }}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>

                    <div>
                      <div style={{ marginBottom: 6, color: "#78716c", fontSize: 13 }}>
                        Data de casamento
                      </div>

                      {editingEnabled ? (
                        <input
                          value={(person.marriageDates || {})[spouseId] || ""}
                          onChange={(e) => updateMarriageDate(spouseId, e.target.value)}
                          placeholder="Ex.: 12/06/1967"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #d6d3d1",
                            background: "white",
                          }}
                        />
                      ) : (
                        <div style={{ color: "#57534e", fontSize: 14 }}>
                          {(person.marriageDates || {})[spouseId] || "—"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #d6d3d1",
                  background: "#fafaf9",
                  borderRadius: 20,
                  padding: 16,
                  color: "#78716c",
                  marginBottom: 12,
                }}
              >
                Sem cônjuges definidos.
              </div>
            )}

            {editingEnabled ? (
              <select
                value=""
                onChange={(e) => addSpouse(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #d6d3d1",
                  background: "white",
                  marginTop: 12,
                }}
              >
                <option value="">Adicionar cônjuge...</option>
                {availableSpouses.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div style={{ marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Cronologia</h3>

              {editingEnabled ? (
                <button
                  onClick={addTimelineEvent}
                  style={{
                    border: "1px solid #d6d3d1",
                    background: "white",
                    borderRadius: 12,
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                >
                  Adicionar evento
                </button>
              ) : null}
            </div>

            {(person.timeline || []).length ? (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {(person.timeline || []).map((event) => (
                  <div
                    key={event.id}
                    style={{
                      border: "1px solid #e7e5e4",
                      background: "#fafaf9",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    {editingEnabled ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <input
                          value={event.date}
                          onChange={(e) => updateTimelineEvent(event.id, { date: e.target.value })}
                          placeholder="Data"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #d6d3d1",
                          }}
                        />

                        <input
                          value={event.title}
                          onChange={(e) => updateTimelineEvent(event.id, { title: e.target.value })}
                          placeholder="Título do evento"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #d6d3d1",
                          }}
                        />

                        <textarea
                          value={event.description}
                          onChange={(e) =>
                            updateTimelineEvent(event.id, { description: e.target.value })
                          }
                          placeholder="Descrição"
                          style={{
                            width: "100%",
                            minHeight: 90,
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid #d6d3d1",
                            resize: "vertical",
                          }}
                        />

                        <button
                          onClick={() => removeTimelineEvent(event.id)}
                          style={{
                            border: "1px solid #d6d3d1",
                            background: "white",
                            borderRadius: 12,
                            padding: "8px 12px",
                            cursor: "pointer",
                            justifySelf: "start",
                          }}
                        >
                          Remover evento
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ color: "#78716c", fontSize: 14, marginBottom: 6 }}>
                          {event.date || "—"}
                        </div>
                        <div style={{ color: "#292524", fontWeight: 700, marginBottom: 6 }}>
                          {event.title || "Sem título"}
                        </div>
                        <div style={{ color: "#57534e", fontSize: 14 }}>
                          {event.description || "Sem descrição."}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #d6d3d1",
                  background: "#fafaf9",
                  borderRadius: 20,
                  padding: 16,
                  color: "#78716c",
                }}
              >
                Sem eventos na cronologia.
              </div>
            )}
          </div>

          {editingEnabled ? (
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={onSave}
                style={{
                  border: "1px solid #15803d",
                  background: "#16a34a",
                  color: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                Guardar alterações
              </button>

              {saveMessage ? (
                <span style={{ color: "#15803d", fontSize: 14 }}>{saveMessage}</span>
              ) : null}
            </div>
          ) : null}

          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Galeria</h3>

            {editingEnabled ? (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <input
                  value={galleryNoteDraft}
                  onChange={(e) => onGalleryNoteDraftChange(e.target.value)}
                  placeholder="Descrição da próxima foto (opcional)"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #d6d3d1",
                  }}
                />

                <div>
                  <button
                    onClick={onGalleryPhotoUploadClick}
                    disabled={isUploadingPhoto}
                    style={{
                      border: "1px solid #d6d3d1",
                      background: "white",
                      borderRadius: 14,
                      padding: "10px 14px",
                      cursor: isUploadingPhoto ? "default" : "pointer",
                      opacity: isUploadingPhoto ? 0.7 : 1,
                    }}
                  >
                    {isUploadingPhoto ? "A enviar..." : "Adicionar foto"}
                  </button>
                </div>
              </div>
            ) : null}

            {person.gallery.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                {person.gallery.map((photo) => (
                  <div
                    key={photo.id}
                    style={{
                      border: "1px solid #e7e5e4",
                      background: "#fafaf9",
                      borderRadius: 18,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.note || "Foto da galeria"}
                      onClick={() => openOwnLightbox(photo.id)}
                      style={{
                        width: "100%",
                        height: 180,
                        objectFit: "cover",
                        display: "block",
                        cursor: "pointer",
                      }}
                    />

                    <div style={{ padding: 12 }}>
                      {editingEnabled ? (
                        <textarea
                          value={photo.note || ""}
                          onChange={(e) => updateGalleryPhotoNote(photo.id, e.target.value)}
                          placeholder="Descrição da foto"
                          style={{
                            width: "100%",
                            minHeight: 72,
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid #d6d3d1",
                            resize: "vertical",
                            fontSize: 14,
                            color: "#57534e",
                          }}
                        />
                      ) : (
                        <p
                          style={{
                            margin: 0,
                            color: "#57534e",
                            fontSize: 14,
                            minHeight: 40,
                          }}
                        >
                          {photo.note || "Sem descrição."}
                        </p>
                      )}

                      {(photo.taggedPersonIds || []).length ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 10,
                          }}
                        >
                          {(photo.taggedPersonIds || []).map((taggedId) => (
                            <PersonLinkChip
                              key={taggedId}
                              label={people[taggedId]?.fullName || taggedId}
                              personId={taggedId}
                              onOpenPerson={onOpenPerson}
                            />
                          ))}
                        </div>
                      ) : null}

                      {editingEnabled ? (
                        <div style={{ marginTop: 10 }}>
                          <button
                            onClick={() => onRemoveGalleryPhoto(photo.id)}
                            style={{
                              border: "1px solid #d6d3d1",
                              background: "white",
                              borderRadius: 12,
                              padding: "8px 10px",
                              cursor: "pointer",
                              fontSize: 14,
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #d6d3d1",
                  background: "#fafaf9",
                  borderRadius: 20,
                  padding: 16,
                  color: "#78716c",
                }}
              >
                Sem fotos na galeria desta pessoa.
              </div>
            )}
          </div>

          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Fotos em que esta pessoa foi identificada</h3>

            {taggedPhotosForPerson.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                {taggedPhotosForPerson.map((photo) => (
                  <div
                    key={`${photo.sourcePersonId}_${photo.photoId}`}
                    style={{
                      border: "1px solid #e7e5e4",
                      background: "#fafaf9",
                      borderRadius: 18,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.note || "Foto identificada"}
                      onClick={() => openTaggedLightbox(photo.sourcePersonId, photo.photoId)}
                      style={{
                        width: "100%",
                        height: 180,
                        objectFit: "cover",
                        display: "block",
                        cursor: "pointer",
                      }}
                    />

                    <div style={{ padding: 12 }}>
                      <div
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#78716c",
                          marginBottom: 8,
                        }}
                      >
                        Na galeria de{" "}
                        <PersonLinkText
                          label={photo.sourcePersonName}
                          personId={photo.sourcePersonId}
                          onOpenPerson={onOpenPerson}
                        />
                      </div>

                      <p
                        style={{
                          margin: 0,
                          color: "#57534e",
                          fontSize: 14,
                          marginBottom: 10,
                        }}
                      >
                        {photo.note || "Sem descrição."}
                      </p>

                      {(photo.taggedPersonIds || []).length ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          {(photo.taggedPersonIds || []).map((taggedId) => (
                            <PersonLinkChip
                              key={taggedId}
                              label={people[taggedId]?.fullName || taggedId}
                              personId={taggedId}
                              onOpenPerson={onOpenPerson}
                            />
                          ))}
                        </div>
                      ) : null}

                      {onOpenPerson ? (
                        <button
                          onClick={() => onOpenPerson(photo.sourcePersonId)}
                          style={{
                            border: "1px solid #d6d3d1",
                            background: "white",
                            borderRadius: 12,
                            padding: "8px 10px",
                            cursor: "pointer",
                            fontSize: 14,
                            width: "100%",
                          }}
                        >
                          Ir para {photo.sourcePersonName}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #d6d3d1",
                  background: "#fafaf9",
                  borderRadius: 20,
                  padding: 16,
                  color: "#78716c",
                }}
              >
                Ainda não existem fotos de outras galerias em que esta pessoa tenha sido identificada.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}