import { DEFAULT_PHOTO } from "./supabase";
import type { PeopleMap, Person, SupabasePersonRow } from "../types";

export function normalizePerson(row: SupabasePersonRow): Person {
  return {
    id: row.id,
    fullName: row.full_name || "",
    profession: row.profession || "",
    birthDate: row.birth_date || "—",
    deathDate: row.death_date || "—",
    birthPlace: row.birth_place || "—",
    story: row.story || "",
    photo: row.photo_url || DEFAULT_PHOTO,
    gallery: Array.isArray(row.gallery)
      ? row.gallery.map((item) => ({
          id: item.id,
          url: item.url,
          note: item.note || "",
          taggedPersonIds: Array.isArray(item.taggedPersonIds) ? item.taggedPersonIds : [],
        }))
      : [],
    timeline: Array.isArray(row.timeline)
      ? row.timeline.map((item) => ({
          id: item.id,
          date: item.date || "",
          title: item.title || "",
          description: item.description || "",
        }))
      : [],
    parents: Array.isArray(row.parents) ? row.parents : [],
    spouses: Array.isArray(row.spouses) ? row.spouses : [],
    marriageDates:
      row.marriage_dates && typeof row.marriage_dates === "object" ? row.marriage_dates : {},
    children: Array.isArray(row.children) ? row.children : [],
  };
}

export function mapToSupabaseRow(person: Person): SupabasePersonRow {
  return {
    id: person.id,
    full_name: person.fullName,
    profession: person.profession,
    birth_date: person.birthDate,
    death_date: person.deathDate,
    birth_place: person.birthPlace,
    story: person.story,
    photo_url: person.photo,
    gallery: person.gallery,
    timeline: person.timeline,
    parents: person.parents,
    spouses: person.spouses,
    marriage_dates: person.marriageDates,
    children: person.children,
  };
}

export function slugifyId(value: string): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || `pessoa_${Date.now()}`;
}

export function createEmptyPerson(): Person {
  return {
    id: `pessoa_${Date.now()}`,
    fullName: "",
    profession: "",
    birthDate: "",
    deathDate: "",
    birthPlace: "",
    story: "",
    photo: DEFAULT_PHOTO,
    gallery: [],
    timeline: [],
    parents: [],
    spouses: [],
    marriageDates: {},
    children: [],
  };
}

export function getCoupleIds(people: PeopleMap, personId: string): string[] {
  const person = people[personId];
  return person ? [personId, ...(person.spouses || [])].slice(0, 2) : [];
}

export function getAncestorIds(people: PeopleMap, personId: string): string[] {
  return (people[personId]?.parents || []).slice(0, 2);
}

export function getDescendantIds(people: PeopleMap, ids: string[]): string[] {
  return [...new Set(ids.flatMap((id) => people[id]?.children || []))];
}

export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com/i.test((url || "").trim());
}

export function getDisplayPhotoUrl(url: string): string {
  const value = (url || "").trim();
  if (!value) return DEFAULT_PHOTO;

  if (isGoogleDriveUrl(value)) {
    const driveFileMatch = value.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveFileMatch?.[1]) {
      return `https://drive.google.com/thumbnail?id=${driveFileMatch[1]}&sz=w1200`;
    }

    const driveIdMatch = value.match(/[?&]id=([^&]+)/);
    if (driveIdMatch?.[1]) {
      return `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w1200`;
    }
  }

  return value;
}