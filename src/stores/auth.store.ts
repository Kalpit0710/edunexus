'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, School } from '@/types'

interface AuthState {
  user: AuthUser | null
  school: School | null
  isLoading: boolean
  activeChildId: string | null
  setUser: (user: AuthUser | null) => void
  setSchool: (school: School | null) => void
  setLoading: (loading: boolean) => void
  setActiveChildId: (id: string | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      school: null,
      isLoading: true,
      activeChildId: null,
      setUser: (user) => set({ user }),
      setSchool: (school) => set({ school }),
      setLoading: (isLoading) => set({ isLoading }),
      setActiveChildId: (activeChildId) => set({ activeChildId }),
      reset: () => set({ user: null, school: null, isLoading: false, activeChildId: null }),
    }),
    {
      name: 'edunexus-auth',
      partialize: (state) => ({ user: state.user, school: state.school, activeChildId: state.activeChildId }),
    }
  )
)
