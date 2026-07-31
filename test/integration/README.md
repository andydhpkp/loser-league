# Integration tests

Integration tests require `TEST_DATABASE_URL` and will refuse to run unless the
database name contains `test`. Route characterization is added one vertical
slice at a time as modules move behind their interfaces.

`npm run test:integration` loads a local `.env` file when present. CI may set
`TEST_DATABASE_URL` directly; an existing environment value takes precedence.
