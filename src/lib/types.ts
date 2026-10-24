export type ChangeType = 'feature' | 'fix' | 'design' | 'content' | 'deploy';

export interface ChangeLogEntry {
  id: string;
  date: string;
  text: string;
  type: ChangeType;
}

export interface Note {
  id: string;
  text: string;
  resolved: boolean;
  explanation: string;
}

/** Same shape as Craft Your Story (Lovable), so the data moved over untouched. */
export interface AppData {
  id: string;
  name: string;
  tag?: string;
  pageTag?: string;
  title?: string;
  desc?: string;
  problem?: string;
  solution?: string;
  primaryBtn?: string;
  previewUrl?: string;
  websiteUrl?: string;
  websiteUrlLabel?: string;
  editUrl?: string;
  editUrlLabel?: string;
  githubUrl?: string;
  githubUrlLabel?: string;
  supabaseProjectUrl?: string;
  supabaseUrlLabel?: string;
  coverImage?: string;
  logoImage?: string;
  category?: string | null;
  tags?: string[];
  purpose?: string;
  hasApi?: boolean;
  createdAt?: string;
  updatedAt?: string;
  linkAddedAt?: string;
  changeLog?: ChangeLogEntry[];
  changeNote?: string;
  changeNoteDate?: string;
  redNotes?: Note[];
  [key: string]: unknown;
}

export interface Category {
  value: string;
  label: string;
  position: number;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
