import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges Tailwind CSS classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Maps raw technical error strings (GoTrue / Postgres / Supabase / network)
 * to friendly, user-facing messages. Already-friendly messages are returned
 * unchanged; only clearly technical/internal strings are translated or
 * replaced with a safe generic fallback.
 */
export function humanizeError(raw: unknown): string {
  const message =
    raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : ''
  if (!message.trim()) return 'Something went wrong. Please try again.'

  const lower = message.toLowerCase()

  // Ordered most-specific first. Each entry: substrings -> friendly message.
  const rules: { match: string[]; friendly: string }[] = [
    {
      match: ['already been registered', 'already registered', 'email address has already', 'user already exists'],
      friendly: 'An account with this email already exists. Please use a different email address.',
    },
    {
      match: ['invalid login credentials', 'invalid credentials'],
      friendly: 'The email or password you entered is incorrect.',
    },
    {
      match: ['email not confirmed'],
      friendly: 'Please confirm your email address before signing in.',
    },
    {
      match: ['password should be', 'password is too short', 'weak password', 'password should contain'],
      friendly: 'Please choose a stronger password (at least 8 characters).',
    },
    {
      match: ['for security purposes', 'email rate limit', 'over_email_send_rate', 'rate limit', 'too many requests', 'status code 429'],
      friendly: 'Too many attempts. Please wait a moment and try again.',
    },
    {
      match: ['duplicate key value', 'unique constraint', '23505'],
      friendly: 'This record already exists.',
    },
    {
      match: ['foreign key constraint', 'violates foreign key', '23503'],
      friendly: "This can't be completed because it's linked to other records.",
    },
    {
      match: ['null value in column', 'not-null constraint', 'violates not-null', '23502', 'check constraint', '23514'],
      friendly: 'Some required information is missing or invalid. Please review the form and try again.',
    },
    {
      match: ['row-level security', 'violates row-level', 'permission denied', 'not authorized', 'insufficient privilege', 'unauthorized', '42501'],
      friendly: "You don't have permission to perform this action.",
    },
    {
      match: ['jwt', 'token is expired', 'token expired', 'session missing', 'session expired', 'refresh_token', 'invalid refresh'],
      friendly: 'Your session has expired. Please sign in again.',
    },
    {
      match: ['failed to fetch', 'fetch failed', 'networkerror', 'network request failed', 'econnrefused', 'enotfound', 'network error'],
      friendly: 'Network error. Please check your connection and try again.',
    },
    {
      match: ['timeout', 'timed out', 'etimedout'],
      friendly: 'The request took too long. Please try again.',
    },
  ]

  for (const rule of rules) {
    if (rule.match.some((m) => lower.includes(m))) return rule.friendly
  }

  // Clearly internal/technical signatures the user should never see verbatim.
  const technicalSignatures = [
    'pgrst',
    'supabaseerror',
    'syntaxerror',
    'typeerror',
    'referenceerror',
    'undefined is not',
    'cannot read properties',
    'relation "',
    'column "',
    'function "',
    'unexpected token',
    'invalid input syntax',
    'stack trace',
    '500 internal',
  ]
  if (technicalSignatures.some((sig) => lower.includes(sig))) {
    return 'Something went wrong. Please try again.'
  }

  // Assume already user-friendly (validation text, app-thrown messages, etc.).
  return message
}

/** Extracts a human-readable, user-friendly message from an unknown thrown value. */
export function getErrorMessage(error: unknown): string {
  return humanizeError(error)
}

/** Formats a number as Indian Rupee currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Formats a date to 'DD MMM YYYY' */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

/** Generates initials from a full name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

/** Truncates text to a given length */
export function truncate(text: string, length = 50): string {
  if (text.length <= length) return text
  return `${text.slice(0, length)}...`
}

/** Debounce utility */
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

/** Generates a slug from a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
