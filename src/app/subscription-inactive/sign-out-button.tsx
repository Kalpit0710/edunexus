'use client'

import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

/** Sign-out control for the subscription-inactive screen. */
export function SignOutButton() {
  const router = useRouter()
  const { reset } = useAuthStore()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      reset()
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <Button variant="outline" onClick={handleSignOut} disabled={loading}>
      <LogOut className="mr-2 h-4 w-4" />
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
