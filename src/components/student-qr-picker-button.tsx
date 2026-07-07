'use client'

import Link from 'next/link'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StudentQrPickerButtonProps {
  scanPath: string
  returnToPath: string
  returnParams?: Record<string, string>
  label?: string
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  onBeforeNavigate?: () => void
}

export function StudentQrPickerButton({
  scanPath,
  returnToPath,
  returnParams,
  label = 'Scan QR',
  variant = 'outline',
  size = 'default',
  className,
  onBeforeNavigate,
}: StudentQrPickerButtonProps) {
  const nextReturn = (() => {
    if (!returnParams || Object.keys(returnParams).length === 0) return returnToPath
    const search = new URLSearchParams(returnParams)
    const separator = returnToPath.includes('?') ? '&' : '?'
    return `${returnToPath}${separator}${search.toString()}`
  })()

  const href = `${scanPath}?pick=student&returnTo=${encodeURIComponent(nextReturn)}`

  return (
    <Link href={href as never} onClick={onBeforeNavigate}>
      <Button type="button" variant={variant} size={size} className={className}>
        <QrCode className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </Link>
  )
}
