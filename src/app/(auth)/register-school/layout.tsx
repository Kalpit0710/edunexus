import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Register Your School',
  description:
    'Register your school on EduNexus and unlock powerful tools for managing students, staff, fees, and more.',
  robots: { index: true, follow: true },
}

export default function RegisterSchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950">
      {children}
    </div>
  )
}
