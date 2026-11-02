# Schema decisions

UUID identities and creation timestamps share an unmapped mixin. Models share
SQLAlchemy metadata through Base; services will own transactions and authorization.
There is no generic repository or model service abstraction yet.

Cases have one unique lead. The lead owns the current firm and plaintiff, so case
reassignment changes that single assignment. Documents attach to leads and remain
available through case creation. Private notes retain their authoring firm,
independent of current assignment. Foreign keys use restrictive deletion defaults
to preserve history rather than cascading away records.

Roles and statuses use named CHECK constraints for explicit, portable migrations.
Email uniqueness is case-insensitive. Routing keys must be normalized by the future
API/service before writes. Composite indexes support scoped, ordered pagination.

The schema does not enforce authorization, role checks on referenced plaintiffs,
note ownership immutability, accepted-lead/case consistency, or audit append-only
behavior. These require transactional service logic and tests when workflows land.
Audit changes must exclude document bytes, passwords, and private note bodies.
No authentication secrets or password columns are needed for planned hardcoded demo
credentials. Demo seed data, auth, and lead submission/retrieval endpoints are now included.
