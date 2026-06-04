alter table public.client_roles
  add constraint client_roles_client_id_name_key unique (client_id, name);
