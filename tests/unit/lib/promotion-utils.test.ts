import { describe, it, expect } from 'vitest'
import {
  computeDefaultPromotionMapping,
  validatePromotionMapping,
  type PromotionClass,
} from '@/lib/promotion-utils'

const classes: PromotionClass[] = [
  { id: 'c1', name: 'Class 1', display_order: 1 },
  { id: 'c2', name: 'Class 2', display_order: 2 },
  { id: 'c3', name: 'Class 3', display_order: 3 },
]

describe('computeDefaultPromotionMapping', () => {
  it('maps each class to the next and graduates the top class', () => {
    expect(computeDefaultPromotionMapping(classes)).toEqual([
      { fromClassId: 'c1', toClassId: 'c2' },
      { fromClassId: 'c2', toClassId: 'c3' },
      { fromClassId: 'c3', toClassId: null },
    ])
  })

  it('sorts by display_order regardless of input order', () => {
    const shuffled = [classes[2]!, classes[0]!, classes[1]!]
    expect(computeDefaultPromotionMapping(shuffled)).toEqual([
      { fromClassId: 'c1', toClassId: 'c2' },
      { fromClassId: 'c2', toClassId: 'c3' },
      { fromClassId: 'c3', toClassId: null },
    ])
  })

  it('graduates the only class when there is a single class', () => {
    expect(computeDefaultPromotionMapping([classes[0]!])).toEqual([
      { fromClassId: 'c1', toClassId: null },
    ])
  })

  it('returns an empty mapping for no classes', () => {
    expect(computeDefaultPromotionMapping([])).toEqual([])
  })
})

describe('validatePromotionMapping', () => {
  it('accepts the default mapping', () => {
    expect(validatePromotionMapping(computeDefaultPromotionMapping(classes), classes)).toBeNull()
  })

  it('rejects an empty mapping', () => {
    expect(validatePromotionMapping([], classes)).toMatch(/no classes/i)
  })

  it('rejects an unknown source class', () => {
    expect(
      validatePromotionMapping([{ fromClassId: 'x', toClassId: 'c2' }], classes),
    ).toMatch(/unknown source/i)
  })

  it('rejects an unknown target class', () => {
    expect(
      validatePromotionMapping([{ fromClassId: 'c1', toClassId: 'x' }], classes),
    ).toMatch(/unknown target/i)
  })

  it('rejects a class promoting into itself', () => {
    expect(
      validatePromotionMapping([{ fromClassId: 'c1', toClassId: 'c1' }], classes),
    ).toMatch(/into itself/i)
  })

  it('rejects a duplicate source class', () => {
    expect(
      validatePromotionMapping(
        [
          { fromClassId: 'c1', toClassId: 'c2' },
          { fromClassId: 'c1', toClassId: null },
        ],
        classes,
      ),
    ).toMatch(/more than once/i)
  })
})
