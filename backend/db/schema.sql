-- Extractions table
create table if not exists extractions (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_url text,
  raw_extracted jsonb not null,
  final_submitted jsonb,
  corrections jsonb default '{}',
  status text default 'pending' check (status in ('pending', 'reviewed', 'submitted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Accuracy stats view
create or replace view accuracy_stats as
select
  field_key,
  count(*) as total,
  count(*) filter (where correction_value is not null) as corrected,
  round(100.0 * count(*) filter (where correction_value is null) / count(*), 1) as accuracy_pct
from extractions,
  jsonb_each(corrections) as c(field_key, correction_value)
group by field_key
order by accuracy_pct asc;
