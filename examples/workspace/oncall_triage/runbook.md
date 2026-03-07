# Incident Runbook (Condensed)

1. Confirm blast radius by checking API gateway routes and top affected tenants.
2. Stabilize user-facing traffic first:
   - route high-cost report endpoints through cached fallback if available
   - enable temporary rate limiting for abusive clients
3. Recover dependencies:
   - auth-service: flush stale redis sessions if latency exceeds 700ms for 10+ min
   - report-service: increase db pool ceiling by 20% and kill long-running queries > 8s
4. Verify impact reduction:
   - 5xx < 1.5% for 10 min
   - p95 latency < 900ms for api-gateway and auth-service
5. Prepare handoff with timeline, what was tried, and remaining risks.
