import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@demo.school',
    password: 'Admin@1234'
  });

  if (error) {
    console.error('Auth Error:', error.message);
  } else {
    console.log('Auth Success:', data.user?.email);
  }
}

testAuth();
