-- MediPass portal v2. Additive: leaves the previous medipass_* tables intact.
-- Execute once in the SQL Editor of the intended Supabase project.
begin;

create table if not exists public.mp_portal_workspaces (
  id text primary key,
  seeded_at timestamptz
);
create table if not exists public.mp_portal_patients (
  workspace_id text not null references public.mp_portal_workspaces(id),
  id text not null, version integer not null default 1,
  medical_record_number text not null, display_name text not null,
  birth_date date not null, sex text not null, blood_type text not null default '',
  phone text not null default '', email text not null default '', address text not null default '',
  emergency_contact text not null default '', general_note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);
create unique index if not exists mp_patients_mrn on public.mp_portal_patients(workspace_id, lower(medical_record_number));
create table if not exists public.mp_patient_conditions (
  workspace_id text not null, patient_id text not null, id text not null,
  name text not null, clinical_term text not null default '', since text not null default '',
  status text not null check (status in ('active','resolved')), note text not null default '',
  primary key (workspace_id, patient_id, id),
  foreign key (workspace_id, patient_id) references public.mp_portal_patients(workspace_id, id)
);
create table if not exists public.mp_patient_allergies (
  workspace_id text not null, patient_id text not null, id text not null,
  substance text not null, reaction text not null default '', severity text not null, note text not null default '',
  primary key (workspace_id, patient_id, id),
  foreign key (workspace_id, patient_id) references public.mp_portal_patients(workspace_id, id)
);
create table if not exists public.mp_clinicians (
  workspace_id text not null references public.mp_portal_workspaces(id), id text not null,
  name text not null, specialty text not null default '', facility text not null,
  public_phone text not null default '', registration text not null default '',
  primary key (workspace_id, id)
);
create table if not exists public.mp_encounters (
  workspace_id text not null, id text not null, patient_id text not null, version integer not null default 1,
  visit_date date not null, reason text not null, symptoms text not null default '', diagnosis text not null default '',
  plain_diagnosis text not null default '', treatment_plan text not null default '', follow_up text not null default '',
  follow_up_date date, blood_pressure text not null default '', pulse text not null default '',
  temperature text not null default '', weight text not null default '', oxygen_saturation text not null default '',
  clinician_id text not null,
  -- Historical public clinician information stays with the visit even if a directory entry changes.
  clinician_snapshot jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, patient_id) references public.mp_portal_patients(workspace_id, id),
  foreign key (workspace_id, clinician_id) references public.mp_clinicians(workspace_id, id)
);
create index if not exists mp_encounters_patient_date on public.mp_encounters(workspace_id, patient_id, visit_date desc);
create table if not exists public.mp_encounter_labs (
  workspace_id text not null, encounter_id text not null, id text not null,
  name text not null, plain_name text not null default '', value text not null, unit text not null default '',
  reference_low double precision, reference_high double precision, reference_text text not null default '',
  explanation text not null default '', clinician_note text not null default '', source_url text not null default '',
  primary key (workspace_id, encounter_id, id),
  foreign key (workspace_id, encounter_id) references public.mp_encounters(workspace_id, id),
  check (reference_low is null or reference_high is null or reference_low <= reference_high)
);
create table if not exists public.mp_encounter_medications (
  workspace_id text not null, encounter_id text not null, id text not null,
  name text not null, dose text not null default '', route text not null default '',
  frequency text not null default '', duration text not null default '',
  status text not null check (status in ('active','completed','stopped')), instructions text not null default '',
  primary key (workspace_id, encounter_id, id),
  foreign key (workspace_id, encounter_id) references public.mp_encounters(workspace_id, id)
);
create table if not exists public.mp_encounter_procedures (
  workspace_id text not null, encounter_id text not null, id text not null,
  name text not null, result text not null default '', explanation text not null default '',
  primary key (workspace_id, encounter_id, id),
  foreign key (workspace_id, encounter_id) references public.mp_encounters(workspace_id, id)
);
create table if not exists public.mp_feedback (
  workspace_id text not null references public.mp_portal_workspaces(id), id text not null, version integer not null default 1,
  title text not null, description text not null, category text not null, priority text not null,
  status text not null check (status in ('open','planned','in_progress','done')),
  page_path text not null default '', section text not null default '', patient_id text not null default '',
  encounter_id text not null default '', resolution text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);
create table if not exists public.mp_portal_audit (
  id bigint generated always as identity primary key,
  workspace_id text not null references public.mp_portal_workspaces(id),
  resource_type text not null, resource_id text not null, action text not null, version integer not null,
  created_at timestamptz not null default now()
);
create index if not exists mp_portal_audit_workspace_date on public.mp_portal_audit(workspace_id, created_at desc);

comment on table public.mp_portal_patients is '01 · Hồ sơ chung: tên, ngày sinh, liên hệ, mã bệnh nhân.';
comment on table public.mp_patient_conditions is '02 · Bệnh nền chung; mỗi bệnh chỉ ghi một lần trong hồ sơ bệnh nhân.';
comment on table public.mp_patient_allergies is '03 · Dị ứng chung và phản ứng đã ghi nhận.';
comment on table public.mp_clinicians is '04 · Thông tin công khai của bác sĩ/cơ sở khám.';
comment on table public.mp_encounters is '05 · Một dòng = một lần khám; liên kết bệnh nhân và bác sĩ.';
comment on table public.mp_encounter_labs is '06 · Kết quả xét nghiệm: giá trị gốc, đơn vị, khoảng tham chiếu và chú giải.';
comment on table public.mp_encounter_medications is '07 · Thuốc tại từng lần khám, bao gồm trạng thái hiện dùng/đã ngừng.';
comment on table public.mp_encounter_procedures is '08 · Thủ thuật, dịch vụ, kết quả và giải thích.';
comment on table public.mp_feedback is '09 · Yêu cầu chỉnh sửa website, vị trí góp ý và trạng thái xử lý.';
comment on table public.mp_portal_audit is '10 · Nhật ký lưu dữ liệu; không sao chép nội dung y tế vào log.';

-- The Worker owns authentication and scopes every operation by an authenticated
-- Sites user. No patient data or write RPC is accessible with an anon key.
do $$
declare t text;
begin
  foreach t in array array['mp_portal_workspaces','mp_portal_patients','mp_patient_conditions','mp_patient_allergies','mp_clinicians','mp_encounters','mp_encounter_labs','mp_encounter_medications','mp_encounter_procedures','mp_feedback','mp_portal_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.mp_portal_audit_id_seq to service_role;

create or replace function public.mp_portal_read(p_workspace text)
returns jsonb language sql stable set search_path = public as $$
select jsonb_build_object(
  'patients', coalesce((select jsonb_agg((to_jsonb(p) - 'workspace_id') || jsonb_build_object(
    'conditions', coalesce((select jsonb_agg(to_jsonb(c) - 'workspace_id' - 'patient_id' order by c.id) from mp_patient_conditions c where c.workspace_id=p.workspace_id and c.patient_id=p.id),'[]'::jsonb),
    'allergies', coalesce((select jsonb_agg(to_jsonb(a) - 'workspace_id' - 'patient_id' order by a.id) from mp_patient_allergies a where a.workspace_id=p.workspace_id and a.patient_id=p.id),'[]'::jsonb)
  ) order by p.medical_record_number) from mp_portal_patients p where p.workspace_id=p_workspace),'[]'::jsonb),
  'clinicians', coalesce((select jsonb_agg(to_jsonb(c) - 'workspace_id' order by c.name) from mp_clinicians c where c.workspace_id=p_workspace),'[]'::jsonb),
  'encounters', coalesce((select jsonb_agg((to_jsonb(e) - 'workspace_id' - 'clinician_id' - 'clinician_snapshot') || jsonb_build_object(
    'follow_up_date', coalesce(e.follow_up_date::text,''),
    'clinician', e.clinician_snapshot,
    'labs', coalesce((select jsonb_agg(to_jsonb(l) - 'workspace_id' - 'encounter_id' order by l.id) from mp_encounter_labs l where l.workspace_id=e.workspace_id and l.encounter_id=e.id),'[]'::jsonb),
    'medications', coalesce((select jsonb_agg(to_jsonb(m) - 'workspace_id' - 'encounter_id' order by m.id) from mp_encounter_medications m where m.workspace_id=e.workspace_id and m.encounter_id=e.id),'[]'::jsonb),
    'procedures', coalesce((select jsonb_agg(to_jsonb(r) - 'workspace_id' - 'encounter_id' order by r.id) from mp_encounter_procedures r where r.workspace_id=e.workspace_id and r.encounter_id=e.id),'[]'::jsonb)
  ) order by e.visit_date desc, e.created_at desc) from mp_encounters e where e.workspace_id=p_workspace),'[]'::jsonb),
  'feedback', coalesce((select jsonb_agg(to_jsonb(f) - 'workspace_id' order by f.created_at desc) from mp_feedback f where f.workspace_id=p_workspace),'[]'::jsonb)
);
$$;

create or replace function public.mp_portal_save(p_workspace text, p_kind text, p_document jsonb, p_expected_version integer)
returns jsonb language plpgsql set search_path = public as $$
declare
  doc jsonb; old_version integer; old_created timestamptz; target_table text; old_patient text;
  stamp timestamptz := clock_timestamp(); item jsonb;
begin
  perform 1 from mp_portal_workspaces where id=p_workspace for update;
  if not found then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  target_table := case p_kind when 'patient' then 'mp_portal_patients' when 'encounter' then 'mp_encounters' when 'feedback' then 'mp_feedback' else null end;
  if target_table is null then raise exception 'INVALID_KIND'; end if;
  execute format('select version, created_at from public.%I where workspace_id=$1 and id=$2', target_table)
    into old_version, old_created using p_workspace, p_document->>'id';
  if coalesce(old_version,0) <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  doc := p_document || jsonb_build_object('workspace_id',p_workspace,'version',p_expected_version+1,'created_at',coalesce(old_created,stamp),'updated_at',stamp);

  if p_kind='patient' then
    insert into mp_portal_patients select (jsonb_populate_record(null::mp_portal_patients, doc)).*
    on conflict (workspace_id,id) do update set
      version=excluded.version, medical_record_number=excluded.medical_record_number, display_name=excluded.display_name,
      birth_date=excluded.birth_date, sex=excluded.sex, blood_type=excluded.blood_type, phone=excluded.phone,
      email=excluded.email,address=excluded.address,emergency_contact=excluded.emergency_contact,general_note=excluded.general_note,updated_at=excluded.updated_at;
    delete from mp_patient_conditions where workspace_id=p_workspace and patient_id=doc->>'id';
    for item in select value from jsonb_array_elements(doc->'conditions') loop
      insert into mp_patient_conditions select (jsonb_populate_record(null::mp_patient_conditions,item || jsonb_build_object('workspace_id',p_workspace,'patient_id',doc->>'id'))).*;
    end loop;
    delete from mp_patient_allergies where workspace_id=p_workspace and patient_id=doc->>'id';
    for item in select value from jsonb_array_elements(doc->'allergies') loop
      insert into mp_patient_allergies select (jsonb_populate_record(null::mp_patient_allergies,item || jsonb_build_object('workspace_id',p_workspace,'patient_id',doc->>'id'))).*;
    end loop;
  elsif p_kind='encounter' then
    select patient_id into old_patient from mp_encounters where workspace_id=p_workspace and id=doc->>'id';
    if old_patient is not null and old_patient <> doc->>'patient_id' then raise exception 'PATIENT_CHANGE_NOT_ALLOWED'; end if;
    insert into mp_clinicians select (jsonb_populate_record(null::mp_clinicians,(doc->'clinician') || jsonb_build_object('workspace_id',p_workspace))).*
      on conflict (workspace_id,id) do update set name=excluded.name,specialty=excluded.specialty,facility=excluded.facility,public_phone=excluded.public_phone,registration=excluded.registration;
    insert into mp_encounters select (jsonb_populate_record(null::mp_encounters,doc || jsonb_build_object('clinician_id',doc->'clinician'->>'id','clinician_snapshot',doc->'clinician','follow_up_date',nullif(doc->>'follow_up_date','')))).*
      on conflict (workspace_id,id) do update set version=excluded.version,visit_date=excluded.visit_date,reason=excluded.reason,symptoms=excluded.symptoms,
      diagnosis=excluded.diagnosis,plain_diagnosis=excluded.plain_diagnosis,treatment_plan=excluded.treatment_plan,follow_up=excluded.follow_up,
      follow_up_date=excluded.follow_up_date,blood_pressure=excluded.blood_pressure,pulse=excluded.pulse,temperature=excluded.temperature,
      weight=excluded.weight,oxygen_saturation=excluded.oxygen_saturation,clinician_id=excluded.clinician_id,clinician_snapshot=excluded.clinician_snapshot,updated_at=excluded.updated_at;
    delete from mp_encounter_labs where workspace_id=p_workspace and encounter_id=doc->>'id';
    for item in select value from jsonb_array_elements(doc->'labs') loop
      insert into mp_encounter_labs select (jsonb_populate_record(null::mp_encounter_labs,item || jsonb_build_object('workspace_id',p_workspace,'encounter_id',doc->>'id'))).*;
    end loop;
    delete from mp_encounter_medications where workspace_id=p_workspace and encounter_id=doc->>'id';
    for item in select value from jsonb_array_elements(doc->'medications') loop
      insert into mp_encounter_medications select (jsonb_populate_record(null::mp_encounter_medications,item || jsonb_build_object('workspace_id',p_workspace,'encounter_id',doc->>'id'))).*;
    end loop;
    delete from mp_encounter_procedures where workspace_id=p_workspace and encounter_id=doc->>'id';
    for item in select value from jsonb_array_elements(doc->'procedures') loop
      insert into mp_encounter_procedures select (jsonb_populate_record(null::mp_encounter_procedures,item || jsonb_build_object('workspace_id',p_workspace,'encounter_id',doc->>'id'))).*;
    end loop;
  else
    insert into mp_feedback select (jsonb_populate_record(null::mp_feedback,doc)).*
      on conflict (workspace_id,id) do update set version=excluded.version,title=excluded.title,description=excluded.description,
      category=excluded.category,priority=excluded.priority,status=excluded.status,page_path=excluded.page_path,section=excluded.section,
      patient_id=excluded.patient_id,encounter_id=excluded.encounter_id,resolution=excluded.resolution,updated_at=excluded.updated_at;
  end if;
  insert into mp_portal_audit(workspace_id,resource_type,resource_id,action,version)
    values(p_workspace,p_kind,doc->>'id',case when old_version is null then 'create' else 'update' end,p_expected_version+1);
  return doc - 'workspace_id';
end;
$$;

create or replace function public.mp_portal_bootstrap(p_workspace text, p_seed jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare seeded timestamptz; doc jsonb;
begin
  insert into mp_portal_workspaces(id) values(p_workspace) on conflict do nothing;
  select seeded_at into seeded from mp_portal_workspaces where id=p_workspace for update;
  if seeded is null then
    for doc in select value from jsonb_array_elements(p_seed->'patients') loop
      perform mp_portal_save(p_workspace,'patient',doc,0);
    end loop;
    for doc in select value from jsonb_array_elements(p_seed->'encounters') loop
      perform mp_portal_save(p_workspace,'encounter',doc,0);
    end loop;
    update mp_portal_workspaces set seeded_at=clock_timestamp() where id=p_workspace;
  end if;
  return mp_portal_read(p_workspace);
end;
$$;

revoke all on function public.mp_portal_read(text) from public, anon, authenticated;
revoke all on function public.mp_portal_save(text,text,jsonb,integer) from public, anon, authenticated;
revoke all on function public.mp_portal_bootstrap(text,jsonb) from public, anon, authenticated;
grant execute on function public.mp_portal_read(text) to service_role;
grant execute on function public.mp_portal_save(text,text,jsonb,integer) to service_role;
grant execute on function public.mp_portal_bootstrap(text,jsonb) to service_role;
commit;
notify pgrst, 'reload schema';
