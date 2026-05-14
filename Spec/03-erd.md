# Mr. Short Sale — Entity Relationship Diagram

> **Live today:** `USERS` table only (Supabase Postgres).  
> All other entities are in-memory TypeScript and will become database tables in the production build.

---

## Diagram

![Mr. Short Sale ERD](./erd-mr-short-sale.png)

---

## Mermaid Source

```mermaid
erDiagram

    USERS {
        uuid        id              PK
        text        email
        text        name
        text        password_hash
        text        role
        text        avatar_color
        boolean     is_active
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    LEADS {
        uuid        id                    PK
        uuid        assigned_agent        FK
        text        homeowner_name
        text        phone
        text        email
        text        language_preference
        text        address
        text        city
        text        state
        text        zip
        text        county
        text        filing_type
        date        filing_date
        date        auction_date
        int         days_to_auction
        numeric     estimated_value
        numeric     mortgage_balance
        numeric     equity_pct
        numeric     purchase_price
        date        purchase_date
        text        mortgage_lender
        text        data_source_primary
        boolean     attom_verified
        int         urgency_score
        boolean     ai_script_ready
        text        call_status
        boolean     prior_contact
        timestamptz last_call_date
        text        last_call_outcome
        boolean     sms_sent
        text        sms_status
        timestamptz callback_scheduled_at
        int         beds
        numeric     baths
        int         sqft
        int         year_built
        timestamptz created_at
        timestamptz updated_at
    }

    SHORT_SALE_CASES {
        uuid        id              PK
        uuid        lead_id         FK
        text        stage
        text        bank
        text        attorney
        date        submission_date
        date        expected_close
        text        notes
        timestamptz created_at
        timestamptz updated_at
    }

    CALLS {
        uuid        id          PK
        uuid        lead_id     FK
        uuid        agent_id    FK
        timestamptz started_at
        int         duration_s
        text        outcome
        text        notes
        boolean     sms_sent
        timestamptz created_at
    }

    SMS_MESSAGES {
        uuid        id          PK
        uuid        lead_id     FK
        text        direction
        text        body
        text        language
        timestamptz sent_at
        text        status
        timestamptz created_at
    }

    REALTOR_LEADS {
        uuid        id              PK
        text        agent_name
        text        brokerage
        text        agent_phone
        text        agent_email
        text        language
        text        mls_number
        text        property_address
        text        city
        text        state
        numeric     list_price
        int         days_on_market
        text        listing_url
        text        source
        text        status
        timestamptz last_contact_at
        text        notes
        timestamptz created_at
        timestamptz updated_at
    }

    REALTOR_PRICE_DROPS {
        uuid        id              PK
        uuid        realtor_lead_id FK
        date        drop_date
        numeric     amount
    }

    AI_ACTIVITY {
        uuid        id          PK
        text        agent_id
        text        source
        text        message
        timestamptz occurred_at
    }

    %% ── Relationships ──────────────────────────────────────────

    USERS              ||--o{ LEADS                : "assigns"
    USERS              ||--o{ CALLS                : "makes"

    LEADS              ||--o| SHORT_SALE_CASES     : "progresses to"
    LEADS              ||--o{ CALLS                : "receives"
    LEADS              ||--o{ SMS_MESSAGES         : "has"

    REALTOR_LEADS      ||--o{ REALTOR_PRICE_DROPS  : "records"
```

---

## Relationship Summary

| Relationship | Cardinality | Description |
|---|---|---|
| `USERS` → `LEADS` | 1 : many | A rep is assigned many leads |
| `USERS` → `CALLS` | 1 : many | A rep makes many calls |
| `LEADS` → `SHORT_SALE_CASES` | 1 : 0-or-1 | A qualified lead can progress into a pipeline case |
| `LEADS` → `CALLS` | 1 : many | A lead can receive many call attempts |
| `LEADS` → `SMS_MESSAGES` | 1 : many | A lead can receive/send many SMS messages |
| `REALTOR_LEADS` → `REALTOR_PRICE_DROPS` | 1 : many | A realtor listing can have multiple price reductions |
| `AI_ACTIVITY` | standalone | Event log; references `agent_id` as a text key (not FK) |

---

## Entity Descriptions

### USERS
Platform users. Two roles: `ceo` (full access) and `rep` (restricted to their own leads and queues). Authentication is custom — no dependency on Supabase Auth.

### LEADS
Core entity. Represents a homeowner in foreclosure distress. Created by the Scout AI agent from Realie.ai / Batch Leads API, enriched by Sherlock (ATTOM), scored by Pulse, scripted by Echo, and then worked by a rep.

### SHORT_SALE_CASES
A lead that has advanced past initial contact. Tracks the short-sale negotiation with the bank through four stages: Initial Contact → Docs Collected → Bank Submitted → Pending Approval.

### REALTOR_LEADS
A separate lead channel — listing agents found on Zillow who have active short-sale listings. Mr. Short Sale pitches co-processing partnerships to these agents. Different workflow from foreclosure leads.

### REALTOR_PRICE_DROPS
Records each time a listing agent reduces their list price. Two or more price drops is a "hot" signal indicating the agent is motivated.

### CALLS
Every outbound call attempt from a rep to a homeowner. Linked to both the lead and the rep. Captures outcome, duration, and notes.

### SMS_MESSAGES
Inbound and outbound SMS between the platform and homeowners. Outbound messages are sent by the Dispatch AI agent on missed calls. Inbound replies are flagged for the assigned rep.

### AI_ACTIVITY
Event log of everything the 6 AI agents do. Feeds the Morning Briefing activity ticker and the AI Agents Roster "last action" display. `agent_id` is a text identifier (`scout`, `sherlock`, etc.), not a foreign key to a DB table.

---

## Key Business Rules Reflected in the Model

1. **Equity rule:** A `LEAD` is a short-sale candidate only when `equity_pct <= 25`. Leads above this threshold are filtered out by Scout.
2. **Urgency scoring:** `urgency_score` (1–10) is computed by Pulse from `days_to_auction`, `equity_pct`, and `prior_contact`. Higher = call sooner.
3. **One case per lead:** A `LEAD` maps to at most one `SHORT_SALE_CASE`. Multiple cases per homeowner would require a new lead record.
4. **Language routing:** `language_preference` on `LEADS` and `language` on `REALTOR_LEADS` controls whether Echo generates an English or Spanish script, and whether Voice/Dispatch communicates in EN or ES.
5. **Realtor "hot" signal:** `REALTOR_LEADS` is hot when `priceDrops.length >= 2 OR daysOnMarket >= 90`. No schema change needed — derived at query time.
