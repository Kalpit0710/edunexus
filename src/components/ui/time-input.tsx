'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/**
 * A native `<input type="time">` with an always-visible clock button that opens
 * the browser time picker on click. The default picker indicator is hidden (it
 * is nearly invisible on the dark theme) and replaced with a clearly tappable
 * icon button. Falls back to focusing the field when `showPicker()` is
 * unsupported.
 */
const TimeInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'>
>(({ className, disabled, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLInputElement>(null)

  // Merge the forwarded ref with our internal ref so callers can still access
  // the element while we drive the native picker.
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement)

  function openPicker() {
    const el = innerRef.current
    if (!el || disabled) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }

  return (
    <div className="relative">
      <Input
        ref={innerRef}
        type="time"
        disabled={disabled}
        className={cn(
          'pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0',
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Open time picker"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Clock className="h-4 w-4" />
      </button>
    </div>
  )
})
TimeInput.displayName = 'TimeInput'

export { TimeInput }
