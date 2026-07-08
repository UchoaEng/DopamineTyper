// Extração de texto de PDF 100% no navegador (pdfjs-dist) — o arquivo do
// usuário nunca sai da máquina dele.

import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractPdfText(
  data: ArrayBuffer,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const doc = await pdfjs.getDocument({ data }).promise
  let out = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let pageText = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform[5] as number
      // Mudança de linha visual no PDF vira quebra de linha no texto.
      if (lastY !== null && Math.abs(y - lastY) > 2) pageText += '\n'
      pageText += item.str
      lastY = y
    }
    out += pageText + '\n\n'
    onProgress?.(i / doc.numPages)
  }
  return out
}
