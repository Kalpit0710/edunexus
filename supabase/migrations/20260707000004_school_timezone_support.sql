alter table public.schools
add column if not exists timezone text not null default 'Asia/Kolkata';
