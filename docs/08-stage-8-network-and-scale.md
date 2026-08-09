# Stage 8 — Network & Scale

## Objective

Develop the network effect created when patients move between clinics.

## Network loop

```text
Patient + Clinic A
      ↓
Passport gains verified records
      ↓
Patient visits Clinic B
      ↓
Clinic B gets permitted history
      ↓
Clinic B adds records
      ↓
Passport becomes more valuable
```

## Potential features

- Patient-controlled sharing
- Easier clinic discovery
- Verified clinics
- Standardized records
- Cross-clinic history
- Interoperability
- Integrations with clinic software

## Important rule

More network connectivity must not mean less privacy.

Every new sharing capability must define:
- who can access
- what they can access
- how long access lasts
- how access is revoked
- what is logged

## Scaling direction

Only add infrastructure complexity when justified by real usage.

Possible later additions:
- More workers
- Queues
- Caching
- Specialized document processing
- CDN
- Service separation

Do not adopt Kubernetes simply because the product is expected to grow.

## Exit criteria

The product creates value from cross-clinic portability that a single-clinic CRM cannot easily reproduce.
