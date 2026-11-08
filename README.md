# GL Inspire

GL Inspire suggests inspiring keywords and new directions for a text. It is a [Lucian Office](https://github.com/luciangreen/lucianoffice) plug-in: it appears as a tab in [Writer](https://github.com/luciangreen/writer) when installed beside it, and opens on its own in [LucianOS](https://github.com/luciangreen/lucianos) for any text you paste.

The work is done by an algorithm you can open and improve. Claude is optional and off by default.

GL Inspire suggests inspiring keywords and new directions for the text.

- **Where the words come from:**
  - Grammar Logic (`grammar_logic_to_alg1`, run as a LucianOS Prolog job with the folders from your workflow settings, starting from the first word of the text);
  - your **bio**;
  - your **recent texts** (the newest .txt and .md files in a folder you choose).
- **How each word is scored** (shown, not hidden):

  | Part | Points |
  | --- | --- |
  | **new** | 1 ÷ how often the word appears in your inputs; words already in the text are never suggested |
  | **connected** | +2 for each word of the text it appears beside (up to 5); shared stems count too |
  | **positive** | +1 for a positive word; negative words are not suggested |
  | **links** | +1.5 for each other new word it appears beside (up to 5), so it opens a direction rather than a dead end |
  | **focus** | +3 when it is near the focus you asked for |

- **Buttons:**
  - **Inspire** adds the best ones to the page as inspiration notes, each with a direction ("Connect meditation to music, then follow it to enjoy").
  - **Undo** removes them.
  - The instruction field with **Do** takes requests such as "more about health", "only positive", "3 ideas" or "just from my bio".
- **Claude:** each input (the text so far, the bio, recent texts) has its own **send to Claude** switch, off by default. **Ask Claude too** sends only the inputs you switched on, labelled, through LucianOS's Claude settings, which show the text before it is sent. Claude's reply is shown separately and is not added to the page.
- **Undo:** the inspirations are one step recorded as `plugin:gl-inspire`, so they can be taken back on their own, leaving your edits.

## Install

From your `lucianos` folder:

```sh
git clone https://github.com/luciangreen/lucianoffice apps/lucianoffice
git clone https://github.com/luciangreen/glinspire apps/glinspire
```

Writer finds it in `apps/glinspire` and shows its tab. On its own it opens at `/apps/glinspire/`.

## For apps

`plugin.js` exports the plug-in `definition` (for `createPlugins().register`) and `createTool(host)`, which gives `run(doc, instruction)` and `view(rerender)` (the panel). The host is `{ api, el, settings, persist, getDoc, setDoc, textSoFar, say, sayDo, undoLastBy }`.

## Tests

```sh
npm test
```

The tests cover:

- the scores on sample texts (`test/fixtures`);
- following a focus, a positive-only request and a choice of sources;
- preparing nothing for Claude unless you switch an input on;
- the plug-in's undoable edits;
- running through a host without Grammar Logic.
