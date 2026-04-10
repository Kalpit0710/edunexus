export function calculateGrowthPercentage(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function calculateAverage(value: number, count: number, decimals = 0): number {
  if (count <= 0) return 0
  const factor = Math.pow(10, decimals)
  return Math.round((value / count) * factor) / factor
}

export function calculatePassRate(passCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  return Math.round((passCount / totalCount) * 100)
}

export function calculateMarksPercentage(marks: number, maxMarks: number): number {
  if (maxMarks <= 0) return 0
  return (marks / maxMarks) * 100
}
