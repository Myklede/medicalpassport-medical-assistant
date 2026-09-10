-- Persist the selected interface element and relative pin location.
begin;
alter table public.mp_feedback add column if not exists annotation jsonb;
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
      patient_id=excluded.patient_id,encounter_id=excluded.encounter_id,annotation=excluded.annotation,resolution=excluded.resolution,updated_at=excluded.updated_at;
  end if;
  insert into mp_portal_audit(workspace_id,resource_type,resource_id,action,version)
    values(p_workspace,p_kind,doc->>'id',case when old_version is null then 'create' else 'update' end,p_expected_version+1);
  return doc - 'workspace_id';
end;
$$;


commit;
notify pgrst, 'reload schema';
