# Normalize state

## Summary

Zapier-callable Edge Function that turns messy US state cells (full names, mixed-case abbreviations, address fragments) into a two-letter USPS code such as `NY`. Unrecognized values return empty `state` and `state_name`; the function does not return an error payload for unknown input.

## Scope

**In scope:** `normalize-state` function, shared US state lookup.

**Out of scope:** Google Sheets lead ingest (`sheets-webhook`); writing back to Sheets (Zapier).

## Primary responsibilities

- Accept `POST { "state": "<raw>" }` from Zapier.
- Return `{ "state": "NY", "state_name": "New York" }` when recognized.
- Return empty `state` and `state_name` when unrecognized (`usa`, blanks, junk) so Zapier only receives a two-letter abbreviation or nothing.
- No webhook secret. Zapier only needs the URL and JSON body.

## Dependencies

- **External:** Zapier Webhooks POST.

## How to navigate the code

- `supabase/functions/normalize-state/index.ts` — HTTP handler.
- `supabase/functions/_shared/usState.ts` — name/abbr maps and `toStateAbbr()`.

## Zapier contract

- **URL:** `https://<project-ref>.supabase.co/functions/v1/normalize-state`
- **Method:** POST
- **Headers:** none required (`Content-Type: application/json` is set by Zapier Payload Type Json)
- **Body:** `{ "state": "{{sheet_state_column}}" }`
- **Response (200):** `{ "state": "NY", "state_name": "New York" }`
- Map response `state` into the next Zap step.

Unrecognized JSON or a missing `state` field still returns 200 with `{ "state": "", "state_name": "" }`. A non-POST method returns 405.

## Deploy

```bash
npx supabase functions deploy normalize-state --no-verify-jwt
```
