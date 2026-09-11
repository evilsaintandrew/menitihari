/** Client-safe labels for the curated presentation controls in the theme registry. */
export const FONT_PAIRING_OPTIONS = Object.freeze([
  { id: "serif-sans", label: "Serif + Sans", description: "Romantis dengan teks yang mudah dibaca." },
  { id: "display-sans", label: "Display + Sans", description: "Tegas di judul, ringan di isi." },
  { id: "sans-serif", label: "Sans + Sans", description: "Bersih, modern, dan sederhana." },
  { id: "script-sans", label: "Script + Sans", description: "Sentuhan tulisan tangan dengan isi yang jelas." },
] as const);

export const COVER_STYLE_OPTIONS = Object.freeze([
  { id: "centered", label: "Centered", description: "Nama pasangan menjadi fokus utama." },
  { id: "editorial", label: "Editorial", description: "Komposisi asimetris yang elegan." },
  { id: "framed", label: "Framed", description: "Bingkai tipis untuk kesan klasik." },
  { id: "full-bleed", label: "Full bleed", description: "Aksen warna memenuhi area cover." },
] as const);
