// Supabase project (Project Settings → API). The publishable key is meant to be public;
// the database protects itself with row level security and role checks in every function.
export const SUPABASE_URL = 'https://zzykegbesieewnbzjygb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_3OgpwhEaZgdKyEPIQPJu8g_gd36POWW';

// Usernames sign in as <username>@sanisidro-fhc.local (must match supabase/schema.sql)
export const EMAIL_DOMAIN = '@sanisidro-fhc.local';

// Certificate page: short bond, 8.5 × 11 in at 96 px per inch
export const PAGE_W = 816;
export const PAGE_H = 1056;

// Export libraries, pinned versions from cdnjs, loaded only when needed
export const LIBS = {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
};

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

export const PARISH = 'Parish and Archdiocesan Shrine of San Isidro Labrador';
export const PARISH_PLACE = 'Cuenca, Batangas';
