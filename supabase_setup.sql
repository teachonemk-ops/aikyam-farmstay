-- ===============================================================================
-- Aikyam Farmstay Supabase Database Schema Setup SQL
-- Paste this script into the Supabase SQL Editor and click "Run" to set up your DB.
-- ===============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null unique,
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- 2. WHITELIST TABLE
create table public.whitelist (
  email text primary key,
  name text,
  is_admin boolean default false,
  registered boolean default false,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for whitelist
alter table public.whitelist enable row level security;

-- 3. BOOKINGS TABLE
create table public.bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  user_name text not null,
  check_in date not null,
  check_out date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_dates check (check_out > check_in)
);

-- Enable RLS for bookings
alter table public.bookings enable row level security;

-- 4. REQUESTS TABLE
create table public.requests (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  booking_owner_id uuid references public.profiles(id) on delete cascade not null,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  requester_name text not null,
  reason text not null,
  check_in date not null,
  check_out date not null,
  status text default 'pending'::text not null check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for requests
alter table public.requests enable row level security;

-- 5. SUGGESTIONS TABLE
create table public.suggestions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  user_name text not null,
  title text not null,
  description text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for suggestions
alter table public.suggestions enable row level security;

-- 6. SUGGESTION VOTES TABLE
create table public.suggestion_votes (
  suggestion_id uuid references public.suggestions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  vote integer not null check (vote in (-1, 1)),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (suggestion_id, user_id)
);

-- Enable RLS for votes
alter table public.suggestion_votes enable row level security;

-- 7. SETTINGS TABLE
create table public.settings (
  key text primary key,
  value text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for settings
alter table public.settings enable row level security;

-- 8. NOTIFICATIONS TABLE
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for notifications
alter table public.notifications enable row level security;


-- ===============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================================================

-- --- Profiles Policies ---
create policy "Allow public read access to profiles" 
  on public.profiles for select 
  using (auth.role() = 'authenticated');

create policy "Allow users to update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- --- Whitelist Policies ---
create policy "Allow authenticated users to read the whitelist" 
  on public.whitelist for select 
  using (auth.role() = 'authenticated');

create policy "Allow admins to insert/update/delete whitelist" 
  on public.whitelist for all 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- --- Bookings Policies ---
create policy "Allow authenticated read of bookings" 
  on public.bookings for select 
  using (auth.role() = 'authenticated');

create policy "Allow authenticated insert of bookings" 
  on public.bookings for insert 
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "Allow users to update their own bookings" 
  on public.bookings for update 
  using (
    auth.uid() = user_id or 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Allow users to delete their own bookings" 
  on public.bookings for delete 
  using (
    auth.uid() = user_id or 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- --- Requests Policies ---
create policy "Allow authenticated read of requests" 
  on public.requests for select 
  using (auth.role() = 'authenticated');

create policy "Allow authenticated insert of requests" 
  on public.requests for insert 
  with check (auth.role() = 'authenticated' and auth.uid() = requester_id);

create policy "Allow involved users to update requests" 
  on public.requests for update 
  using (
    auth.uid() = requester_id or 
    auth.uid() = booking_owner_id or 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- --- Suggestions Policies ---
create policy "Allow authenticated read of suggestions" 
  on public.suggestions for select 
  using (auth.role() = 'authenticated');

create policy "Allow authenticated insert of suggestions" 
  on public.suggestions for insert 
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "Allow creator or admin to update suggestions" 
  on public.suggestions for update 
  using (
    auth.uid() = user_id or 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Allow creator or admin to delete suggestions" 
  on public.suggestions for delete 
  using (
    auth.uid() = user_id or 
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- --- Votes Policies ---
create policy "Allow authenticated read of votes" 
  on public.suggestion_votes for select 
  using (auth.role() = 'authenticated');

create policy "Allow users to vote" 
  on public.suggestion_votes for all 
  using (auth.role() = 'authenticated' and auth.uid() = user_id);

-- --- Settings Policies ---
create policy "Allow authenticated read of settings" 
  on public.settings for select 
  using (auth.role() = 'authenticated');

create policy "Allow admins full control of settings" 
  on public.settings for all 
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and is_admin = true
    )
  );

-- --- Notifications Policies ---
create policy "Allow users to read their own notifications" 
  on public.notifications for select 
  using (auth.uid() = user_id);

create policy "Allow users to update/read their own notifications" 
  on public.notifications for update 
  using (auth.uid() = user_id);

create policy "Allow system to insert notifications" 
  on public.notifications for insert 
  with check (auth.role() = 'authenticated');


-- ===============================================================================
-- DATABASE TRIGGERS & FUNCTIONS
-- ===============================================================================

-- A. Auto-create Profile and Sync Admin role upon Auth Signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  is_admin_flag boolean := false;
  display_name text := '';
  existing_whitelist_count integer;
  total_users integer;
begin
  -- Check if they are the first ever registered user. If so, make them Admin.
  select count(*) into total_users from public.profiles;
  
  if total_users = 0 then
    is_admin_flag := true;
    display_name := coalesce(new.raw_user_meta_data->>'name', 'Admin');
    
    -- Insert into whitelist automatically to support first signup
    insert into public.whitelist (email, name, is_admin, registered)
    values (new.email, display_name, true, true)
    on conflict (email) do update 
    set is_admin = true, registered = true, name = display_name;
  else
    -- If not first, check whitelist
    select count(*), max(name), max(is_admin::int)::boolean 
    into existing_whitelist_count, display_name, is_admin_flag
    from public.whitelist 
    where lower(email) = lower(new.email);

    -- If not whitelisted, prevent signup
    if existing_whitelist_count = 0 then
      raise exception 'Signup rejected: Email is not whitelisted. Contact the administrator.';
    end if;

    -- Update whitelist status to registered
    update public.whitelist 
    set registered = true, name = coalesce(new.raw_user_meta_data->>'name', display_name)
    where lower(email) = lower(new.email);
    
    display_name := coalesce(new.raw_user_meta_data->>'name', display_name, 'Friend');
  end if;

  -- Create public profile
  insert into public.profiles (id, name, email, is_admin)
  values (new.id, display_name, new.email, is_admin_flag);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- B. Auto-remove profile when whitelist is deleted (sync deleted users)
create or replace function public.handle_deleted_whitelist()
returns trigger as $$
begin
  -- Delete user from public.profiles (which cascade deletes bookings, requests, suggestions)
  delete from public.profiles where lower(email) = lower(old.email);
  return old;
end;
$$ language plpgsql security definer;

create or replace trigger on_whitelist_deleted
  before delete on public.whitelist
  for each row execute procedure public.handle_deleted_whitelist();
