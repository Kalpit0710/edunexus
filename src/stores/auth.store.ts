'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, School } from '@/types'

interface AuthState {
  user: AuthUser | null
  school: School | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setSchool: (school: School | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      school: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setSchool: (school) => set({ school }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ user: null, school: null, isLoading: false }),
    }),
    {
      name: 'edunexus-auth',
      partialize: (state) => ({ user: state.user, school: state.school }),
    }
  )
)
