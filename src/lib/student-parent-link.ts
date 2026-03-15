export interface ParentContactInput {
  parent_name?: unknown
  parent_email?: unknown
  parent_contact?: unknown
}

export interface NormalizedParentContact {
  parentName: string
  parentEmail: string
  parentPhone: string
  hasDetails: boolean
}

export interface ParentLinkCandidate {
  auth_user_id: string | null
  email: string | null
  phone: string | null
  is_primary?: boolean | null
}

function toTrimmedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeParentContact(input: ParentContactInput): NormalizedParentContact {
  const parentName = toTrimmedText(input.parent_name)
  const parentEmail = toTrimmedText(input.parent_email).toLowerCase()
  const parentPhone = toTrimmedText(input.parent_contact)

  return {
    parentName,
    parentEmail,
    parentPhone,
    hasDetails: Boolean(parentName || parentEmail || parentPhone),
  }
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function getPhoneMatchTokens(value: string): Set<string> {
  const digits = normalizePhoneDigits(value)
  const tokens = new Set<string>()

  if (!digits) return tokens

  tokens.add(digits)

  if (digits.startsWith('00') && digits.length > 2) {
    tokens.add(digits.slice(2))
  }

  if (digits.startsWith('0') && digits.length > 1) {
    tokens.add(digits.slice(1))
  }

  if (digits.length === 10) {
    tokens.add(`91${digits}`)
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    tokens.add(digits.slice(2))
  }

  return tokens
}

export function phonesMatch(a: string, b: string): boolean {
  const aTokens = getPhoneMatchTokens(a)
  const bTokens = getPhoneMatchTokens(b)

  if (aTokens.size === 0 || bTokens.size === 0) {
    return false
  }

  for (const token of aTokens) {
    if (bTokens.has(token)) {
      return true
    }
  }

  return false
}

function sameNormalizedEmail(left: string | null | undefined, right: string): boolean {
  if (!left || !right) return false
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

export function selectBestSiblingParent(
  candidates: ParentLinkCandidate[],
  parentEmail: string,
  parentPhone: string,
): ParentLinkCandidate | null {
  if (!parentEmail) return null

  const matching = candidates.filter((candidate) => {
    if (!sameNormalizedEmail(candidate.email, parentEmail)) {
      return false
    }

    if (parentPhone && !phonesMatch(candidate.phone ?? '', parentPhone)) {
      return false
    }

    return true
  })

  if (matching.length === 0) {
    return null
  }

  matching.sort((a, b) => {
    const authPriority = Number(Boolean(b.auth_user_id)) - Number(Boolean(a.auth_user_id))
    if (authPriority !== 0) return authPriority

    return Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
  })

  return matching[0] ?? null
}