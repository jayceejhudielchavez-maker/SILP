import { $ } from '../utils/helpers.js';
import { Files } from '../utils/Files.js';
import { Libraries } from '../utils/Libraries.js';
import { CertificateRenderer } from './CertificateRenderer.js';

export const CERTIFICATE_PAGE = 'size: 8.5in 11in; margin: 0';
export const SLIP_PAGE = 'size: 8.5in 11in; margin: 0.5in';

// Printing and PDF output. Every method takes a list of pages, so one certificate and a
// batch of 200 go through the same code; each page prints on its own sheet of paper.
export class Printer {
  // Lays the pages out off-screen so "shrink to fit" names can be measured, then returns the finished HTML
  static async prepare(pages) {
    const host = $('offscreen');
    host.innerHTML = pages.map(p => `<div>${p}</div>`).join('');
    host.classList.add('on');
    try {
      await Files.waitImages(host);
      await document.fonts.ready;
      CertificateRenderer.shrinkToFit(host);
      return [...host.children].map(c => c.innerHTML);
    } finally {
      host.classList.remove('on');
      host.innerHTML = '';
    }
  }

  // Prints only these pages: everything else on screen is hidden by the .printing CSS rules
  static async print(pages, pageCss, isCertificate = false) {
    const sheets = await Printer.prepare(pages);
    $('pageStyle').textContent = `@page { ${pageCss} } @media print { html, body { margin: 0; } }`;
    const area = $('printArea');
    area.innerHTML = sheets.map(s => `<div class="sheet${isCertificate ? ' cert' : ''}">${s}</div>`).join('');
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      area.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    await Files.waitImages(area);
    setTimeout(() => window.print(), 60);
  }

  // One 8.5 × 11 in PDF with a page per certificate. onProgress(done, total) lets the page show progress.
  static async pdf(pages, filename, onProgress = () => {}) {
    await Libraries.load('html2canvas', 'jspdf');
    const sheets = await Printer.prepare(pages);
    const pdf = new window.jspdf.jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' });
    const host = $('offscreen');
    host.classList.add('on');
    try {
      for (let i = 0; i < sheets.length; i++) {
        host.innerHTML = sheets[i];
        await Files.waitImages(host);
        const canvas = await window.html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        if (i > 0) pdf.addPage('letter', 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 8.5, 11);
        onProgress(i + 1, sheets.length);
      }
      pdf.save(filename);
    } finally {
      host.classList.remove('on');
      host.innerHTML = '';
    }
  }
}
