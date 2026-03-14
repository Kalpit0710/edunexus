import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navMocks = vi.hoisted(() => ({
  push: vi.fn(),
  examId: 'exam-1',
}))

const examActionMocks = vi.hoisted(() => ({
  createExam: vi.fn(),
  getExamById: vi.fn(),
  getExamSubjects: vi.fn(),
  saveExamMarks: vi.fn(),
  publishExamResults: vi.fn(),
  unlockExamResults: vi.fn(),
  getClassPerformanceReport: vi.fn(),
  getTopperList: vi.fn(),
  getStudentReportCardData: vi.fn(),
}))

const settingsActionMocks = vi.hoisted(() => ({
  getClasses: vi.fn(),
  getAcademicYears: vi.fn(),
  getSubjects: vi.fn(),
  getGradingRules: vi.fn(),
}))

const studentsActionMocks = vi.hoisted(() => ({
  getStudents: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

const publishState = vi.hoisted(() => ({
  status: 'published' as 'published' | 'locked' | 'ongoing',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: navMocks.push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({ examId: navMocks.examId }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    school: { id: 'school-1' },
  }),
}))

vi.mock('../../../src/app/(school-admin)/school-admin/exams/actions', () => ({
  createExam: examActionMocks.createExam,
  getExamById: examActionMocks.getExamById,
  getExamSubjects: examActionMocks.getExamSubjects,
  saveExamMarks: examActionMocks.saveExamMarks,
  publishExamResults: examActionMocks.publishExamResults,
  unlockExamResults: examActionMocks.unlockExamResults,
  getClassPerformanceReport: examActionMocks.getClassPerformanceReport,
  getTopperList: examActionMocks.getTopperList,
  getStudentReportCardData: examActionMocks.getStudentReportCardData,
}))

vi.mock('../../../src/app/(school-admin)/school-admin/settings/actions', () => ({
  getClasses: settingsActionMocks.getClasses,
  getAcademicYears: settingsActionMocks.getAcademicYears,
  getSubjects: settingsActionMocks.getSubjects,
  getGradingRules: settingsActionMocks.getGradingRules,
}))

vi.mock('../../../src/app/(school-admin)/school-admin/students/actions', () => ({
  getStudents: studentsActionMocks.getStudents,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastMocks.success,
    error: toastMocks.error,
  },
}))

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

import NewExamPage from '../../../src/app/(school-admin)/school-admin/exams/new/page'
import ExamMarksPage from '../../../src/app/(school-admin)/school-admin/exams/[examId]/marks/page'
import PublishExamPage from '../../../src/app/(school-admin)/school-admin/exams/[examId]/publish/page'

const examFixture = {
  id: 'exam-1',
  class_id: 'class-1',
  name: 'Mid Term 2026',
  status: 'published',
  result_visible: false,
}

const subjectFixture = {
  id: 'ex-sub-1',
  max_marks: 100,
  pass_marks: 33,
  subjects: { name: 'Mathematics', code: 'MATH' },
}

const studentFixture = {
  id: 'stu-1',
  class_id: 'class-1',
  full_name: 'Aarav Sharma',
  admission_number: 'ADM-001',
  roll_number: '10',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', vi.fn(() => true))

  settingsActionMocks.getClasses.mockResolvedValue([{ id: 'class-1', name: 'Class 10' }])
  settingsActionMocks.getAcademicYears.mockResolvedValue([])
  settingsActionMocks.getSubjects.mockResolvedValue([{ id: 'sub-1', class_id: 'class-1', name: 'Mathematics', code: 'MATH' }])
  settingsActionMocks.getGradingRules.mockResolvedValue([
    { min_marks: 90, max_marks: 100, grade_name: 'A+' },
    { min_marks: 80, max_marks: 89.99, grade_name: 'A' },
    { min_marks: 0, max_marks: 79.99, grade_name: 'B' },
  ])

  studentsActionMocks.getStudents.mockResolvedValue([studentFixture])

  examActionMocks.createExam.mockResolvedValue({ id: 'exam-1' })
  examActionMocks.getExamById.mockImplementation(async () => ({ ...examFixture, status: publishState.status }))
  examActionMocks.getExamSubjects.mockResolvedValue([subjectFixture])
  examActionMocks.saveExamMarks.mockResolvedValue({ savedCount: 1 })
  examActionMocks.publishExamResults.mockResolvedValue(true)
  examActionMocks.unlockExamResults.mockResolvedValue(true)
  examActionMocks.getClassPerformanceReport.mockResolvedValue([
    {
      examSubjectId: 'ex-sub-1',
      subjectName: 'Mathematics',
      subjectCode: 'MATH',
      passCount: 1,
      failCount: 0,
      absentCount: 0,
      studentCount: 1,
      averageMarks: 84,
    },
  ])

  publishState.status = 'published'
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Exam UI flows (Phase 2.1)', () => {
  it('validates exam creation form and submits createExam action on happy path', async () => {
    const user = userEvent.setup()
    render(<NewExamPage />)

    await waitFor(() => expect(settingsActionMocks.getClasses).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(toastMocks.error).toHaveBeenCalledWith('Exam Name and Class are required.')

    await user.type(screen.getByPlaceholderText(/mid-term examination/i), 'Mid Term 2026')

    const classSelect = screen.getAllByRole('combobox')[0]
    expect(classSelect).toBeDefined()
    await user.selectOptions(classSelect as Element, 'class-1')

    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/exam subjects/i)).toBeInTheDocument())

    const subjectSelect = screen.getAllByRole('combobox')[0]
    expect(subjectSelect).toBeDefined()
    await user.selectOptions(subjectSelect as Element, 'sub-1')

    await user.click(screen.getByRole('button', { name: /create exam/i }))

    await waitFor(() => expect(examActionMocks.createExam).toHaveBeenCalledTimes(1))
    expect(examActionMocks.createExam).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        classId: 'class-1',
        name: 'Mid Term 2026',
      })
    )
  })

  it('handles absent vs marks state and sends absent row payload', async () => {
    const user = userEvent.setup()
    render(<ExamMarksPage />)

    await waitFor(() => expect(screen.getByText(/marks entry:/i)).toBeInTheDocument())

    const markInput = screen.getByRole('spinbutton') as HTMLInputElement
    await user.clear(markInput)
    await user.type(markInput, '45')
    expect(markInput.value).toBe('45')

    const absentToggle = screen.getByRole('checkbox')
    await user.click(absentToggle)

    expect(absentToggle).toBeChecked()
    expect(markInput).toBeDisabled()
    expect(markInput.value).toBe('')

    await user.click(screen.getByRole('button', { name: /save marks/i }))

    await waitFor(() => expect(examActionMocks.saveExamMarks).toHaveBeenCalledTimes(1))
    const firstSaveCall = examActionMocks.saveExamMarks.mock.calls[0]
    expect(firstSaveCall).toBeDefined()
    const rows = firstSaveCall![3] as Array<{ studentId: string; marksObtained: number | null; isAbsent?: boolean }>
    expect(rows[0]).toMatchObject({
      studentId: 'stu-1',
      marksObtained: null,
      isAbsent: true,
    })
  })

  it('shows correct publish/lock button states and processing state', async () => {
    const user = userEvent.setup()

    publishState.status = 'locked'
    const lockedView = render(<PublishExamPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: /unlock exam/i })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /publish results & lock/i })).not.toBeInTheDocument()

    lockedView.unmount()

    publishState.status = 'ongoing'
    let resolvePublish: ((value: boolean) => void) | undefined
    examActionMocks.publishExamResults.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePublish = resolve
        })
    )

    render(<PublishExamPage />)

    const publishButton = await screen.findByRole('button', { name: /publish results & lock/i })
    await user.click(publishButton)

    const processingButton = await screen.findByRole('button', { name: /processing/i })
    expect(processingButton).toBeDisabled()

    if (resolvePublish) {
      resolvePublish(true)
    }
    await waitFor(() => expect(examActionMocks.publishExamResults).toHaveBeenCalledTimes(1))
  })
})
