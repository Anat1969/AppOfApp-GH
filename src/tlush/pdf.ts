import type { Item } from './parse';
import { parseItems } from './parse';
import type { Slip } from './types';

/** Reads a payslip PDF in the browser. The file never leaves the device. */
export async function readPdf(file: File, password?: string): Promise<Slip> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password }).promise;
  const items: Item[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items) if ('str' in it) items.push({ x: it.transform[4], y: it.transform[5], s: it.str, page: p });
  }
  await doc.destroy();
  return { ...parseItems(items), fileName: file.name };
}
