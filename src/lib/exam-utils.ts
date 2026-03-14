export type ExamStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'locked'

export interface GradingRule {
  min_marks: number
  max_marks: number
  grade_name: string
}

export interface MarksValidationInput {
  marksObtained: number | null
  isAbsent: boolean
  maxMarks: number
}

export function canEnterMarks(status: ExamStatus): boolean {
  return status === 'published' || status === 'ongoing'
}

export function calculatePercentage(marksObtained: number, maxMarks: number): number {
  if (maxMarks <= 0) return 0
  const percentage = (marksObtained / maxMarks) * 100
  return Math.max(0, Math.min(100, Number(percentage.toFixed(2))))
}

export function resolveGradeFromRules(percentage: number, rules: GradingRule[]): string | null {
  if (!rules.length) return null

  const sorted = [...rules].sort((left, right) => right.min_marks - left.min_marks)
  const matched = sorted.find(rule => percentage >= rule.min_marks && percentage <= rule.max_marks)
  return matched?.grade_name ?? null
}

export function validateMarksEntry(input: MarksValidationInput): string[] {
  const errors: string[] = []

  if (input.maxMarks <= 0) {
    errors.push('Maximum marks must be greater than 0.')
    return errors
  }

  if (input.isAbsent) {
    if (input.marksObtained !== null) {
      errors.push('Absent students must not have marks.')
    }
    return errors
  }

  if (input.marksObtained === null) {
    errors.push('Marks are required for non-absent students.')
    return errors
  }

  if (input.marksObtained < 0) {
    errors.push('Marks cannot be negative.')
  }

  if (input.marksObtained > input.maxMarks) {
    errors.push('Marks cannot exceed maximum marks.')
  }

  return errors
}
