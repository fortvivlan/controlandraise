# Static questionnaire data

`questionnaire.json` is a generated, public deployment artifact. Do not edit it by
hand. Its user-maintained HTML sources, workbook parser, and validation logic live in
the separate local `grant-database` workspace, which is intentionally ignored by this
site repository.

With `grant-database/` inside this repository, regenerate the static artifact from
that directory:

```bash
uv run --frozen python rebuild_questionnaire.py
```

The builder only reads `grant-database/languages/*.html`; those files are edited by
the user, never by the script. Review the reported coverage and JSON diff before
committing the site update.

## External possessor database

`external-possessor.json` is the generated public dataset for `poss-database.html`
and `poss-database_en.html`. Do not edit it by hand. The Excel sources, explicit
bilingual questionnaire hierarchy, language/sheet registry, builder, and tests live
in the ignored local `poss-database/` workspace. Back up that workspace separately.

Regenerate and test from the site root with Python 3.10 or later (standard library
only):

```bash
python3 poss-database/rebuild_possessor.py
python3 -m unittest discover -s poss-database/tests
npm ci --prefix poss-database
node --test poss-database/tests/browser.test.cjs
```

Serve the site over HTTP to preview; the database pages fetch their JSON dataset.
The optional browser interaction tests use Node.js and the ignored workspace's
locked jsdom development dependency; the Python builder needs no dependencies.
The builder preserves blank responses and always provides additional comments and
Bibliography entries. Authors can add missing bibliography rows to their Excel
sheets later. Review the generated JSON diff before publishing.

## Adverbials database

`adverbials.json` is the generated public dataset for `adverbials-database.html`
and `adverbials-database_en.html`. Its read-only source and public download are
`files/БАЗА_АДВЕРБИАЛЫ_2025_2026_валентности_конструкции.xlsx`.
Never edit the generated JSON by hand or rewrite the workbook during a rebuild.

The standalone builder, bilingual field registry, and tests live in the ignored
`adverbials-database/` workspace. Back up that workspace separately. Python 3.10+
needs no third-party packages. From the site root:

```bash
python3 adverbials-database/rebuild_adverbials.py
python3 -m unittest discover -s adverbials-database/tests
npm ci --prefix adverbials-database
node --test adverbials-database/tests/browser.test.cjs
```

The browser tests need Node.js 20.19+, 22.12+, or 24+ (jsdom 30). If the possessor
workspace already has the same dependencies, tests can also run without installing
another copy:

```bash
NODE_PATH=./poss-database/node_modules node --test adverbials-database/tests/browser.test.cjs
```

The importer recognizes the populated worksheet and header, imports every noun
row from A–H and J–V, and combines valid text in W–Y into Origin. Column I is
excluded. Excel errors are reported by cell address; errors without usable Origin
text remain explicit source errors, distinct from blanks. Published field errors,
unrecognized headers, or extra populated columns prevent replacing the artifact.
Source metadata, checksum, source row references, and diagnostics are retained in
JSON. Empty values are omitted; nonempty values store `text`, optional formatted
`html`, and optional `state: "error"`. No background fills are imported.

Serve the site over HTTP for preview. The browser fetches only the generated JSON;
Python and the ignored workspace are unnecessary for hosting. Review the reported
counts and generated diff after workbook updates. The original Russian text and
codes are shared by both interfaces; labels and help text are bilingual. Filtering
and column choices apply on Show, and export uses every matching entry from the
last displayed selection, across all result pages.
