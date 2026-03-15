'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getStudents, deleteStudent, bulkCreateStudents } from './actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Trash2, Edit, UserPlus, Search, Download, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import * as xlsx from 'xlsx'

export default function StudentsPage() {
  const { school } = useAuthStore()
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (school?.id) {
      fetchStudents()
    }
  }, [school?.id])

  async function fetchStudents() {
    if (!school?.id) return
    setLoading(true)
    try {
      const data = await getStudents(school.id)
      setStudents(data || [])
    } catch (e: any) {
      toast.error('Failed to load students: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this student?')) return
    try {
      await deleteStudent(id)
      toast.success('Student deleted')
      fetchStudents()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    if (students.length === 0) {
      toast.error('No students to export.')
      return
    }
    const exportData = students.map(s => ({
      'First Name': s.first_name,
      'Middle Name': s.middle_name || '',
      'Last Name': s.last_name || '',
      'Gender': s.gender,
      'Date of Birth': s.date_of_birth,
      'Admission No': s.admission_number,
      'Roll No': s.roll_number || '',
      'Date of Joining': s.date_of_joining,
      'Class ID': s.class_id,
      'Section ID': s.section_id || '',
      'Parent Name': s.parent_name || '',
      'Parent Contact': s.parent_contact || '',
      'Parent Email': s.parent_email || '',
      'Address': s.address || '',
      'Blood Group': s.blood_group || '',
      'Medical Conditions': s.medical_conditions || ''
    }))

    const ws = xlsx.utils.json_to_sheet(exportData)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Students')
    xlsx.writeFile(wb, 'students_export.xlsx')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!school?.id) return

    setLoading(true)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        if (typeof bstr !== 'string') throw new Error('File read error')

        const wb = xlsx.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        if (!wsname) throw new Error('No sheets found')

        const ws = wb.Sheets[wsname]
        if (!ws) throw new Error('Sheet data is missing')

        const data: any[] = xlsx.utils.sheet_to_json(ws)

        if (data.length === 0) {
          toast.error('Excel file is empty.')
          setLoading(false)
          return
        }

        const payloads = data.map(row => ({
          first_name: row['First Name'],
          middle_name: row['Middle Name'] || null,
          last_name: row['Last Name'] || null,
          gender: row['Gender'],
          date_of_birth: row['Date of Birth'],
          admission_number: row['Admission No'],
          roll_number: row['Roll No'] || null,
          date_of_joining: row['Date of Joining'],
          class_id: row['Class ID'],
          section_id: row['Section ID'] || null,
          parent_name: row['Parent Name'] || null,
          parent_contact: row['Parent Contact'] || null,
          parent_email: row['Parent Email'] || null,
          address: row['Address'] || null,
          blood_group: row['Blood Group'] || null,
          medical_conditions: row['Medical Conditions'] || null
        }))

        // Validate basic required fields on first row
        if (!payloads[0]?.first_name || !payloads[0]?.admission_number) {
          throw new Error("Invalid format. Missing 'First Name' or 'Admission No'. Ensure columns match the export format.")
        }

        await bulkCreateStudents(school.id, payloads)
        toast.success(`Successfully imported ${payloads.length} students.`)
        fetchStudents()
      } catch (err: any) {
        toast.error('Import failed: ' + err.message)
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const filteredStudents = students.filter(s => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      s.first_name.toLowerCase().includes(term) ||
      s.last_name?.toLowerCase().includes(term) ||
      s.admission_number?.toLowerCase().includes(term) ||
      s.class?.name?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Directory</h2>
          <p className="text-muted-foreground">Manage and view all enrolled students.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={loading}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <Link href={"/school-admin/students/new" as any}>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" /> Add Student
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-2 max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, adm no. or class..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 border-0 shadow-none focus-visible:ring-0 px-0 rounded-none bg-transparent"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading directory...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No students found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Admission No</th>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Class / Section</th>
                    <th className="px-6 py-3 font-medium">Gender</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{student.admission_number || '-'}</td>
                      <td className="px-6 py-4">
                        <Link href={`/school-admin/students/${student.id}` as any}>
                          <div className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                            {student.full_name}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {student.class?.name || 'N/A'} {student.section?.name ? `- ${student.section.name}` : ''}
                      </td>
                      <td className="px-6 py-4 capitalize">{student.gender || '-'}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link href={`/school-admin/students/${student.id}/edit` as any}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(student.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
