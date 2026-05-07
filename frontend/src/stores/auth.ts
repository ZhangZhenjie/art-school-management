import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'teacher';

interface AuthState {
  token: string | null;
  username: string | null;
  role: Role | null;
  setAuth: (p: { token: string; username: string; role: Role }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      role: null,
      setAuth: ({ token, username, role }) => set({ token, username, role }),
      clear: () => set({ token: null, username: null, role: null }),
    }),
    { name: 'art-school-auth' },
  ),
);
