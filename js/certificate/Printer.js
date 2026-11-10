import { $ } from '../utils/helpers.js';
import { Files } from '../utils/Files.js';
import { Libraries } from '../utils/Libraries.js';

// Printing and PDF output for certificates and release slips
export class Printer {
  // Prints only `inner`: everything else on the page is hidden by the .printing CSS rules
  static print(inner, pageCss, isCertificate = false) {
    $('pageStyle').textContent = `@page { ${pageCss} } @media print { html, body { margin: 0; } ` +
      `${isCertificate ? '#printArea { width: 8.5in; height: 11in; overflow: hidden; }' : ''} }`;
    const area = $('printArea');
    area.innerHTML = inner;
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      area.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    Files.waitImages(area).then(() => document.fonts.ready).then(() => setTimeout(() => window.print(), 60));
  }

  // Draws the page off-screen and saves it as an 8.5 × 11 in PDF
  static async pdf(inner, filename) {
    await Libraries.load('html2canvas', 'jspdf');
    const host = $('offscreen');
    host.innerHTML = inner;
    host.classList.add('on');
    try {
      await Files.waitImages(host);
      await document.fonts.ready;
      const canvas = await window.html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const pdf = new window.jspdf.jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 8.5, 11);
      pdf.save(filename);
    } finally {
      host.classList.remove('on');
      host.innerHTML = '';
    }
  }
}
