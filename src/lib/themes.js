/* =========================================================
   lib/themes.js — theme/font/paper registry + application
   Port of js/themes.js
   ========================================================= */

export const THEMES = [
  { id: 'classic', name: 'Classic Journal', desc: 'Cream paper, leather cover, vintage calm.' },
  { id: 'minimal', name: 'Minimal White', desc: 'Clean white pages and thin gray lines.' },
  { id: 'pastel', name: 'Pastel', desc: 'Soft colors, friendly and peaceful.' },
  { id: 'vintage', name: 'Vintage', desc: 'Aged paper with a typewriter soul.' },
  { id: 'midnight', name: 'Midnight', desc: 'A quiet diary for night thoughts.' },
  { id: 'nature', name: 'Nature', desc: 'Light green paper and botanical calm.' },
  { id: 'romance', name: 'Romantic Blush', desc: 'Soft blush pinks, roses and gentle romance.' },
  { id: 'rosegarden', name: 'Rose Garden', desc: 'Fresh roses on ivory paper, charming.' },
  { id: 'teddy', name: 'Teddy Bear', desc: 'Cozy cocoa-and-bear hugs for soft days.' }
];

export const FONTS = [
  { id: 'classic', name: 'Classic' },
  { id: 'typewriter', name: 'Typewriter' },
  { id: 'handwritten', name: 'Handwritten' },
  { id: 'modern', name: 'Modern' },
  { id: 'girly', name: 'Girly Script' },
  { id: 'elegant', name: 'Elegant Serif' },
  { id: 'rounded', name: 'Rounded Soft' },
  { id: 'marker', name: 'Marker Pen' },
  { id: 'cleanmono', name: 'Clean Mono' },
  { id: 'fancy', name: 'Fancy Cursive' },
  { id: 'neat', name: 'Neat Print' },
  { id: 'storybook', name: 'Storybook' }
];

export const PAPERS = [
  { id: 'ruled', name: 'Ruled Lines' },
  { id: 'dotted', name: 'Dotted' },
  { id: 'plain', name: 'Plain' },
  { id: 'floral', name: 'Floral Lace' },
  { id: 'hearts', name: 'Hearts' },
  { id: 'teddy', name: 'Teddy Bears' },
  { id: 'stars', name: 'Little Stars' },
  { id: 'clouds', name: 'Dreamy Clouds' },
  { id: 'rainbow', name: 'Rainbow Corner' },
  { id: 'butterfly', name: 'Butterflies' },
  { id: 'strawberry', name: 'Strawberries' },
  { id: 'moon', name: 'Night Moons' }
];

export function getTheme(id) {
  return THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0];
}

/** apply but do NOT persist (used while previewing) */
export function applyPreview(id) {
  document.documentElement.setAttribute('data-theme', id);
}

export function applyFont(id) {
  document.documentElement.setAttribute('data-font', id || 'classic');
}

export function applyPaper(id) {
  document.documentElement.setAttribute('data-paper', id || 'ruled');
}

/** restore the persisted theme/font/paper onto <html> */
export function restore(s) {
  if (!s) return;
  applyPreview(s.theme || 'classic');
  applyFont(s.font || 'classic');
  applyPaper(s.paperStyle || 'ruled');
}
