import Image from 'next/image'

import { cn } from '@/lib/utils'

interface BrandLogoProps {
  /** Rendered pixel size (used for both width and height). Defaults to 32. */
  size?: number
  className?: string
  priority?: boolean
}

/**
 * The EduNexus brand mark. Renders the shared logo asset from `/logo.svg` so
 * the product identity stays consistent everywhere it appears.
 */
export function BrandLogo({ size = 32, className, priority }: BrandLogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="EduNexus"
      width={size}
      height={size}
      priority={priority}
      className={cn('object-contain', className)}
    />
  )
}
