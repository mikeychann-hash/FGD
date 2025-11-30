# API Versioning Strategy

The API is now exposed under versioned namespaces while keeping legacy routes for compatibility.

- `/api/v1/*` – Stable endpoints. Routes mirror the original unversioned API.
- `/api/v2/*` – Reserved for future schema changes. Currently points to the same handlers as v1.
- `/api/*` – Legacy alias that maps to `/api/v1` to avoid breaking existing clients.

## Migrating Clients

1. Update API consumers to target `/api/v1/...`.
2. When a v2 contract is introduced, existing code can opt-in by switching to `/api/v2/...`.
3. Health metrics are also available under `/api/cluster/metrics` with extended performance data.

## Authentication

Authentication remains API-key based via the `X-API-Key` header. The admin panel now requires the user to enter a key; no default credentials are shipped with the UI.
