-- 016_pass_wallet_provider.sql: the holder's Apple Wallet copy, when a hosted
-- provider signs it (docs/specs/dgtl-pass/07-apple-wallet.md, "Hosted signing").
--
-- WalletWallet (and similar services) sign passes with their own Pass Type ID,
-- so no Apple Developer account is needed. The provider keeps the pass under its
-- own serial; we keep that serial to update or revoke it, and the signed bytes so
-- a second "Add to Apple Wallet" tap does not create (and bill) a second pass.
-- With DGTL's own certificate (Phase 5) these columns stay null: that .pkpass is
-- generated on demand from the pass row.
--
-- Idempotent like 001-015.

alter table passes add column if not exists wallet_provider text;
alter table passes add column if not exists wallet_ref text;             -- provider serial number
alter table passes add column if not exists wallet_share_url text;       -- provider-hosted install page
alter table passes add column if not exists wallet_google_url text;      -- "Save to Google Wallet" link, same pass
alter table passes add column if not exists wallet_pkpass bytea;         -- the signed .pkpass as issued
alter table passes add column if not exists wallet_issued_at timestamptz;
alter table passes add column if not exists wallet_synced_at timestamptz; -- last successful update/revoke push
alter table passes add column if not exists wallet_error text;           -- last provider error, for the admin drawer

alter table passes drop constraint if exists passes_wallet_provider_check;
alter table passes add constraint passes_wallet_provider_check
  check (wallet_provider is null or wallet_provider in ('walletwallet', 'apple'));
