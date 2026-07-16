-- Prevent duplicate form notification emails.
-- Safe to run more than once.

alter table if exists public.contact_messages
  add column if not exists notified_at timestamptz;

comment on column public.contact_messages.notified_at is
  'Set by notify-form-submission after a notification email is claimed for delivery.';
