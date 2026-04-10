import {
  calculateAverage,
  calculateGrowthPercentage,
  calculateMarksPercentage,
  calculatePassRate,
} from '@/lib/analytics-utils'

describe('analytics-utils', () => {
  it('calculates growth percentage with previous > 0', () => {
    expect(calculateGrowthPercentage(120, 100)).toBe(20)
  })

  it('calculates growth percentage when previous is 0', () => {
    expect(calculateGrowthPercentage(50, 0)).toBe(100)
    expect(calculateGrowthPercentage(0, 0)).toBe(0)
  })

  it('calculates average with rounding', () => {
    expect(calculateAverage(10, 2)).toBe(5)
    expect(calculateAverage(10, 0)).toBe(0)
    expect(calculateAverage(10, 3, 2)).toBe(3.33)
  })

  it('calculates pass rate safely', () => {
    expect(calculatePassRate(8, 10)).toBe(80)
    expect(calculatePassRate(0, 0)).toBe(0)
  })

  it('calculates marks percentage', () => {
    expect(calculateMarksPercentage(25, 50)).toBe(50)
    expect(calculateMarksPercentage(0, 0)).toBe(0)
  })
})
