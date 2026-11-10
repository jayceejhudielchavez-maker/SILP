import { CertificateTemplate } from './CertificateTemplate.js';

// Adds the template's Google Fonts to the page once each, so every laptop shows the same fonts
export class FontLoader {
  #loaded = new Set();

  ensure(template) {
    for (const family of template.fontFamilies) {
      if (this.#loaded.has(family)) continue;
      this.#loaded.add(family);
      document.head.insertAdjacentHTML('beforeend', CertificateTemplate.fontLinks([family]));
    }
  }
}
