-- Decision data for quotations: what to charge, which customers/channels perform, which jobs are worth
-- accepting, and why sales are lost.
--
-- Requires 20261019_user_management.sql. Run the whole file in the Supabase SQL editor (one transaction).
-- Existing quotations keep working: final price defaults to the calculated price, channel to 'directo'.

begin;

-- 1) New columns
alter table public.quotations
  add column if not exists piece_name        text,
  add column if not exists piece_description text,
  add column if not exists client_contact    text,
  add column if not exists channel           text not null default 'directo',
  add column if not exists final_price       numeric,
  add column if not exists valid_until       date,
  add column if not exists internal_notes    text,
  add column if not exists snapshot          jsonb,
  add column if not exists lost_reason       text,
  add column if not exists decided_at        timestamptz;

-- 2) Backfill before the trigger exists (so it doesn't touch anything)
update public.quotations set final_price = selling_price where final_price is null;
update public.quotations set decided_at = updated_at where status <> 'pendiente' and decided_at is null;

-- 3) Constraints (dropped first so the file can be re-run)
alter table public.quotations drop constraint if exists quotations_channel_check;
alter table public.quotations add constraint quotations_channel_check
  check (channel in ('directo', 'mercadolibre', 'instagram', 'whatsapp', 'otro'));

alter table public.quotations drop constraint if exists quotations_lost_reason_check;
alter table public.quotations add constraint quotations_lost_reason_check
  check (lost_reason is null or (status = 'rechazada'
         and lost_reason in ('caro', 'tardanza', 'arrepentimiento', 'competencia', 'sin_respuesta', 'otro')));

alter table public.quotations drop constraint if exists quotations_final_price_check;
alter table public.quotations add constraint quotations_final_price_check
  check (final_price is null or final_price >= 0);

alter table public.quotations drop constraint if exists quotations_text_length_check;
alter table public.quotations add constraint quotations_text_length_check check (
  char_length(coalesce(piece_name, '')) <= 120
  and char_length(coalesce(piece_description, '')) <= 500
  and char_length(coalesce(client_contact, '')) <= 120
  and char_length(coalesce(internal_notes, '')) <= 1000
);

-- 4) The database keeps the decision data consistent, whatever the client sends:
--    decided_at follows the status, and a lost reason only exists on rejected quotations.
create or replace function public.quotations_apply_decision() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.decided_at := case when new.status = 'pendiente' then null else now() end;
  end if;
  if new.status <> 'rechazada' then
    new.lost_reason := null;
  end if;
  return new;
end;
$$;
revoke all on function public.quotations_apply_decision() from public, anon, authenticated;

drop trigger if exists quotations_apply_decision on public.quotations;
create trigger quotations_apply_decision
  before update on public.quotations
  for each row execute function public.quotations_apply_decision();

-- 5) What users may edit after creating a quotation. Calculated amounts, the cost snapshot, the author and
--    decided_at (set by the trigger) stay immutable.
revoke update on public.quotations from authenticated;
grant update (status, lost_reason, final_price, valid_until, internal_notes, client_contact, channel,
              piece_name, piece_description, updated_at) on public.quotations to authenticated;

commit;
