const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.app'

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'EduNexus',
  url: APP_URL,
  description:
    'EduNexus is a modern, all-in-one school management system for managing students, teachers, fees, attendance, exams, and report cards.',
  applicationCategory: 'EducationApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
    description: 'Free tier available. Premium plans for advanced features.',
  },
  provider: {
    '@type': 'Organization',
    name: 'EduNexus',
    url: APP_URL,
  },
  featureList: [
    'Student Management',
    'Teacher Management',
    'Fee & Billing Management',
    'Attendance Tracking',
    'Examination & Report Cards',
    'Timetable Management',
    'Library Management',
    'Parent Portal',
    'Multi-tenant Architecture',
    'Role-based Access Control',
  ],
}

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  )
}
