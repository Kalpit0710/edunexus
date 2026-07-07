function toAscii(input: string): string {
  return input.replace(/[^\x20-\x7E]/g, ' ')
}

function escapePdfText(input: string): string {
  return toAscii(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function createSimplePdf(lines: string[]): Uint8Array {
  const safeLines = lines.map((line) => line.trim()).filter(Boolean)
  const maxLinesPerPage = 46
  const pageChunks: string[][] = []

  for (let index = 0; index < safeLines.length; index += maxLinesPerPage) {
    pageChunks.push(safeLines.slice(index, index + maxLinesPerPage))
  }

  if (pageChunks.length === 0) {
    pageChunks.push(['EduNexus', 'No content available'])
  }

  const pageCount = pageChunks.length
  const fontObjectNumber = 3 + pageCount * 2
  const objectMap = new Map<number, string>()

  objectMap.set(1, '<< /Type /Catalog /Pages 2 0 R >>')

  const pageObjectNumbers = pageChunks.map((_, index) => 3 + index * 2)
  objectMap.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  )

  pageChunks.forEach((chunk, index) => {
    const pageObjectNumber = 3 + index * 2
    const contentObjectNumber = 4 + index * 2

    const commands: string[] = ['BT', '/F1 11 Tf']
    let y = 806
    for (const line of chunk) {
      commands.push(`1 0 0 1 44 ${y} Tm (${escapePdfText(line)}) Tj`)
      y -= 16
      if (y < 56) break
    }
    commands.push('ET')

    const content = commands.join('\n')

    objectMap.set(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    )
    objectMap.set(contentObjectNumber, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  objectMap.set(fontObjectNumber, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  let pdf = '%PDF-1.4\n'
  const offsets = new Map<number, number>()
  const objectNumbers = Array.from(objectMap.keys()).sort((a, b) => a - b)
  const maxObjectNumber = Math.max(...objectNumbers)

  for (const objectNumber of objectNumbers) {
    offsets.set(objectNumber, pdf.length)
    pdf += `${objectNumber} 0 obj\n${objectMap.get(objectNumber)}\nendobj\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${maxObjectNumber + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
    const offset = offsets.get(objectNumber) ?? 0
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${maxObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new TextEncoder().encode(pdf)
}