import { create } from "zustand";
import { nanoid } from "nanoid";

export type ToastKind = "info" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after this many ms. 0 disables auto-dismiss. */
  timeout: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, timeout?: number) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (kind, message, timeout = 4000) => {
    const id = nanoid(8);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, timeout }] }));
    if (timeout > 0) {
      setTimeout(() => get().dismiss(id), timeout);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience wrappers so callers don't have to remember the kind. */
export const toast = {
  info: (m: string, t?: number) => useToastStore.getState().push("info", m, t),
  success: (m: string, t?: number) => useToastStore.getState().push("success", m, t),
  warn: (m: string, t?: number) => useToastStore.getState().push("warning", m, t),
  error: (m: string, t?: number) => useToastStore.getState().push("error", m, t ?? 7000),
};
