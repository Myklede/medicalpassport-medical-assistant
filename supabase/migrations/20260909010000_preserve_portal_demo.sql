-- Import the existing private demo only when a Supabase workspace is first
-- created. The transaction preserves edits and feedback as one complete unit.
begin;
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
    for doc in select value from jsonb_array_elements(coalesce(p_seed->'clinicians','[]'::jsonb)) loop
      insert into mp_clinicians select (jsonb_populate_record(null::mp_clinicians,doc || jsonb_build_object('workspace_id',p_workspace))).*
        on conflict (workspace_id,id) do nothing;
    end loop;
    for doc in select value from jsonb_array_elements(p_seed->'encounters') loop
      perform mp_portal_save(p_workspace,'encounter',doc,0);
    end loop;
    for doc in select value from jsonb_array_elements(coalesce(p_seed->'feedback','[]'::jsonb)) loop
      perform mp_portal_save(p_workspace,'feedback',doc,0);
    end loop;
    update mp_portal_workspaces set seeded_at=clock_timestamp() where id=p_workspace;
  end if;
  return mp_portal_read(p_workspace);
end;
$$;
revoke all on function public.mp_portal_bootstrap(text,jsonb) from public, anon, authenticated;
grant execute on function public.mp_portal_bootstrap(text,jsonb) to service_role;
commit;
notify pgrst, 'reload schema';
