# AMP Architecture: Validator vs Registry

AMP is designed as a **protocol**, not a platform. The validator and registry have a clean separation of concerns.

## Mental Model

| Layer | Role | State |
|-------|------|-------|
| **Validator** | Compute | Stateless |
| **Registry** | Persistence | Stateful |

## Validator (Compute Layer)

- **Pure function** over: `manifest`, `baseUrl`, feature flags
- **Returns**: `{ schema_valid, endpoints_reachable, auth_verified, payment_flow_verified, operationally_complete, badges, ... }`
- **Stores nothing**. Keeps no memory.
- **Exposes**:
  - `POST /validate` — validate manifest by URL or object
  - `GET /spec` — JSON Schema
  - `GET /health` — operational health (no persistence)
  - `GET /agents`, `GET /llms.txt` — discovery (read-only, no persistence)

**Validator does NOT:**
- Call the registry
- Know the registry URL (beyond informational links for users)
- Update the registry directly
- Persist any data

**Benefits:**
- Horizontally scalable
- Sandboxable
- Versionable independently
- Swappable implementations
- No validator DB migrations
- Minimal attack surface

## Registry (State Layer)

- **Stores**: manifest, `validation_result` (full JSON blob), verification_token, listing metadata
- **Calls validator** when:
  - New listing submitted
  - Revalidation requested
- **Persists** the raw validation result
- **Computes** display values (e.g. `badges = validation_result.badges`) at read time

**Registry owns:**
- Persistence
- Listing lifecycle
- Display logic

## Call Flow

```
User/Agent                    Registry                     Validator
    |                            |                              |
    |  POST /listings/submit     |                              |
    |--------------------------->|                              |
    |  202 Accepted              |  POST /validate { url }      |
    |<---------------------------|----------------------------->|
    |                            |  { schema_valid, badges, ... }|
    |                            |<------------------------------|
    |                            |  Store validation_result      |
    |                            |  Create listing              |
    |  GET /listings/submit/:id  |                              |
    |--------------------------->|                              |
    |  { status: completed }     |                              |
    |<---------------------------|                              |
```

**Direction**: Registry → Validator. Never Validator → Registry.

## Future-Proofing

By storing `validation_result` as a JSON blob instead of individual columns:
- Validator can evolve (add fields) without registry schema migrations
- Registry computes `badges`, `auth_verified`, etc. from the stored result at read time
- No coupling between validator output shape and registry schema
