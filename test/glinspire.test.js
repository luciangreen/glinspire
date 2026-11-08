import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspire, readInstruction, claudePrompt, inspirationBlocks } from '../lib/inspire.js';
import { createTool, definition } from '../plugin.js';
import { createDocument, createPlugins, undoLastBy } from '../lib/core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (f) => fs.readFileSync(path.join(HERE, 'fixtures', f), 'utf8');
const sources = () => ({ text: fixture('essay.txt'), bio: fixture('bio.txt'), recent: [fixture('recent.txt')], gl: ['practice', 'wisdom', 'breathing', 'clarity', 'joy', 'teacher', 'stress'] });

test('GL Inspire scores new, connected, positive, linking words, and explains each score', () => {
  const list = inspire(sources(), { count: 6 });
  assert.equal(list.length, 6);
  const words = list.map((x) => x.word);
  assert.ok(!words.some((w) => /meditation|students|calm/.test(w)), 'words already in the text are not suggested');
  assert.ok(!words.includes('stress') && !words.includes('failure'), 'negative words are not suggested');
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score, 'ranked by score');
  const music = list.find((x) => x.word === 'music');
  assert.ok(music, 'music: beside meditation and students, positive');
  assert.ok(music.parts.connected.includes('meditation'));
  assert.equal(music.parts.positive, 1);
  assert.match(music.why, /^music: [\d.]+ = new/);
  assert.ok(list.every((x) => x.direction.includes(x.word)));
  const p = music.parts;
  assert.equal(music.score, Math.round((2 * Math.min(p.connected.length, 5) + 1.5 * Math.min(p.links.length, 5) + p.positive + p.new) * 100) / 100);
});

test('GL Inspire follows a focus, a positive-only request and a choice of sources', () => {
  const focused = inspire(sources(), readInstruction('more about health', { count: 4 }));
  assert.ok(focused.some((x) => x.parts.focus));
  assert.equal(focused[0].word, 'health', 'the focus itself comes first');
  assert.ok(focused.filter((x) => x.parts.focus).length >= 3, 'words near the focus rise');
  assert.ok(inspire(sources(), { count: 10, positiveOnly: true }).every((x) => x.parts.positive > 0));
  const glOnly = inspire(sources(), { count: 10, sources: ['gl'] });
  assert.ok(glOnly.every((x) => x.from.includes('gl')));
  assert.deepEqual(readInstruction('3 ideas just from my bio, only positive'), { count: 3, positiveOnly: true, sources: ['bio'] });
  assert.equal(readInstruction('fewer', { count: 8 }).count, 4);
});

test('nothing is prepared for Claude unless an input is switched on, and inputs are labelled', () => {
  const s = sources();
  assert.equal(claudePrompt(s, {}), null);
  const p = claudePrompt(s, { bio: true });
  assert.match(p, /^Author's bio:/);
  assert.ok(!p.includes('Text so far') && !p.includes('recent texts'));
  assert.equal(inspirationBlocks(inspire(s, { count: 2 }))[0].type, 'inspiration');
});

test("the plug-in's edits are recorded as GL Inspire's and can be undone alone", async () => {
  const plugins = createPlugins().register(definition);
  const d = createDocument({ blocks: [{ id: 'a', type: 'paragraph', text: 'Text.' }] });
  const r = await plugins.run('gl-inspire', d, { options: { list: inspire(sources(), { count: 2 }) } });
  assert.equal(r.doc.blocks.length, 3);
  assert.equal(r.doc.blocks[1].type, 'inspiration');
  assert.equal(undoLastBy(r.doc, 'plugin:gl-inspire').doc.blocks.length, 1);
});

test('the tool inspires a document through its host, from the bio and recent texts, without Grammar Logic', async () => {
  const s = sources();
  const settings = { bio: s.bio, recentFolder: 'Writing', useGL: false };
  const api = { files: { recent: async () => ({ entries: [{ path: 'Writing/recent.txt', name: 'recent.txt' }] }), read: async () => ({ content: s.recent[0] }) }, state: { get: async () => null } };
  let doc = createDocument({ blocks: [{ id: 'a', type: 'paragraph', text: s.text }] });
  const tool = createTool({ api, el: () => null, settings, persist: () => {}, getDoc: () => doc, setDoc: (d) => { doc = d; }, textSoFar: () => s.text, say: () => {}, sayDo: async () => {}, undoLastBy });
  assert.deepEqual(settings.send, { text: false, bio: false, recent: false }, 'nothing is sent to Claude by default');
  const r = await tool.run(doc, '3 ideas');
  assert.match(r.say, /^Added 3 inspirations\./);
  assert.equal(r.doc.blocks.filter((b) => b.type === 'inspiration').length, 3);
  assert.equal(tool.last()[0].note, 'Grammar Logic is off');
});
