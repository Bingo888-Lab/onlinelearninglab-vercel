import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/** Build a tiny, valid two-page PDF without external dependencies. */
export function buildFixturePdf() {
  const content1 = "BT /F1 18 Tf 72 720 Td (E2E Test PDF - Page 1) Tj ET\n";
  const content2 = "BT /F1 18 Tf 72 720 Td (E2E Test PDF - Page 2) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content1, "ascii")} >>\nstream\n${content1}endstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${Buffer.byteLength(content2, "ascii")} >>\nstream\n${content2}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  const header = Buffer.from("%PDF-1.4\n%fixture\n", "ascii");
  const chunks = [header];
  const offsets = [0];
  let length = header.length;

  objects.forEach((body, i) => {
    offsets.push(length);
    const object = Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, "ascii");
    chunks.push(object);
    length += object.length;
  });

  const xrefOffset = length;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let i = 1; i < offsets.length; i++) {
    xref.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const trailer = [
    ...xref,
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  ].join("\n");
  chunks.push(Buffer.from(trailer, "ascii"));

  return Buffer.concat(chunks);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  const output = resolve(process.cwd(), "e2e/fixtures/test.pdf");
  const bytes = buildFixturePdf();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  console.log(`Generated e2e/fixtures/test.pdf (${bytes.length} bytes)`);
}
