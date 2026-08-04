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
