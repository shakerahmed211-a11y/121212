// Checks data/bank.json after you edit it: node tools/validate-bank.mjs
import fs from 'node:fs';
const bank = JSON.parse(fs.readFileSync(new URL('../data/bank.json', import.meta.url), 'utf8'));
const cats = new Set(['soil', 'concrete', 'asphalt', 'aggregate', 'history', 'arts', 'geography', 'science', 'sports']);
const seen = new Set(); let bad = 0;
bank.forEach((x, i) => {
  const why = [];
  if (!cats.has(x.c)) why.push('فئة غير معروفة');
  if (!x.q || x.q.length > 170) why.push('السؤال فاضي أو أطول من 170 حرف');
  if (!Array.isArray(x.o) || x.o.length !== 4 || new Set(x.o).size !== 4 || x.o.some((o) => !o || o.length > 55)) why.push('لازم 4 اختيارات مختلفة، كل واحد أقصر من 55 حرف');
  if (![0, 1, 2, 3].includes(x.a)) why.push('رقم الإجابة الصح لازم يكون 0 لـ 3');
  if (![1, 2, 3].includes(x.l)) why.push('المستوى لازم يكون 1 أو 2 أو 3');
  if (seen.has(x.q)) why.push('سؤال مكرر');
  seen.add(x.q);
  if (why.length) { bad++; console.log(`#${i}: ${why.join('، ')} -> ${String(x.q).slice(0, 50)}`); }
});
const by = {}; bank.forEach((x) => (by[x.c] = (by[x.c] || 0) + 1));
console.log('الأسئلة:', bank.length, by, bad ? `${bad} فيها مشاكل` : 'كلها سليمة');
process.exit(bad ? 1 : 0);
