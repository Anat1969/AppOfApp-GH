import { useEffect, useState } from 'react';

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

let deferred: PromptEvent | null = null;
const subs = new Set<() => void>();

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as PromptEvent;
  subs.forEach((f) => f());
});
addEventListener('appinstalled', () => {
  deferred = null;
  subs.forEach((f) => f());
});

/** Chrome offers install only when the manifest and service worker are valid. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return {
    canInstall: !!deferred,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      subs.forEach((f) => f());
    },
  };
}
