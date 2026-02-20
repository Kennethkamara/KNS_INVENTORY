/**
 * Supabase Configuration Example
 * Copy this file to supabase-config.js and fill in your actual credentials.
 * DO NOT commit supabase-config.js to version control.
 */

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Initialize Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabaseClient;
