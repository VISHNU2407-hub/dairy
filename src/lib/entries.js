/* =========================================================
   lib/entries.js — mood/weather/prompt data + helpers
   Port of the data parts of js/diary.js
   ========================================================= */
import { clamp } from './utils.js';

export const MOODS = [
  { id: 'happy', emoji: '\uD83D\uDE0A', label: 'Happy' },
  { id: 'calm', emoji: '\uD83D\uDE0C', label: 'Calm' },
  { id: 'neutral', emoji: '\uD83D\uDE10', label: 'Normal' },
  { id: 'sad', emoji: '\uD83D\uDE14', label: 'Sad' },
  { id: 'angry', emoji: '\uD83D\uDE24', label: 'Angry' },
  { id: 'excited', emoji: '\uD83D\uDE0D', label: 'Excited' },
  { id: 'tired', emoji: '\uD83D\uDE34', label: 'Tired' },
  { id: 'motivated', emoji: '\uD83E\uDD29', label: 'Motivated' }
];

export const WEATHERS = [
  { id: 'sunny', emoji: '\u2600\uFE0F', label: 'Sunny' },
  { id: 'cloudy', emoji: '\u2601\uFE0F', label: 'Cloudy' },
  { id: 'rainy', emoji: '\uD83C\uDF27\uFE0F', label: 'Rainy' },
  { id: 'stormy', emoji: '\u26C8\uFE0F', label: 'Stormy' },
  { id: 'cold', emoji: '\u2744\uFE0F', label: 'Cold' }
];

export const PROMPTS = [
  'What made you smile today?',
  'What did you learn today?',
  'What was difficult today?',
  'What are you grateful for?',
  'What do you want to remember about today?',
  'What would you do differently?',
  'What are you looking forward to?',
  'Who made a difference in your day today?',
  'What was the most peaceful moment today?',
  'If today had a title, what would it be?',
  'What small thing did you enjoy today?',
  'What thought is circling your mind?',
  'How did you take care of yourself today?',
  'What did you notice that you usually miss?'
];

export function moodMeta(id) {
  return MOODS.filter(function (m) { return m.id === id; })[0] || null;
}

export function weatherMeta(id) {
  return WEATHERS.filter(function (w) { return w.id === id; })[0] || null;
}

export function emoji(mood) {
  const m = moodMeta(mood);
  return m ? m.emoji : '';
}

export function freshEntry(dateISO) {
  return {
    id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    date: dateISO,
    title: '', mood: '', weather: '', location: '', content: '',
    tags: [], favorite: false,
    energy: null, sleep: '', highlights: '', gratitude: '',
    page: null, createdAt: null, updatedAt: null
  };
}

export function cloneEntry(e) {
  const copy = Object.assign({}, e);
  copy.tags = (e.tags || []).slice();
  return copy;
}

export function hasContent(e) {
  return !!(e && (
    e.title.trim() || e.content.trim() || e.mood || e.weather || e.location.trim() ||
    (e.tags && e.tags.length) || e.highlights.trim() || e.gratitude.trim()
  ));
}

export function energyText(n) {
  const v = Number(n);
  if (!v) return '';
  if (v <= 3) return 'Low energy';
  if (v <= 6) return 'Medium energy';
  if (v <= 8) return 'Good energy';
  return 'High energy';
}

export function energyDots(n) {
  const v = clamp(Number(n), 1, 10);
  let out = '';
  for (let i = 1; i <= 10; i++) out += i <= v ? '\u25CF' : '\u25CB';
  return out + ' ' + energyText(v);
}

export function randomPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}
