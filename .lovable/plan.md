## Why this matters

You're right — today the "Call Now" buttons read as if the app dials the homeowner directly. It doesn't. The real Phase 1 behavior is:

1. Lead is created/enriched in our app
2. Lead is **pushed via Mojo Triple Dialer API** into the rep's outbound queue (or to the top of it)
3. The rep's existing Mojo softphone is what actually places the call

So the honest verb is "push to dialer" / "send to top of Mojo queue", not "Call Now".

## Screens that overstate what happens (analysis)

| File | Element | Current copy | Problem |
|---|---|---|---|
| `SpeedToLeadFeed.tsx` (Meta Speed-to-Lead card, used on CEO + Rep dashboards) | Orange button | "Call Now" | Implies app dials. Actually pauses Mojo & inserts lead at top. |
| `LeadDetailDrawer.tsx` (foreclosure lead drawer) | Sticky bottom button | "Call Now" | Same. No dialer is initiated by the app. |
| `SpeedToLeadScreen.tsx` (CEO → Speed-to-Lead) | "How it works" step 4 | "One-click Call Now pauses Mojo queue and routes lead to top" | Wording is closer to truth but still uses "Call Now". |
| `MojoDialerScreen.tsx` | Bulk action buttons | "Send all New leads", "Send urgency ≥8", "Send Spanish-only batch" | These are accurate — keep as is. |
| `RealtorQueue.tsx` / `RealtorLeadQueue.tsx` | "Call agent" quick-action | OK in concept (rep's phone) but should say "Push to Mojo" if it's queue-routing, or open `tel:` link if it's a true device dial. Need to pick one. |

Also worth a small clarifying tooltip on the Mojo Dialer screen: state plainly that **the app sends leads to Mojo via API; Mojo (and the rep's headset) places the calls**. This protects scope conversations later.

## Proposed copy + behavior changes (Phase 1, in-scope)

1. **`SpeedToLeadFeed.tsx`** — relabel button to **"Push to Top of Dialer"** (icon: `ArrowUpToLine` or keep `Phone`). Toast: *"Lead inserted at top of Mojo queue · your next dial will be {name}"*. Add a tiny helper line under the card header: *"App pushes leads to Mojo via API — Mojo dials from your headset."*
2. **`LeadDetailDrawer.tsx`** — split into two buttons:
   - **"Push to Mojo"** (primary) → calls mock `sendToMojo([lead.id])`, toast confirms queue insert.
   - **"Open in Phone"** (secondary, optional) → `tel:{lead.phone}` link, only if user wants the literal device-dial path. Recommend **not** including this in Phase 1 to avoid confusion; add in Phase 2 alongside true click-to-call.
3. **`SpeedToLeadScreen.tsx` "How it works"** — rewrite step 4 to: *"One-click **Push to Top** moves the lead to position 1 in your Mojo queue — Mojo dials it on your next pickup."* Add step 0: *"Mr. Short Sale app does not place calls. All dialing happens inside Mojo Triple Dialer."*
4. **`MojoDialerScreen.tsx`** — add a one-line banner at top: *"This screen controls the Mojo API push. Calls are placed by Mojo, not by this app."*
5. **Realtor queues** — change "Call agent" to **"Push agent to Mojo"** for consistency. Keep "Email agent" as-is (it does open mail client).
6. **`mojoDialer.ts`** — rename `sendToMojo` toast wording in callers to "queued in Mojo" rather than "routing to dialer".

## What is genuinely out of scope (and should stay out for Phase 1)

These are things that *would* be needed for the app to actually place a call itself — flag them so they're not assumed:

- **True click-to-call** (browser → softphone bridge): would require Twilio Voice or Mojo's WebRTC click-to-call endpoint (not part of standard Mojo API). **Phase 2.**
- **Inbound call handling** (AI answers): ElevenLabs + Twilio + Vapi. **Phase 2/3.**
- **Outbound AI voice dialing** (AI dials low-priority leads): Vapi + Twilio. **Phase 3.**
- **Call recording / transcription** surfaced in our app: requires Mojo recording API access + storage. **Out of Phase 1** unless George confirms Mojo plan exposes it.
- **Live agent status / who's on a call right now**: Mojo doesn't expose presence in their standard API — would need polling and is brittle. **Out of scope.**
- **DNC scrubbing inside our app**: Mojo handles DNC. We display the flag, we don't scrub.

## Files to edit

- `src/components/shared/SpeedToLeadFeed.tsx` — button label, toast, helper text
- `src/components/shared/LeadDetailDrawer.tsx` — split actions, relabel
- `src/components/ceo/SpeedToLeadScreen.tsx` — rewrite "How it works"
- `src/components/ceo/MojoDialerScreen.tsx` — clarifying banner
- `src/components/rep/RealtorQueue.tsx` — relabel "Call agent" → "Push to Mojo"
- `src/components/ceo/RealtorLeadQueue.tsx` — same relabel
- `src/integrations/mojoDialer.ts` — no logic change; just used by callers

No new dependencies. No backend. No SOW change required — this is honesty in the UI, not new scope.

## Confirm before I build

1. Keep a literal **`tel:` "Open in Phone"** secondary button anywhere in Phase 1, or remove all device-dial implications entirely until Phase 2? (My recommendation: remove entirely.)
2. For the Realtor queue, do reps want **"Push to Mojo"** (queue insert) or **"Email agent"** as the primary? Realtors are usually email-first.
