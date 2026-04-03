import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import TreeView from "./components/TreeView";
import PersonDetailView from "./components/PersonDetailView";
import GlobalFamilyTreeManualView from "./components/GlobalFamilyTreeManualView";
import { FALLBACK_PEOPLE } from "./data/fallbackPeople";
import {
  createEmptyPerson,
  getDescendantIds,
  mapToSupabaseRow,
  normalizePerson,
  slugifyId,
} from "./lib/helpers";
import { ADMIN_EMAIL, PHOTO_BUCKET, supabase } from "./lib/supabase";
import type { GalleryPhoto, PeopleMap, Person, SupabasePersonRow } from "./types";

function extractSortableYear(value: string): number {
  const text = (value || "").trim();
  if (!text || text === "—") return Number.POSITIVE_INFINITY;

  const fourDigitYearMatch = text.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  if (fourDigitYearMatch) {
    return Number(fourDigitYearMatch[1]);
  }

  const anyNumberMatch = text.match(/\d+/);
  if (anyNumberMatch) {
    return Number(anyNumberMatch[0]);
  }

  return Number.POSITIVE_INFINITY;
}

function extractBirthYearLabel(value: string): string {
  const text = (value || "").trim();
  if (!text || text === "—") return "sem ano";

  const fourDigitYearMatch = text.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  if (fourDigitYearMatch) {
    return fourDigitYearMatch[1];
  }

  return text;
}

export default function App() {
  const [people, setPeople] = useState<PeopleMap>(FALLBACK_PEOPLE);
  const [focusId, setFocusId] = useState("jose");
  const [selectedId, setSelectedId] = useState("jose");
  const [page, setPage] = useState<"tree" | "person" | "auth" | "globalTreeManual">("tree");

  const [draftPerson, setDraftPerson] = useState<Person | null>(null);
  const [isCreatingPerson, setIsCreatingPerson] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState(ADMIN_EMAIL);
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [saveMessage, setSaveMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [galleryNoteDraft, setGalleryNoteDraft] = useState("");
  const [activeSpouseIndex, setActiveSpouseIndex] = useState(0);

  const [focusSearch, setFocusSearch] = useState("");
  const [focusQuery, setFocusQuery] = useState("");
  const [isFocusDropdownOpen, setIsFocusDropdownOpen] = useState(false);

  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const galleryPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const focusDropdownRef = useRef<HTMLDivElement | null>(null);

  const editingEnabled = Boolean(session);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session ?? null);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPeople() {
      setIsLoading(true);
      setLoadError("");

      try {
        const { data, error } = await supabase.from("people").select("*");
        if (error) throw error;

        if (!mounted) return;

        if (!data || data.length === 0) {
          setPeople(FALLBACK_PEOPLE);
        } else {
          const mapped = Object.fromEntries(
            (data as SupabasePersonRow[]).map((row) => [row.id, normalizePerson(row)]),
          );
          setPeople(mapped);
        }
      } catch {
        if (!mounted) return;
        setPeople(FALLBACK_PEOPLE);
        setLoadError("Não foi possível carregar os dados do Supabase. A mostrar dados locais.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPeople();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveSpouseIndex(0);
  }, [focusId]);

  useEffect(() => {
    const focusPerson = people[focusId];
    if (!focusPerson) return;

    const label = `${focusPerson.fullName} — ${extractBirthYearLabel(focusPerson.birthDate)}`;
    setFocusSearch(label);

    if (!isFocusDropdownOpen) {
      setFocusQuery("");
    }
  }, [focusId, people, isFocusDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!focusDropdownRef.current) return;
      if (!focusDropdownRef.current.contains(event.target as Node)) {
        setIsFocusDropdownOpen(false);
        setFocusQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selected = useMemo<Person | undefined>(() => {
    if (draftPerson) return draftPerson;
    return people[selectedId];
  }, [people, selectedId, draftPerson]);

  const focusPerson = people[focusId];
  const focusSpouseIds = focusPerson?.spouses || [];
  const totalSpouses = focusSpouseIds.length;
  const clampedSpouseIndex =
    totalSpouses > 0 ? Math.min(activeSpouseIndex, totalSpouses - 1) : 0;
  const activeSpouseId = totalSpouses > 0 ? focusSpouseIds[clampedSpouseIndex] : null;

  const focusCoupleIds = activeSpouseId ? [focusId, activeSpouseId] : [focusId];
  const ancestorIds =
    selected && !isCreatingPerson ? (people[selected.id]?.parents || []).slice(0, 2) : [];

  const descendantIds = useMemo(() => {
    const ids = getDescendantIds(people, focusCoupleIds);

    return [...ids].sort((a, b) => {
      const personA = people[a];
      const personB = people[b];

      const yearA = extractSortableYear(personA?.birthDate || "");
      const yearB = extractSortableYear(personB?.birthDate || "");

      if (yearA !== yearB) {
        return yearA - yearB;
      }

      return (personA?.fullName || "").localeCompare(personB?.fullName || "", "pt");
    });
  }, [people, focusCoupleIds]);

  const sortedPeopleForFocus = useMemo(() => {
    return Object.values(people)
      .sort((a, b) => {
        const byName = a.fullName.localeCompare(b.fullName, "pt");
        if (byName !== 0) return byName;
        return extractSortableYear(a.birthDate) - extractSortableYear(b.birthDate);
      })
      .map((person) => ({
        id: person.id,
        label: `${person.fullName} — ${extractBirthYearLabel(person.birthDate)}`,
      }));
  }, [people]);

  const filteredPeopleForFocus = useMemo(() => {
    const query = focusQuery.trim().toLowerCase();
    if (!query) return sortedPeopleForFocus;

    return sortedPeopleForFocus.filter((item) =>
      item.label.toLowerCase().includes(query),
    );
  }, [sortedPeopleForFocus, focusQuery]);

  async function handleAuthSubmit() {
    setIsAuthLoading(true);
    setAuthError("");
    setAuthStatus("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) throw error;

      setAuthStatus("Login efetuado com sucesso.");
      setPage("tree");
    } catch (error: any) {
      setAuthError(error?.message || "Não foi possível autenticar.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message || "Não foi possível terminar sessão.");
      return;
    }

    setAuthStatus("Sessão terminada.");
    setAuthError("");
    setSaveMessage("");
    setDraftPerson(null);
    setIsCreatingPerson(false);
    setPage("tree");
  }

  function startCreatingPerson() {
    setDraftPerson(createEmptyPerson());
    setIsCreatingPerson(true);
    setSaveMessage("");
    setGalleryNoteDraft("");
    setPage("person");
  }

  function selectFocusPerson(personId: string) {
    const person = people[personId];
    if (!person) return;

    setFocusId(personId);
    setSelectedId(personId);
    setFocusSearch(`${person.fullName} — ${extractBirthYearLabel(person.birthDate)}`);
    setFocusQuery("");
    setIsFocusDropdownOpen(false);
  }

  function openPersonDetail(personId: string) {
    setSelectedId(personId);
    setFocusId(personId);
    setSaveMessage("");
    setGalleryNoteDraft("");
    setDraftPerson(null);
    setIsCreatingPerson(false);
    setPage("person");
    setFocusQuery("");
    setIsFocusDropdownOpen(false);
  }

  async function uploadPhotoToSupabase(file: File, personId: string, folder: "profile" | "gallery") {
    const safePersonId = slugifyId(personId || "pessoa");
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${safePersonId}/${folder}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error("Não foi possível obter o URL público da foto.");
    }

    return data.publicUrl;
  }

  async function handleProfilePhotoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;

    if (!session) {
      setSaveMessage("Tens de iniciar sessão para enviar fotos.");
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setSaveMessage("");

      const targetId = selected.id || selected.fullName || `pessoa_${Date.now()}`;
      const publicUrl = await uploadPhotoToSupabase(file, targetId, "profile");

      if (draftPerson || isCreatingPerson) {
        setDraftPerson({
          ...selected,
          photo: publicUrl,
        });
      } else {
        setPeople((current) => ({
          ...current,
          [selected.id]: {
            ...current[selected.id],
            photo: publicUrl,
          },
        }));
      }

      setSaveMessage("Foto principal carregada. Clica em guardar alterações.");
    } catch (error: any) {
      setSaveMessage(error?.message || "Erro ao enviar a foto principal.");
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  }

  async function handleGalleryPhotoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;

    if (!session) {
      setSaveMessage("Tens de iniciar sessão para enviar fotos.");
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setSaveMessage("");

      const targetId = selected.id || selected.fullName || `pessoa_${Date.now()}`;
      const publicUrl = await uploadPhotoToSupabase(file, targetId, "gallery");

      const newPhoto: GalleryPhoto = {
        id: `gallery_${Date.now()}`,
        url: publicUrl,
        note: galleryNoteDraft.trim(),
        taggedPersonIds: [],
      };

      if (draftPerson || isCreatingPerson) {
        setDraftPerson({
          ...selected,
          gallery: [...(selected.gallery || []), newPhoto],
        });
      } else {
        setPeople((current) => ({
          ...current,
          [selected.id]: {
            ...current[selected.id],
            gallery: [...(current[selected.id].gallery || []), newPhoto],
          },
        }));
      }

      setGalleryNoteDraft("");
      setSaveMessage("Foto adicionada à galeria. Clica em guardar alterações.");
    } catch (error: any) {
      setSaveMessage(error?.message || "Erro ao enviar a foto da galeria.");
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  }

  function removeGalleryPhoto(photoId: string) {
    if (!selected) return;

    if (draftPerson || isCreatingPerson) {
      setDraftPerson({
        ...selected,
        gallery: (selected.gallery || []).filter((photo) => photo.id !== photoId),
      });
    } else {
      setPeople((current) => ({
        ...current,
        [selected.id]: {
          ...current[selected.id],
          gallery: (current[selected.id].gallery || []).filter((photo) => photo.id !== photoId),
        },
      }));
    }

    setSaveMessage("Foto removida da galeria. Clica em guardar alterações.");
  }

  async function savePersonToSupabase(person: Person) {
    if (!session) {
      setSaveMessage("Tens de iniciar sessão para guardar alterações.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const finalId = isCreatingPerson
        ? slugifyId(person.fullName || `pessoa_${Date.now()}`)
        : person.id;

      const previousPerson = people[person.id] || null;

      const prepared: Person = {
        ...person,
        id: finalId,
        fullName: person.fullName.trim(),
        profession: (person.profession || "").trim(),
        birthDate: person.birthDate.trim() || "—",
        deathDate: person.deathDate.trim() || "—",
        birthPlace: person.birthPlace.trim() || "—",
        story: person.story.trim(),
        photo: person.photo,
        gallery: Array.isArray(person.gallery) ? person.gallery : [],
        timeline: Array.isArray(person.timeline) ? person.timeline : [],
        parents: Array.isArray(person.parents) ? person.parents.slice(0, 2) : [],
        spouses: Array.isArray(person.spouses) ? person.spouses : [],
        marriageDates:
          person.marriageDates && typeof person.marriageDates === "object"
            ? person.marriageDates
            : {},
        children: Array.isArray(person.children) ? person.children : [],
      };

      if (!prepared.fullName) {
        setSaveMessage("O nome completo é obrigatório.");
        return;
      }

      const nextPeople: PeopleMap = {
        ...people,
        [prepared.id]: prepared,
      };

      const touchedIds = new Set<string>([prepared.id]);

      const previousParentIds = new Set(previousPerson?.parents || []);
      const currentParentIds = new Set(prepared.parents || []);
      const allRelevantParentIds = new Set<string>([
        ...Array.from(previousParentIds),
        ...Array.from(currentParentIds),
      ]);

      for (const parentId of allRelevantParentIds) {
        const parent = nextPeople[parentId];
        if (!parent) continue;

        const shouldContainChild = currentParentIds.has(parentId);

        nextPeople[parentId] = {
          ...parent,
          children: shouldContainChild
            ? parent.children.includes(prepared.id)
              ? parent.children
              : [...parent.children, prepared.id]
            : parent.children.filter((childId) => childId !== prepared.id),
        };

        touchedIds.add(parentId);
      }

      const previousChildIds = new Set(previousPerson?.children || []);
      const currentChildIds = new Set(prepared.children || []);
      const allRelevantChildIds = new Set<string>([
        ...Array.from(previousChildIds),
        ...Array.from(currentChildIds),
      ]);

      for (const childId of allRelevantChildIds) {
        const child = nextPeople[childId];
        if (!child) continue;

        const shouldContainParent = currentChildIds.has(childId);

        const existingParents = Array.isArray(child.parents) ? child.parents : [];
        let nextParents = existingParents;

        if (shouldContainParent) {
          if (!existingParents.includes(prepared.id)) {
            if (existingParents.length < 2) {
              nextParents = [...existingParents, prepared.id];
            } else {
              nextParents = [existingParents[0], prepared.id];
            }
          }
        } else {
          nextParents = existingParents.filter((parentId) => parentId !== prepared.id);
        }

        nextPeople[childId] = {
          ...child,
          parents: nextParents,
        };

        touchedIds.add(childId);
      }

      const previousSpouseIds = new Set(previousPerson?.spouses || []);
      const currentSpouseIds = new Set(prepared.spouses || []);
      const allRelevantSpouseIds = new Set<string>([
        ...Array.from(previousSpouseIds),
        ...Array.from(currentSpouseIds),
      ]);

      for (const spouseId of allRelevantSpouseIds) {
        const spouse = nextPeople[spouseId];
        if (!spouse) continue;

        const shouldContainSpouse = currentSpouseIds.has(spouseId);
        const spouseMarriageDate = prepared.marriageDates?.[spouseId] || "";
        const nextMarriageDates = { ...(spouse.marriageDates || {}) };

        if (shouldContainSpouse) {
          nextMarriageDates[prepared.id] = spouseMarriageDate;
        } else {
          delete nextMarriageDates[prepared.id];
        }

        nextPeople[spouseId] = {
          ...spouse,
          spouses: shouldContainSpouse
            ? spouse.spouses.includes(prepared.id)
              ? spouse.spouses
              : [...spouse.spouses, prepared.id]
            : spouse.spouses.filter((id) => id !== prepared.id),
          marriageDates: nextMarriageDates,
        };

        touchedIds.add(spouseId);
      }

      const rowsToSave = Array.from(touchedIds)
        .map((id) => nextPeople[id])
        .filter((item): item is Person => Boolean(item));

      const { error } = await supabase
        .from("people")
        .upsert(rowsToSave.map((item) => mapToSupabaseRow(item)));

      if (error) throw error;

      setPeople(nextPeople);
      setSelectedId(prepared.id);
      setFocusId(prepared.id);
      setDraftPerson(null);
      setIsCreatingPerson(false);
      setSaveMessage(
        isCreatingPerson
          ? "Pessoa criada no Supabase."
          : "Alterações guardadas no Supabase.",
      );
    } catch (error: any) {
      setSaveMessage(error?.message || "Erro ao guardar no Supabase.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
        <div
          style={{
            background: "white",
            border: "1px solid #e7e5e4",
            borderRadius: 24,
            padding: 24,
          }}
        >
          A carregar dados…
        </div>
      </div>
    );
  }

  if (!selected || !focusPerson) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
        <div
          style={{
            background: "white",
            border: "1px solid #e7e5e4",
            borderRadius: 24,
            padding: 24,
          }}
        >
          Sem dados para mostrar.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
      <input
        ref={profilePhotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleProfilePhotoFileChange}
      />

      <input
        ref={galleryPhotoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleGalleryPhotoFileChange}
      />

      <div
        style={{
          background: "white",
          border: "1px solid #e7e5e4",
          borderRadius: 24,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#92400e",
          }}
        >
          Arquivo da Família
        </div>

        <h1 style={{ marginTop: 8, marginBottom: 8 }}>Árvore Genealógica Interativa</h1>

        <p style={{ color: "#57534e", margin: 0 }}>Projeto modular em React.</p>

        {loadError ? <p style={{ color: "#b45309", marginTop: 12 }}>{loadError}</p> : null}

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {page === "tree" ? (
            <div
              ref={focusDropdownRef}
              style={{
                position: "relative",
                minWidth: 320,
                flex: "1 1 320px",
                maxWidth: 460,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #d6d3d1",
                  borderRadius: 14,
                  background: "white",
                  overflow: "hidden",
                }}
              >
                <input
                  value={isFocusDropdownOpen ? focusQuery : focusSearch}
                  onChange={(e) => {
                    setFocusQuery(e.target.value);
                    setIsFocusDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setFocusQuery("");
                    setIsFocusDropdownOpen(true);
                  }}
                  placeholder="Escolher pessoa em foco"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setIsFocusDropdownOpen((open) => {
                      const next = !open;
                      if (next) {
                        setFocusQuery("");
                      }
                      return next;
                    });
                  }}
                  style={{
                    border: "none",
                    borderLeft: "1px solid #e7e5e4",
                    background: "white",
                    padding: "10px 12px",
                    cursor: "pointer",
                    color: "#57534e",
                  }}
                >
                  ▾
                </button>
              </div>

              {isFocusDropdownOpen ? (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #e7e5e4",
                    borderRadius: 14,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    maxHeight: 280,
                    overflowY: "auto",
                    zIndex: 50,
                  }}
                >
                  {filteredPeopleForFocus.length ? (
                    filteredPeopleForFocus.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectFocusPerson(item.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          borderBottom: "1px solid #f5f5f4",
                          background: item.id === focusId ? "#fef3c7" : "white",
                          cursor: "pointer",
                          color: "#292524",
                        }}
                      >
                        {item.label}
                      </button>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: "12px",
                        color: "#78716c",
                      }}
                    >
                      Sem resultados.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {page === "tree" ? (
            <button
              onClick={() => setPage("globalTreeManual")}
              style={{
                border: "1px solid #d6d3d1",
                background: "white",
                borderRadius: 14,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Ver árvore global manual
            </button>
          ) : null}

          {page === "person" || page === "globalTreeManual" ? (
            <button
              onClick={() => {
                setSaveMessage("");
                setGalleryNoteDraft("");
                setDraftPerson(null);
                setIsCreatingPerson(false);
                setPage("tree");
              }}
              style={{
                border: "1px solid #d6d3d1",
                background: "white",
                borderRadius: 14,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              ← Voltar à árvore
            </button>
          ) : null}

          {session ? (
            <>
              <button
                onClick={startCreatingPerson}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                Nova pessoa
              </button>

              <button
                onClick={handleLogout}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                Terminar sessão
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setAuthError("");
                setAuthStatus("");
                setPage("auth");
              }}
              style={{
                border: "1px solid #d6d3d1",
                background: "white",
                borderRadius: 14,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Entrar para editar
            </button>
          )}
        </div>

        {session?.user?.email ? (
          <p style={{ color: "#166534", marginTop: 12, marginBottom: 0 }}>
            Sessão ativa: {session.user.email}
          </p>
        ) : null}
      </div>

      {page === "tree" ? (
        <TreeView
          people={people}
          selectedId={selectedId}
          focusId={focusId}
          focusCoupleIds={focusCoupleIds}
          ancestorIds={ancestorIds}
          descendantIds={descendantIds}
          activeSpouseId={activeSpouseId}
          activeSpouseIndex={clampedSpouseIndex}
          totalSpouses={totalSpouses}
          onSelect={(id) => {
            setFocusId(id);
            setSelectedId(id);
          }}
          onOpenDetails={(id) => {
            setSelectedId(id);
            setSaveMessage("");
            setGalleryNoteDraft("");
            setDraftPerson(null);
            setIsCreatingPerson(false);
            setPage("person");
          }}
          onPreviousSpouse={() => {
            if (totalSpouses <= 1) return;
            setActiveSpouseIndex((current) =>
              current === 0 ? totalSpouses - 1 : current - 1,
            );
          }}
          onNextSpouse={() => {
            if (totalSpouses <= 1) return;
            setActiveSpouseIndex((current) =>
              current === totalSpouses - 1 ? 0 : current + 1,
            );
          }}
        />
      ) : page === "auth" ? (
        <div
          style={{
            background: "white",
            border: "1px solid #e7e5e4",
            borderRadius: 24,
            padding: 24,
            maxWidth: 700,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#92400e",
              marginBottom: 10,
            }}
          >
            Acesso privado
          </div>

          <h2 style={{ marginTop: 0 }}>Entrar para editar a árvore</h2>

          <div style={{ display: "grid", gap: 14 }}>
            <input
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="seu-email@exemplo.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #d6d3d1",
              }}
            />

            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="********"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #d6d3d1",
              }}
            />

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleAuthSubmit}
                disabled={isAuthLoading || !authEmail || !authPassword}
                style={{
                  border: "1px solid #292524",
                  background: "#292524",
                  color: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                  opacity: isAuthLoading ? 0.7 : 1,
                }}
              >
                {isAuthLoading ? "A autenticar..." : "Entrar"}
              </button>

              <button
                onClick={() => setPage("tree")}
                style={{
                  border: "1px solid #d6d3d1",
                  background: "white",
                  borderRadius: 14,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                Voltar
              </button>
            </div>

            {authStatus ? <p style={{ color: "#166534", margin: 0 }}>{authStatus}</p> : null}
            {authError ? <p style={{ color: "#b91c1c", margin: 0 }}>{authError}</p> : null}
          </div>
        </div>
      ) : page === "globalTreeManual" ? (
        <GlobalFamilyTreeManualView
          people={people}
          editingEnabled={editingEnabled}
          onBack={() => setPage("tree")}
          onOpenPerson={openPersonDetail}
        />
      ) : (
        <PersonDetailView
          person={selected}
          people={people}
          editingEnabled={editingEnabled}
          saveMessage={isSaving ? "A guardar..." : saveMessage}
          isUploadingPhoto={isUploadingPhoto}
          galleryNoteDraft={galleryNoteDraft}
          onBack={() => {
            setSaveMessage("");
            setGalleryNoteDraft("");
            setDraftPerson(null);
            setIsCreatingPerson(false);
            setPage("tree");
          }}
          onChange={(nextPerson) => {
            if (isCreatingPerson || draftPerson) {
              setDraftPerson(nextPerson);
            } else {
              setPeople((current) => ({
                ...current,
                [nextPerson.id]: nextPerson,
              }));
            }
          }}
          onSave={() => savePersonToSupabase(selected)}
          onGalleryNoteDraftChange={setGalleryNoteDraft}
          onProfilePhotoUploadClick={() => profilePhotoInputRef.current?.click()}
          onGalleryPhotoUploadClick={() => galleryPhotoInputRef.current?.click()}
          onRemoveGalleryPhoto={removeGalleryPhoto}
          onOpenPerson={openPersonDetail}
        />
      )}
    </div>
  );
}