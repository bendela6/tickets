-- Runs once, when the postgres volume is first created. POSTGRES_DB already makes
-- `tickets`; these are the databases `.env` (dev) and the test suites point at.
CREATE DATABASE tickets_dev;
CREATE DATABASE tickets_test;
