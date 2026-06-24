'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { updateSchoolSettings } from './actions'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ContentAreaLoader } from '@/components/loaders/page-loaders'
import { ClassesTab } from './components/classes-tab'
import { SubjectsTab } from './components/subjects-tab'
import { AcademicTab } from './components/academic-tab'
import { GradingRulesTab } from './components/grading-tab'
import { ReportCardTab } from './components/report-card-tab'
import { AccessTab } from './components/access-tab'

export default function SettingsPage() {
  const { school, setSchool } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (school) {
      setFormData(school)
    } else {
      // In a real app, you might want to fetch school if not in store,
      // but the layout should handle it.
    }
  }, [school])

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    if (!school?.id) return
    setLoading(true)
    try {
      await updateSchoolSettings(school.id, {
        name: formData.name,
        code: formData.code,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        theme_color: formData.theme_color,
        principal_signature_url: formData.principal_signature_url || null,
        lock_results_on_fee: !!formData.lock_results_on_fee,
        report_card_title: formData.report_card_title || 'Progress Report',
        pass_percentage: Number(formData.pass_percentage) || 33,
        result_statuses: formData.result_statuses,
        co_scholastic_grades: formData.co_scholastic_grades,
        currency_symbol: formData.currency_symbol || '₹',
        locale: formData.locale || 'en-IN',
        date_format: formData.date_format || 'dd MMM yyyy',
      } as any)
      setSchool({ ...school, ...formData } as any)
      toast.success('School settings updated')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (!school) return <ContentAreaLoader label="Loading school settings..." />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">School Configuration</h2>
        <p className="text-muted-foreground">Manage your institution's core settings and structural hierarchy here.</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="academic">Academic Year</TabsTrigger>
          <TabsTrigger value="classes">Classes & Sections</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="grading">Grading Rules</TabsTrigger>
          <TabsTrigger value="report-card">Report Card</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Basic detail associated with your school's branding and communication.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGeneral} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="school-name">School Name</Label>
                    <Input
                      id="school-name"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school-code">School Code</Label>
                    <Input
                      id="school-code"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school-email">Email</Label>
                    <Input
                      id="school-email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school-phone">Phone</Label>
                    <Input
                      id="school-phone"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="school-address">Address</Label>
                  <Input
                    id="school-address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="school-theme">Theme Color</Label>
                    <div className="flex gap-4">
                      <Input
                        id="school-theme"
                        type="color"
                        className="w-16 p-1 cursor-pointer"
                        value={formData.theme_color || '#3b82f6'}
                        onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                      />
                      <Input
                        value={formData.theme_color || ''}
                        onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-title">Report Card Title</Label>
                    <Input
                      id="report-title"
                      value={formData.report_card_title || ''}
                      onChange={(e) => setFormData({ ...formData, report_card_title: e.target.value })}
                      placeholder="Progress Report"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-pct">Pass Percentage</Label>
                    <Input
                      id="pass-pct"
                      type="number"
                      value={formData.pass_percentage ?? 33}
                      onChange={(e) => setFormData({ ...formData, pass_percentage: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency Symbol</Label>
                    <Input
                      id="currency"
                      value={formData.currency_symbol || ''}
                      onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                      placeholder="₹"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locale">Locale</Label>
                    <Input
                      id="locale"
                      value={formData.locale || ''}
                      onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                      placeholder="en-IN"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="result-statuses">Result Status Options</Label>
                  <Input
                    id="result-statuses"
                    value={(formData.result_statuses || []).join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        result_statuses: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Passed, Failed, Promoted, Detained"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated options shown when entering a student&apos;s result.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="co-grades">Co-Scholastic Grade Scale</Label>
                  <Input
                    id="co-grades"
                    value={(formData.co_scholastic_grades || []).join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        co_scholastic_grades: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="A, B, C, D, E"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated grades used for co-scholastic areas.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="principal-signature">Principal Signature Image URL</Label>
                  <Input
                    id="principal-signature"
                    value={formData.principal_signature_url || ''}
                    onChange={(e) => setFormData({ ...formData, principal_signature_url: e.target.value })}
                    placeholder="https://…/principal-signature.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on printed report cards. Leave blank to print a signature line instead.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="lock-fee">Lock report cards when fees are due</Label>
                    <p className="text-xs text-muted-foreground">
                      When on, parents with an outstanding balance can&apos;t view or print report cards.
                    </p>
                  </div>
                  <Switch
                    id="lock-fee"
                    checked={!!formData.lock_results_on_fee}
                    onCheckedChange={(v) => setFormData({ ...formData, lock_results_on_fee: v })}
                  />
                </div>

                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card>
            <CardHeader>
              <CardTitle>Academic Year</CardTitle>
              <CardDescription>Determine your current academic term dates securely.</CardDescription>
            </CardHeader>
            <CardContent>
              <AcademicTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes">
          <Card>
            <CardHeader>
              <CardTitle>Classes & Sections Setup</CardTitle>
              <CardDescription>Setup hierarchy mapping across grades.</CardDescription>
            </CardHeader>
            <CardContent>
              <ClassesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects">
          <Card>
            <CardHeader>
              <CardTitle>Subjects Config</CardTitle>
              <CardDescription>Assign curricula mapped to classes.</CardDescription>
            </CardHeader>
            <CardContent>
              <SubjectsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grading">
          <Card>
            <CardHeader>
              <CardTitle>Grading Rules</CardTitle>
              <CardDescription>Setup scoring rubrics and GPA calculations.</CardDescription>
            </CardHeader>
            <CardContent>
              <GradingRulesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report-card">
          <Card>
            <CardHeader>
              <CardTitle>Report Card</CardTitle>
              <CardDescription>Grand total rule, component labels, and co-scholastic areas.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportCardTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
              <CardDescription>Turn modules on/off and fine-tune what each role can do.</CardDescription>
            </CardHeader>
            <CardContent>
              <AccessTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
