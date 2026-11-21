---
status: accepted
---

# The JWT is kept in localStorage and sent as a Bearer header

The spec asks for a JWT to be stored on the client "for use in subsequent API requests". We keep it in `localStorage` and send it as `Authorization: Bearer`, rather than in memory only (lost on refresh) or in an httpOnly cookie set by the backend. This matches the spec's wording and lets reviewers use the same token in Swagger's Authorize dialog.

## Consequences

The token is readable by any script on the page, so an XSS flaw would expose it; an httpOnly cookie would not have that exposure but would need CSRF protection. The exposure is bounded by the one-hour default expiry, and a 401 from the API clears the token and redirects to Login. The README states this trade-off.
