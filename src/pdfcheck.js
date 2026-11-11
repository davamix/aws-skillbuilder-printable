// Reads the generated PDF back and checks its layout:
// page count, start page of every module/section (from the PDF bookmarks),
// and question labels stranded at the bottom of a page.

async function resolvePage(pdf, dest) {
  const d = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
  return d ? (await pdf.getPageIndex(d[0])) + 1 : null;
}

async function checkPdf(buffer, { footerText = '' } = {}) {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));

  const outline = (await pdf.getOutline()) || [];
  const top = outline.length === 1 ? outline[0].items : outline; // under the course title
  const modules = [];
  for (const m of top || []) {
    if (!/^Module\s*\d+/i.test(m.title)) continue;
    modules.push({
      title: m.title,
      page: await resolvePage(pdf, m.dest),
      sections: await Promise.all((m.items || []).map(async (s) => ({ title: s.title, page: await resolvePage(pdf, s.dest) }))),
    });
  }

  const isFooter = (l) => l === footerText || /^\d+ \/ \d+$/.test(l);
  const stranded = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const { items } = await (await pdf.getPage(i)).getTextContent();
    const lines = items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('').split('\n')
      .map((l) => l.trim()).filter((l) => l && !isFooter(l));
    const last = lines[lines.length - 1] || '';
    if (/^Question \d+/.test(last) && i < pdf.numPages) stranded.push({ page: i, label: last });
  }
  return { pages: pdf.numPages, modules, stranded };
}

module.exports = { checkPdf };
