export type PhotoFaceTag = {
  id: string;
  personId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GalleryPhoto = {
  id: string;
  url: string;
  note: string;
  taggedPersonIds: string[];
  faceTags: PhotoFaceTag[];
};

export type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  description: string;
};

export type Person = {
  id: string;
  fullName: string;
  profession: string;
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  story: string;
  photo: string;
  gallery: GalleryPhoto[];
  timeline: TimelineEvent[];
  parents: string[];
  spouses: string[];
  marriageDates: Record<string, string>;
  children: string[];
};

export type PeopleMap = Record<string, Person>;

export type SupabasePersonRow = {
  id: string;
  full_name: string | null;
  profession: string | null;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  story: string | null;
  photo_url: string | null;
  gallery: GalleryPhoto[] | null;
  timeline: TimelineEvent[] | null;
  parents: string[] | null;
  spouses: string[] | null;
  marriage_dates: Record<string, string> | null;
  children: string[] | null;
};

export type Page = "tree" | "auth" | "person";