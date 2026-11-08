// GL Inspire as a Lucian Office plug-in: the plug-in itself (it adds inspirations to a
// document as one undoable step, recorded as plugin:gl-inspire), and its panel for an app.
// Writer loads this from apps/glinspire when it is installed; index.html uses it on its own.
//
// The app hands over a host:
//   { api, el, settings, persist(), getDoc(), setDoc(doc), textSoFar(), say(text), sayDo(text), undoLastBy }
// settings holds bio, recentFolder, useGL and send ({ text, bio, recent }: what may go to Claude).
import { createPlugins } from './lib/core.js';
import { claudePrompt, inspirationBlocks, inspire, readInstruction, words } from './lib/inspire.js';

export const ID = 'gl-inspire';
export const definition = {
  id: ID, name: 'GL Inspire', apps: ['writer'],
  run: ({ options }) => ({ ops: inspirationBlocks(options.list).map((block) => ({ op: 'insert', block })), say: `Added ${options.list.length} inspirations.` })
};
export const DEFAULTS = { bio: '', recentFolder: '', useGL: true, send: { text: false, bio: false, recent: false } };

export function createTool(host) {
  const { api, el } = host;
  const s = host.settings;
  for (const [k, v] of Object.entries(DEFAULTS)) s[k] ??= structuredClone(v);
  const plugins = createPlugins().register(definition);
  let last = [];

  // Grammar Logic on the first word, as LucianOS's daily Grammar Logic runs it.
  async function glWords(topic) {
    if (!s.useGL || !topic) return { words: [], note: s.useGL ? 'no first word to start Grammar Logic from' : 'Grammar Logic is off' };
    try {
      const { glGoal, DEFAULT_SETTINGS } = await import('/desktop/workflows-lib.js');
      const wf = await api.state.get('workflows').catch(() => null);
      const folders = { ...DEFAULT_SETTINGS, ...(wf?.settings ?? {}) };
      const job = await api.jobs.prolog({ goal: glGoal(topic, folders), cwd: folders.awl, label: `GL Inspire: ${topic}` });
      const out = await new Promise((resolve) => {
        let text = '';
        api.jobs.stream(job.id, { output: (c) => { if (c.stream !== 'stderr') text += c.text; }, end: (st) => resolve({ text, ok: st.exitCode === 0 }) });
      });
      if (!out.ok) return { words: [], note: 'Grammar Logic did not finish (see the jobs list)' };
      return { words: out.text.split('\n').map((x) => x.trim()).filter((x) => /^[\p{L}'-]+$/u.test(x)), note: `Grammar Logic gave ${out.text.split('\n').filter(Boolean).length} words` };
    } catch (err) {
      return { words: [], note: `Grammar Logic is not available: ${err.message}` };
    }
  }

  async function recentTexts() {
    if (!s.recentFolder) return [];
    try {
      const { entries } = await api.files.recent(s.recentFolder, { days: 60, limit: 20 });
      const files = (entries ?? []).filter((e) => /\.(txt|md)$/i.test(e.name ?? e.path)).slice(0, 5);
      return Promise.all(files.map((f) => api.files.read(f.path).then((r) => r.content.slice(0, 6000), () => '')));
    } catch { return []; }
  }

  // "inspire me", "inspire me more about health": returns { doc, say }.
  async function run(doc, instruction = '') {
    const opts = readInstruction(instruction, { count: 6 });
    const text = host.textSoFar();
    const first = words(text).find((w) => w.length > 2) ?? words(s.bio).find((w) => w.length > 3);
    const gl = opts.sources && !opts.sources.includes('gl') ? { words: [], note: '' } : await glWords(first);
    const list = inspire({ text, bio: s.bio, recent: await recentTexts(), gl: gl.words }, opts);
    last = list.map((x) => ({ ...x, note: gl.note }));
    if (!list.length) return { doc, say: `I found nothing new to suggest. ${gl.note ?? ''} Add a bio or recent texts in GL Inspire.` };
    const r = await plugins.run(ID, doc, { options: { list } });
    return { doc: r.doc, say: `${r.say} ${list.slice(0, 3).map((x) => x.word).join(', ')}…` };
  }

  function view(rerender) {
    const src = (key, label, body) => el('section', { className: 'source' },
      el('header', {}, label, el('label', { title: 'Off by default. When on, this input is included if you ask Claude.' },
        el('input', { type: 'checkbox', checked: !!s.send[key], onchange: (e) => { s.send[key] = e.target.checked; host.persist(); rerender(); } }), ' send to Claude')),
      body);
    const bio = el('textarea', { rows: 3, value: s.bio, placeholder: 'A few lines about you and your interests.', onchange: (e) => { s.bio = e.target.value; host.persist(); } });
    const folder = el('input', { type: 'text', value: s.recentFolder, placeholder: 'folder of your texts, e.g. Documents/Writing', onchange: (e) => { s.recentFolder = e.target.value.trim(); host.persist(); } });
    const instruction = el('input', { type: 'text', placeholder: 'e.g. "more about health", "only positive", "3 ideas"' });
    const out = el('div');
    const showList = () => {
      out.replaceChildren();
      if (!last.length) return;
      if (last[0].note) out.append(el('p', { className: 'quiet' }, last[0].note));
      out.append(el('ol', { className: 'inspirations' }, last.map((x) => el('li', {}, el('strong', {}, x.word), ' ', x.direction, el('span', { className: 'why' }, x.why)))));
    };
    showList();
    const anySent = Object.values(s.send).some(Boolean);
    return el('div', {},
      src('text', 'Text so far', el('p', { className: 'quiet' }, `${words(host.textSoFar()).length} words, read from the page.`)),
      src('bio', 'Bio', bio),
      src('recent', 'Recent texts', folder),
      el('label', {}, el('input', { type: 'checkbox', checked: s.useGL, onchange: (e) => { s.useGL = e.target.checked; host.persist(); } }), ' Run Grammar Logic on the first word'),
      el('div', { className: 'row' },
        el('button', { className: 'primary', textContent: 'Inspire', onclick: async () => { await host.sayDo('inspire me'); showList(); } }),
        el('button', { textContent: 'Undo', title: "Undo GL Inspire's last suggestions", onclick: () => { const r = host.undoLastBy(host.getDoc(), `plugin:${ID}`); host.setDoc(r.doc); host.say(r.undone ? 'Removed the last inspirations.' : r.reason); } })),
      el('form', { className: 'row', onsubmit: async (e) => { e.preventDefault(); await host.sayDo(`inspire me ${instruction.value}`); showList(); } }, instruction, el('button', { textContent: 'Do' })),
      el('div', { className: 'row' }, el('button', {
        textContent: 'Ask Claude too', disabled: !anySent, title: anySent ? 'Sends only the inputs marked "send to Claude", shown to you first' : 'Mark an input "send to Claude" first (all are off by default)',
        onclick: async () => {
          const prompt = claudePrompt({ text: host.textSoFar(), bio: s.bio, recent: await recentTexts() }, s.send, instruction.value);
          if (!prompt) return;
          try {
            const { askClaude } = await import('/shared/claude.js');
            const reply = await askClaude({ purpose: 'GL Inspire', prompt });
            if (reply) out.append(el('h3', {}, 'From Claude (labelled, not added to the text)'), el('pre', { className: 'output' }, reply));
          } catch (err) { out.append(el('p', { className: 'bad' }, err.message)); }
        }
      })),
      out);
  }

  return { id: ID, name: 'GL Inspire', run, view, last: () => last };
}

export const CSS = `.source{border:1px solid #8884;border-radius:6px;padding:6px 8px;margin:6px 0}.source header{display:flex;justify-content:space-between;gap:6px;font-weight:600;flex-wrap:wrap}.source header label{font-weight:normal;font-size:.85em}ol.inspirations li{margin:6px 0}ol.inspirations .why{font-size:.8em;color:#777;display:block}`;
