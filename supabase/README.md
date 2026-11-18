# Supabase Schema, Storage, RLS & Analytics

This directory contains the version-controlled PostgreSQL migrations, RLS policies, private Storage configuration, and analytics views for the **AI Medical Waste Segregation Platform**.

## Deliverables Index

- `/supabase/migrations/202611170001_core_tables.sql` — Canonical 7 tables, foreign keys, check constraints, and indexes
- `/supabase/migrations/202611170002_rls_and_storage.sql` — Strict RBAC RLS policies and private `waste-evidence` Storage bucket
- `/supabase/migrations/202611170003_analytics_views.sql` — Security-invoker analytics views & `virtual_bin_assignment_counts`
- `/supabase/migrations/202611170004_audit_triggers_and_retention.sql` — Auth profile provisioning, audit immutability, governance triggers, and retention policy
- `/supabase/database_schema.sql` — Consolidated schema reference
- `/supabase/rls_policies.sql` — Consolidated RLS & storage reference
- `/supabase/storage_setup.md` — Private bucket, signed URL, and retention documentation
- `/supabase/database_design.md` — Relational model, virtual bin rules, migration & rollback guide
- `/src/contracts/database_types.ts` — Generated TypeScript `Database` schema types
