# NTITT Platform

The Never Throw In The Towel community platform — a daily wellbeing tool
sold to companies as an employee wellbeing programme.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture,
stack, and the reasoning behind every major decision.

## Development

```bash
cp .env.example .env.local   # fill in real values
npm install
npm run dev
```

Database schema lives in `supabase/migrations/`. The privacy boundary
(personal check-in data vs. aggregate company reporting) is enforced by
Postgres Row Level Security — see the migration file's header comment
before touching anything in the `private` schema.
