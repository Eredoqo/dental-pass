# Stage 6 — Iterate & Harden

## Objective

Use pilot evidence to improve the core product and remove weak functionality.

## Priority order

1. Security
2. Authorization
3. Tenant isolation
4. Reliability
5. Document workflow
6. AI accuracy
7. Clinic efficiency
8. Patient UX
9. Performance
10. Feature expansion

## Security review

Check:
- Authentication
- Authorization
- Clinic isolation
- Patient access
- File access
- Audit integrity
- Data retention
- Secrets
- Logging
- AI processing/data handling

## Product pruning

For each feature:

```text
Used?
  ↓
Does it solve a real problem?
  ↓
Does it improve retention/value?
  ↓
Worth maintaining?
```

If not, remove or defer it.

## Reliability

Monitor:
- API errors
- background job failures
- document processing failures
- AI timeouts
- storage failures
- slow requests

## Exit criteria

The product is reliable enough for broader pilots and the roadmap is driven by evidence.
