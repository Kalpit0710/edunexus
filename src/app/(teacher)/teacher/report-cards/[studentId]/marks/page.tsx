'use client'

import { useParams } from 'next/navigation'
import { StudentMarksEditor } from '@/components/modules/report-cards/StudentMarksEditor'

export default function TeacherStudentMarksPage() {
  const params = useParams()
  const studentId = params.studentId as string
  return <StudentMarksEditor studentId={studentId} backHref="/teacher/report-cards" />
}
