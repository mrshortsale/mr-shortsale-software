# Batch Leads Incremental Sync — Spike & Design Notes

## Goal

Implement incremental sync that only inserts new leads and updates changed leads
since the last successful sync, rather than re-fetching all ~70k records every run.

---

## API Spike — `POST /api/v1/property` Date Filtering

### What we know from the API response

Every property row returned by `POST /api/v1/property` includes:

```json
{
  "id": 123456,
  "created_date": "2026-01-15T08:30:00Z",
  "updated_date": "2026-04-10T14:22:00Z",
  ...
}
```

Both `created_date` and `updated_date` are always present in the raw payload.

### Spike test plan

Run three calls against the real API and compare `meta.total`:

```bash
# Call 1: Baseline (no date filter)
POST /api/v1/property
{ "list_id": [], "lead_status": [1], ... }
# Expected: meta.total ≈ 70,000

# Call 2: Incremental candidate (if API supports date_from)
POST /api/v1/property
{ "list_id": [], "lead_status": [1], "date_from": "2026-05-10T00:00:00Z", ... }
# Expected: meta.total << 70,000

# Call 3: Sanity — yesterday filter
POST /api/v1/property
{ "list_id": [], "lead_status": [1], "date_from": "2026-05-17T00:00:00Z", ... }
# Expected: meta.total near 0 or very small
```

Known candidate filter fields (from Batch Leads API docs / batchservice.com):
- `date_from` / `date_to`  (filter by `created_date`)
- `update_date_from` / `update_date_to`  (filter by `updated_date`)

**Status: To be run.** Until then, the implementation uses `updated_date` row-level
filtering as a guaranteed-safe approach (see Implementation section).

### Exit criteria

| Check | Pass |
|-------|------|
| API accepts filter without error | Verify 200 status |
| `meta.total` is smaller than baseline | Passes if not 0 and < 70k |
| Sample rows all have `updated_date >= since` | Inspect 5–10 rows |
| Pagination with filter still produces correct `last_page` | Check `meta.last_page` |

---

## Implementation Strategy

Because we cannot guarantee the Batch API offers server-side date filtering,
the implementation uses **row-level filtering + sort by updated_date**:

1. Sort the API request by `updated_date desc` (if supported) so newest records
   come first. This enables **early stop**: once a full page has no rows with
   `updated_date >= since`, we stop paging.
2. For each row, check `updated_date` against the watermark. Skip rows that are
   strictly older — do not upsert them.
3. Insert/update only qualifying rows.

**Trade-off:** We still make API calls for all pages until early-stop triggers.
If Batch's server-side date filter is confirmed, we add it to the request body
to reduce total API pages requested, but the row-level guard remains regardless.

### Watermark

The watermark is `completed_at` of the last `status = success` run in
`inventory_sync_runs`, minus a 10-minute buffer to handle clock skew and any
reprocessing boundary. If no successful run exists, incremental is rejected
with a 400: "Run a full refresh first."

```
since = lastSuccessRun.completed_at - 10 minutes
```

---

## Confirmed Results (fill in after spike)

| Call | `meta.total` | Sample row `updated_date` | Notes |
|------|-------------|--------------------------|-------|
| Baseline | — | — | — |
| `date_from = last week` | — | — | — |
| `date_from = yesterday` | — | — | — |

**Server-side date filter supported?** — (Yes / No / Partial)

**Fields to use:** —

---

## Go / No-Go

| Result | Action |
|--------|--------|
| Server-side filter supported | Add `date_from` / `update_date_from` to incremental request body in addition to row-level filter |
| Server-side filter not supported | Row-level filter still works; early-stop by `updated_date desc` sort reduces pages processed |
| API rejects `updated_date` sort | Fall back to `id` sort; early-stop disabled; row-level filter still applied |

Implementation proceeds regardless — server-side filter is an optimization,
not a requirement, because row-level `updated_date` filtering is always available.
