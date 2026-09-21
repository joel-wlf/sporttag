alter table private.access_code_attempts add column id uuid primary key default gen_random_uuid();
