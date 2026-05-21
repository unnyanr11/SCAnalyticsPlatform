# Compliance Charter — SC Analytics Platform

## Mission Statement

SC Analytics Platform is a **strictly analytical, read-only tool** that helps Sim Companies players make better-informed business decisions.

It provides market intelligence, profitability forecasting, production optimization advice, and strategic decision support.

It does **not** and **must never** perform any automated gameplay actions.

---

## Absolute Prohibitions

The following are **permanently and unconditionally prohibited** across every component
of this project — extension, backend, scripts, or tooling:

| Prohibited Action | Reason |
|---|---|
| Auto-clicking any game element | Gameplay automation |
| Auto-buying items from the market | Gameplay automation |
| Auto-selling items to the market | Gameplay automation |
| Auto-starting production | Gameplay automation |
| Automated bidding or trading | Gameplay automation |
| Scripted account interaction | Account manipulation |
| Credential capture or replay | Security violation |
| Session token reuse for actions | Account manipulation |
| Scraping at aggressive rates | Platform abuse |
| Sending unauthenticated requests on behalf of a user | Policy violation |

---

## What the Extension IS Allowed to Do

| Allowed Action | Category |
|---|---|
| Read and analyse intercepted API responses | Analytics |
| Display overlay badges on market items | Decision support |
| Show AI-generated forecasts and scores | Analytics |
| Generate shortage / spike alerts | Alerts |
| Visualise historical price trends | Analytics |
| Recommend production plans | Decision support |
| Display arbitrage opportunities | Decision support |
| Adjust strategy recommendations based on economy phase | Strategy |
| Allow users to configure watchlists and alert thresholds | Settings |

---

## Technical Compliance Rules

### Content Script

- The content script **must only read** `fetch()` and XHR responses already
  initiated by the game
- It **must never** call any SimCompanies API endpoint that the game did not
  already initiate
- It **must never** click, submit, or modify any DOM element
- It **must never** capture, log, or transmit cookies, session tokens, or credentials

### Background Service Worker

- Must not initiate game API calls using the user’s authenticated session
- May call **public, unauthenticated** endpoints (market prices, encyclopedia,
  retail info, economy phases) for supplemental data
- Must respect rate limits (see `shared/constants/endpoints.ts`)
- Must cache aggressively to avoid unnecessary requests

### Backend

- Fetches only from public, unauthenticated API endpoints
- Does not store or transmit user credentials
- All fetched data is used exclusively for analytics

---

## Code Review Checklist

Every pull request must confirm:

- [ ] No new `click()`, `submit()`, `dispatchEvent()` calls on game DOM elements
- [ ] No new authenticated API calls using the user’s session cookie
- [ ] No new credential capture, logging, or storage
- [ ] Rate limits respected for all new external API calls
- [ ] New features are analytical/display only
- [ ] ESLint `no-automation` rule passes

---

## ESLint Enforcement

The `extension/.eslintrc.cjs` includes a custom rule that will **error** on
patterns that resemble automation:

```
simcompanies-no-automation: error
```

This rule flags:
- `.click()` calls on elements
- Programmatic form `.submit()`
- `dispatchEvent` with `MouseEvent` or `PointerEvent` on game elements
- Any reference to auto-buy, auto-sell, auto-produce in comments or identifiers

---

## Responsible Data Practices

- Historical data is retained for **analytics purposes only**
- No personally identifiable information (PII) is collected
- No user credentials, sessions, or authentication tokens are stored
- Polling intervals are designed to be respectful of API infrastructure
- The system backs off automatically when rate limit headers are received

---

## Changelog

| Date | Change |
|---|---|
| 2026-05-21 | Initial compliance charter created |
