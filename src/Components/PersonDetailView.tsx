import type { PeopleMap, Person, TimelineEvent } from "../types";
import { useMemo, useState } from "react";

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
              width: "min(1000px, 100%)",
              background: "#ffffff",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 320px",
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
                <img
                  src={ownLightboxPhoto.url}
                  alt={ownLightboxPhoto.note || "Foto da galeria"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "80vh",
                    display: "block",
                  }}
                />
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
                          Remover: {people[taggedId]?.fullName || taggedId}
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
              width: "min(1000px, 100%)",
              background: "#ffffff",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 320px",
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
                <img
                  src={taggedLightboxPhoto.url}
                  alt={taggedLightboxPhoto.note || "Foto identificada"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "80vh",
                    display: "block",
                  }}
                />
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
                      onClick={() => setLightboxState({ kind: "own", photoId: photo.id })}
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
                      onClick={() =>
                        setLightboxState({
                          kind: "tagged",
                          sourcePersonId: photo.sourcePersonId,
                          photoId: photo.photoId,
                        })
                      }
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