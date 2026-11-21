---
status: accepted
---

# No global API prefix; only Swagger lives under /api

The spec's endpoint table lists `/auth/login` and `/invoices` with no prefix, yet requires Swagger UI at `/api/docs`. We serve the endpoints exactly as listed and mount only Swagger at `/api/docs`, rather than applying `setGlobalPrefix('api')`. A reviewer following the table literally, or scripting against it, gets the paths the spec states. Do not "tidy" this by adding the prefix.
