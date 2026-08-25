alter table public.s5_users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists s5_users_auth_user_id_idx
  on public.s5_users(auth_user_id) where auth_user_id is not null;

update public.s5_users set auth_user_id = '0ecc23db-d83f-4bd2-8a2f-27000502450f'
  where username = 'admin';
update public.s5_users set auth_user_id = 'fea09a93-cd29-46b0-af20-1a5623eb1fa2'
  where username = 'batuhan.pancarci';
