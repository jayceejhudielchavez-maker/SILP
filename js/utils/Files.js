import { AppError } from './helpers.js';

export class Files {
  static download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // Opens the file chooser; resolves with the file, or null if cancelled
  static pick(accept) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  }

  // Reads a picture and shrinks it to at most `max` px so it stays small in the database
  static readImage(file, max = 1000) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new AppError('Please choose a picture file (PNG or JPG).'));
      const reader = new FileReader();
      reader.onerror = () => reject(new AppError('Could not read that file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new AppError('That picture could not be opened.'));
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * k));
          canvas.height = Math.max(1, Math.round(img.height * k));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const keepAlpha = /png|webp|gif/.test(file.type);   // keeps transparent signatures/logos transparent
          resolve(canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.9));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  static waitImages(root) {
    return Promise.all([...root.querySelectorAll('img')]
      .map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  }
}
