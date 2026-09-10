create table if not exists public.medipass_patients (
  id uuid primary key,
  display_name text not null,
  birth_date date,
  blood_type text,
  preferred_language text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medipass_health_records (
  id uuid primary key,
  patient_id uuid not null references public.medipass_patients(id) on delete cascade,
  record_type text not null check (record_type in ('allergy', 'condition', 'medication', 'lab', 'encounter')),
  fhir_resource_type text not null,
  title text not null,
  summary text,
  status text not null,
  clinical_date date not null,
  provider text,
  facility text,
  country_code text,
  code_system text,
  code text,
  source text not null,
  verification_status text not null,
  severity text,
  details jsonb not null default '{}'::jsonb,
  attachment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.medipass_audit_events (
  id uuid primary key,
  actor_user_id uuid,
  patient_id uuid references public.medipass_patients(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  outcome text not null,
  created_at timestamptz not null default now()
);

create index if not exists medipass_records_patient_date_idx
  on public.medipass_health_records(patient_id, clinical_date desc)
  where deleted_at is null;
create index if not exists medipass_records_patient_type_idx
  on public.medipass_health_records(patient_id, record_type)
  where deleted_at is null;
create index if not exists medipass_audit_patient_date_idx
  on public.medipass_audit_events(patient_id, created_at desc);

alter table public.medipass_patients enable row level security;
alter table public.medipass_health_records enable row level security;
alter table public.medipass_audit_events enable row level security;

revoke all on table public.medipass_patients from anon, authenticated;
revoke all on table public.medipass_health_records from anon, authenticated;
revoke all on table public.medipass_audit_events from anon, authenticated;

grant select, insert, update, delete on table public.medipass_patients to service_role;
grant select, insert, update, delete on table public.medipass_health_records to service_role;
grant select, insert, update, delete on table public.medipass_audit_events to service_role;
