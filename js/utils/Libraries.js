import { LIBS } from '../config.js';
import { AppError } from './helpers.js';

// Loads the export libraries from cdnjs the first time they are needed
export class Libraries {
  static #loading = {};

  static async load(...names) {
    for (const name of names) await Libraries.#loadOne(name);   // in order: autotable needs jspdf first
  }

  static #loadOne(name) {
    if (!Libraries.#loading[name]) {
      Libraries.#loading[name] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIBS[name];
        s.onload = resolve;
        s.onerror = () => {
          delete Libraries.#loading[name];
          reject(new AppError(`Could not load ${name} from cdnjs. Check the internet connection and try again.`));
        };
        document.head.appendChild(s);
      });
    }
    return Libraries.#loading[name];
  }
}
