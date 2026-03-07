-- Invoices ledger for Nexport
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  exporter_email text not null,
  company_name text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  invoice_date timestamptz default timezone('utc', now()),
  status text not null default 'pending',
  pdf_url text,
  created_at timestamptz default timezone('utc', now())
);

alter table public.invoices enable row level security;

create index if not exists idx_invoices_order_id on public.invoices(order_id);

-- Exporter can view invoices for their bookings
create policy "Exporters can view their invoices" on public.invoices
  for select using (
    exists (
      select 1 from bookings
      where bookings.id = invoices.order_id
        and bookings.exporter_id = auth.uid()
    )
  );
