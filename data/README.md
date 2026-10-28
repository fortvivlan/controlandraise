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
