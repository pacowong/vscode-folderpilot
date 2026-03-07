# Service Map

- api-gateway
  - depends on: auth-service, report-service
- auth-service
  - depends on: redis-session, postgres-auth
- report-service
  - depends on: postgres-reporting, cache-cluster
- billing-worker
  - depends on: kafka-billing, postgres-billing
