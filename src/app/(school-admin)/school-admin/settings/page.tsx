'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { updateSchoolSettings } from './actions'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ClassesTab } from './components/classes-tab'
import { SubjectsTab } from './components/subjects-tab'
import { AcademicTab } from './components/academic-tab'
import { GradingRulesTab } from './components/grading-tab'

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
        theme_color: formData.theme_color
      } as any)
      setSchool({ ...school, ...formData } as any)
      toast.success('School settings updated')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!school) return <div className="p-8">Loading school context...</div>

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
      </Tabs>
    </div>
  )
}
