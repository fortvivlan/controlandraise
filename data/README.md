# Static questionnaire data

`questionnaire.json` is a generated, public deployment artifact. Do not edit it by
hand. Its private HTML sources, workbook parser, and validation logic live in the
separate `grant-database` repository, which is intentionally ignored by this site
repository.

With `grant-database/` checked out inside this repository, regenerate the SQLite and
static artifacts together from that directory:

```bash
uv run python rebuild_database.py --json-output ../data/questionnaire.json
```

Review the reported coverage and the JSON diff before committing the site update.
