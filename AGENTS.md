# AGENTS — Features inventory (any tech stack)

These instructions apply to **this repository**, regardless of language, framework, or layout. When the user asks to **build**, **refresh**, or **update the features list** (or similar), follow this document **unless** they explicitly override it.

---

## Purpose

Maintain a **machine-friendly feature map** under `docs/features/` so humans and automation can:

- See what the product does in **feature-sized** chunks.
- Know which **code paths** belong to each feature (for PR impact, onboarding, and AI updates).

**This workflow only creates or updates files under `docs/features/`** unless the user explicitly asks to change application code or other documentation.

---

## Tech stack neutrality

- Do **not** assume a specific folder layout (`src/`, `app/`, `lib/`, `packages/`, etc.). **Infer** structure from what exists in the repo.
- Use **repository-root-relative paths** only, POSIX-style (`/`). No absolute disk paths.
- Features may map to services, modules, packages, plugins, apps in a monorepo, or logical domains—choose what best matches **this** codebase.

---

## Step 1 — Directory and file layout (required)

1. If `docs/features/` does not exist, **create** it (including parent `docs/` if needed).
2. For each distinct feature, create a folder:
   - `docs/features/<feature-slug>/`
3. Inside each feature folder, create **exactly these two files** (names tied to the slug):
   - `docs/features/<feature-slug>/<feature-slug>.md` — human-readable description.
   - `docs/features/<feature-slug>/<feature-slug>.paths.json` — structured paths for scripts.

**Naming — `<feature-slug>`:**

- Lowercase ASCII.
- Words separated by **hyphens** (e.g. `user-auth`, `billing-webhook`).
- Stable over time (do not rename slugs casually; add a new slug if the feature splits).

---

## `<feature-slug>.md` — Content guidelines

Include, in clear prose (adapt headings as needed):

- **Title** — Same as or derived from `title` in the JSON file.
- **Summary** — What the feature does for users or the system.
- **Scope** — In/out of scope in one short list.
- **Primary responsibilities** — Bullets.
- **Dependencies** — Other features, external systems, env vars (names only, no secrets).
- **How to navigate the code** — Pointers to the most important paths listed in the JSON (directories or files).
- **Open questions / gaps** — Optional; use when the mapping is uncertain.

Do **not** paste secrets, tokens, or private URLs. Do **not** duplicate large API contracts here unless the user asks—prefer pointing at existing docs or code entrypoints.

---

## `<feature-slug>.paths.json` — Required schema

Single JSON object per file. **Valid JSON only** (double quotes, no trailing commas).

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| `schema_version` | string | yes | Use `"1"` until a future migration changes the contract. |
| `feature_id` | string | yes | Must equal `<feature-slug>`. |
| `title` | string | yes | Short human title. |
| `description` | string | no | One-line summary for tools. |
| `source_paths` | array of string | yes | Repo-relative files and/or directories that **primarily implement** this feature. Empty array only if truly unknown—then set `mapping_confidence` to `"low"` and explain in the `.md` file. |
| `related_paths` | array of string | no | Tests, config, CI, infra, or docs that are **strongly tied** to this feature. |
| `entrypoints` | array of string | no | Main entry files (CLI main, server bootstrap, route index, etc.) if identifiable. |
| `mapping_confidence` | string | no | One of: `"high"`, `"medium"`, `"low"`. |

**Path rules:**

- Prefer **directories** when a whole subtree belongs to the feature (easier for prefix matching in PR scripts).
- Prefer **files** when scope is small or shared folders would create false positives.
- Paths must exist in the repo at the time of writing (no speculative paths).

**Example:**

```json
{
  "schema_version": "1",
  "feature_id": "example-feature",
  "title": "Example feature",
  "description": "Illustrates JSON shape only.",
  "source_paths": ["services/example/", "packages/example-core/src/"],
  "related_paths": ["services/example/tests/", "docs/example.md"],
  "entrypoints": ["services/example/cmd/server/main.go"],
  "mapping_confidence": "high"
}