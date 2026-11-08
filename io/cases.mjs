// The functions whose inputs and outputs are recorded in io/ios.txt (see io/engine.mjs).
import { inspire, readInstruction, words } from '../lib/inspire.js';

export const title = 'GL Inspire';

const BIO = ['I write books on meditation, pedagogy and computer science.', 'Lucian likes logic, music and gardens.', 'A teacher who sells courses about algorithms.', ''];

export const cases = [
  { name: 'words', run: words, make: (rnd) => [rnd.sentence() + rnd.pick(['', " Don't stop!", ' 3 apples.'])] },
  { name: 'inspire', run: (input, opts) => inspire(input, opts), make: (rnd) => [{ text: Array.from({ length: rnd.int(1, 3) }, () => rnd.sentence()).join(' '), bio: rnd.pick(BIO), recent: rnd.chance(0.5) ? [rnd.sentence()] : [], gl: rnd.some(['music', 'logic', 'teacher', 'garden', 'proof', 'happy'], 0, 4) }, { count: rnd.int(1, 6), positiveOnly: rnd.chance(0.3) }] },
  { name: 'readInstruction', run: readInstruction, make: (rnd) => [rnd.pick(['inspire me', 'inspire me with 3 ideas about music', 'only positive', 'give me 5 ideas from my bio', 'focus on logic', 'ideas from recent writing', 'more', rnd.words(2, 5)])] }
];
