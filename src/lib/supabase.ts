import { createClient } from '@supabase/supabase-js';

// cultura-GH: the shared project for Anat's GitHub apps. Tables use the aoa_ prefix.
export const SUPABASE_URL = 'https://ktqmwpbzcnzkhjskqisy.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';
export const BUCKET = 'aoa-media';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const KEY_STORE = 'aoa-editor-key';
// The key is also kept in memory: on anat1969.github.io all of Anat's apps share one localStorage, and
// another app clearing it must not break a save in this tab (2026-10-24: the check passed, the save got 403).
let memoryKey = '';

export function readEditorKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) || memoryKey;
  } catch {
    return memoryKey;
  }
}

export function storeEditorKey(key: string) {
  memoryKey = key;
  try {
    if (key) localStorage.setItem(KEY_STORE, key);
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* private mode: the key lives for this tab only */
  }
}

/** Every write goes through the aoa-edit function, which checks the editor key. */
export async function edit<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}, key = readEditorKey()): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/aoa-edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      'x-editor-key': key,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `שגיאה ${res.status}`);
  return data as T;
}

export async function uploadImage(appId: string, slot: 'cover' | 'logo', file: File): Promise<string> {
  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
  const path = `${appId.replace(/[^\w-]/g, '')}/${slot}-${Date.now()}.${ext}`;
  const { token, publicUrl } = await edit<{ token: string; publicUrl: string }>('sign_upload', { path });
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw error;
  return publicUrl;
}
