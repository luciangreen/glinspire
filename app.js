// GL Inspire on its own: write or paste a text, and get inspiring keywords and directions for it.
import { api } from '/shared/api.js';
import { apply, characterHandler, createCommands, createDocument, undoLastBy } from './lib/core.js';
import { CSS, createTool } from './plugin.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
document.head.append(el('style', { textContent: CSS }));

let settings = {};
let doc = createDocument({ app: 'glinspire', blocks: [{ id: 'text', type: 'paragraph', text: '' }] });
const persist = () => { api.state.set('glinspire', settings).catch(() => {}); };
const show = () => {
  const list = doc.blocks.filter((b) => b.type === 'inspiration');
  $('added').replaceChildren(...(list.length ? list.map((b) => el('blockquote', { className: 'inspiration', title: b.why ?? '', textContent: b.text })) : [el('p', { className: 'quiet', textContent: 'None yet.' })]));
};
const host = {
  api, el, settings, persist, undoLastBy,
  getDoc: () => doc,
  setDoc: (d) => { doc = d; show(); },
  textSoFar: () => $('text').value,
  say: (t) => { $('reply').textContent = t; },
  sayDo: async (t) => { const r = await handle({ intent: 'unknown', text: t }, t); host.say(r ?? commands.help()); return r; }
};
let tool;
const commands = createCommands({ app: 'GL Inspire' }).register({ name: 'inspire', patterns: ['inspire me', 'inspire', 'give me ideas', 'inspire me {instruction}'], help: 'inspire me', run: async ({ args, doc: d }) => tool.run(d, args.instruction ?? '') });
const handle = characterHandler(commands, () => doc, (d) => { doc = d; show(); });
addEventListener('message', async (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'lucianos.command') return;
  const reply = await handle({ intent: 'unknown', text: e.data.text }, e.data.text);
  e.source.postMessage({ type: 'lucianos.reply', id: e.data.id, text: reply }, location.origin);
});
if (parent !== window) parent.postMessage({ type: 'lucianos.commands', names: commands.list().map((c) => c.name) }, location.origin);

async function init() {
  Object.assign(settings, (await api.state.get('glinspire').catch(() => null)) ?? {});
  tool = createTool(host);
  const draw = () => $('tool').replaceChildren(tool.view(draw));
  $('text').addEventListener('change', () => { doc = apply(doc, [{ op: 'set', id: 'text', key: 'text', value: $('text').value }], { by: 'user', label: 'edited the text' }); draw(); });
  draw();
}
init();
