'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, School } from '@/types'

interface AuthState {
  user: AuthUser | null
  school: School | null
  isLoading: boolean
  activeChildId: string | null
  /** Effective permission keys for the current user ('*' = super admin). */
  permissions: string[]
  setUser: (user: AuthUser | null) => void
  setSchool: (school: School | null) => void
  setLoading: (loading: boolean) => void
  setActiveChildId: (id: string | null) => void
  setPermissions: (permissions: string[]) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      school: null,
      isLoading: true,
      activeChildId: null,
      permissions: [],
      setUser: (user) => set({ user }),
      setSchool: (school) => set({ school }),
      setLoading: (isLoading) => set({ isLoading }),
      setActiveChildId: (activeChildId) => set({ activeChildId }),
      setPermissions: (permissions) => set({ permissions }),
      reset: () => set({ user: null, school: null, isLoading: false, activeChildId: null, permissions: [] }),
    }),
    {
      name: 'edunexus-auth',
      partialize: (state) => ({
        user: state.user,
        school: state.school,
        activeChildId: state.activeChildId,
        permissions: state.permissions,
      }),
    }
  )
)
