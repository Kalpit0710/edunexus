'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useAuthStore } from '@/stores/auth.store'
import { getIdCardsData, type IdCardsData } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IdCard, Printer, ShieldCheck } from 'lucide-react'
import { InlineLoader } from '@/components/loaders/page-loaders'

interface CardTileProps {
  schoolName: string
  schoolCode: string
  schoolLogoUrl: string | null
  title: string
  subtitle: string
  kind: 'Student' | 'Teacher'
  photoUrl: string | null
  qrText: string
  qrImage: string | null
}

function PrintableCard({
  schoolName,
  schoolCode,
  schoolLogoUrl,
  title,
  subtitle,
  kind,
  photoUrl,
  qrText,
  qrImage,
}: CardTileProps) {
  return (
    <div className="id-card-pair">
      <div className="id-card-template id-card-front">
        <div className="id-card-front__hero" />
        <div className="id-card-front__header">
          <div className="id-card-front__brand">
            <p className="id-card-front__suite">EduNexus Secure ID</p>
            <p className="id-card-front__school">{schoolName}</p>
            <p className="id-card-front__code">{schoolCode}</p>
          </div>
          <div className="id-card-front__badge">
            {schoolLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={schoolLogoUrl} alt={schoolName} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <IdCard className="h-6 w-6 text-blue-100" />
            )}
          </div>
        </div>

        <div className="id-card-front__body">
          <div className="id-card-front__avatar">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="id-card-front__initial">{title.trim().slice(0, 1).toUpperCase()}</div>
            )}
          </div>

          <div className="id-card-front__identity">
            <p className="id-card-front__kind">{kind}</p>
            <p className="id-card-front__name" title={title}>{title}</p>
            <p className="id-card-front__meta" title={subtitle}>{subtitle}</p>
          </div>
        </div>

        <div className="id-card-front__footer">
          <p>Issued by {schoolName}</p>
          <div className="id-card-front__chip">
            <ShieldCheck className="h-3.5 w-3.5" />
            Signed QR
          </div>
        </div>
      </div>

      <div className="id-card-template id-card-back">
        <div className="id-card-back__qr-wrap">
          {qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt={`${title} QR`} className="id-card-back__qr" />
          ) : (
            <div className="id-card-back__qr-fallback">Generating QR...</div>
          )}
        </div>
        <div className="id-card-back__copy">
          <p className="id-card-back__title">Scan to verify identity</p>
          <p className="id-card-back__body">
            Use EduNexus QR Scan in School Admin, Teacher, or Manager portal.
          </p>
          <p className="id-card-back__body">Modes: Info Only and Mark Attendance.</p>
        </div>
        <p className="id-card-back__token" title={qrText}>Token: {qrText}</p>
      </div>
    </div>
  )
}

function CardTile(props: CardTileProps) {
  return (
    <div className="screen-card-view">
      <PrintableCard {...props} />
    </div>
  )
}

export default function IdCardsPage() {
  const { school } = useAuthStore()
  const [data, setData] = useState<IdCardsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [qrImages, setQrImages] = useState<Record<string, string>>({})

  useEffect(() => {
    async function run() {
      if (!school?.id) return
      setLoading(true)
      try {
        const result = await getIdCardsData(school.id)
        setData(result)
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [school?.id])

  useEffect(() => {
    let alive = true

    async function buildImages() {
      if (!data) {
        setQrImages({})
        return
      }

      const entries = [...data.students, ...data.teachers]
      const mapped = await Promise.all(
        entries.map(async (item) => {
          const img = await QRCode.toDataURL(item.qrText, {
            width: 160,
            margin: 1,
            errorCorrectionLevel: 'M',
          })
          return [item.id, img] as const
        })
      )

      if (alive) {
        setQrImages(Object.fromEntries(mapped))
      }
    }

    void buildImages()
    return () => {
      alive = false
    }
  }, [data])

  const filteredStudents = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.students
    return data.students.filter((s) =>
      [s.fullName, s.admissionNumber, s.className ?? '', s.sectionName ?? ''].join(' ').toLowerCase().includes(q)
    )
  }, [data, query])

  const filteredTeachers = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.teachers
    return data.teachers.filter((t) => [t.fullName, t.employeeId ?? ''].join(' ').toLowerCase().includes(q))
  }, [data, query])

  const printableStudentCards = useMemo(() => {
    if (!data) return []
    return filteredStudents.map((s) => ({
      key: `student-${s.id}`,
      kind: 'Student' as const,
      title: s.fullName,
      subtitle: `${s.admissionNumber} · ${s.className ?? 'Class'}${s.sectionName ? ` - ${s.sectionName}` : ''}`,
      photoUrl: s.photoUrl,
      qrText: s.qrText,
      qrImage: qrImages[s.id] ?? null,
    }))
  }, [data, filteredStudents, qrImages])

  const printableTeacherCards = useMemo(() => {
    if (!data) return []
    return filteredTeachers.map((t) => ({
      key: `teacher-${t.id}`,
      kind: 'Teacher' as const,
      title: t.fullName,
      subtitle: t.employeeId ? `Employee ID: ${t.employeeId}` : 'Teacher',
      photoUrl: t.photoUrl,
      qrText: t.qrText,
      qrImage: qrImages[t.id] ?? null,
    }))
  }, [data, filteredTeachers, qrImages])

  const printableAllCards = useMemo(() => [...printableStudentCards, ...printableTeacherCards], [printableStudentCards, printableTeacherCards])

  if (loading) return <InlineLoader label="Loading ID cards..." />
  if (!data) return <p className="text-sm text-slate-500">Unable to load ID card data.</p>

  return (
    <div className="id-cards-page space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ID Card Generator</h1>
          <p className="text-sm text-muted-foreground">Generate signed-QR student and teacher cards with front/back templates.</p>
        </div>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Front + Back Sheets
        </Button>
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Search by name, admission number, employee ID, class, or section.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="id-card-search">Search</Label>
            <Input
              id="id-card-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Aarav, ADM-204, Class 8"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="students" className="space-y-4 no-print">
        <TabsList className="flex-wrap">
          <TabsTrigger value="students" className="gap-2">
            Students
            <Badge variant="secondary">{filteredStudents.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="teachers" className="gap-2">
            Teachers
            <Badge variant="secondary">{filteredTeachers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <div className="id-card-preview-grid">
            {printableStudentCards.map((item) => (
              <CardTile
                key={item.key}
                schoolName={data.school.name}
                schoolCode={data.school.code}
                schoolLogoUrl={data.school.logoUrl}
                title={item.title}
                subtitle={item.subtitle}
                kind={item.kind}
                photoUrl={item.photoUrl}
                qrText={item.qrText}
                qrImage={item.qrImage}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teachers">
          <div className="id-card-preview-grid">
            {printableTeacherCards.map((item) => (
              <CardTile
                key={item.key}
                schoolName={data.school.name}
                schoolCode={data.school.code}
                schoolLogoUrl={data.school.logoUrl}
                title={item.title}
                subtitle={item.subtitle}
                kind={item.kind}
                photoUrl={item.photoUrl}
                qrText={item.qrText}
                qrImage={item.qrImage}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <section className="print-only">
        <div className="id-print-grid">
          {printableAllCards.map((item) => (
            <PrintableCard
              key={`print-${item.key}`}
              schoolName={data.school.name}
              schoolCode={data.school.code}
              schoolLogoUrl={data.school.logoUrl}
              title={item.title}
              subtitle={item.subtitle}
              kind={item.kind}
              photoUrl={item.photoUrl}
              qrText={item.qrText}
              qrImage={item.qrImage}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

