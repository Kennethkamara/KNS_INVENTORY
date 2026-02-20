/**
 * Supabase Configuration
 * Initialize and export Supabase client for the KNS Inventory System
 */

// Supabase Project Credentials
const SUPABASE_URL = 'https://znuytfzrlgaptxppzjtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpudXl0ZnpybGdhcHR4cHB6anR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTk5MDUsImV4cCI6MjA4Njg5NTkwNX0.xlK2GyfOWRGVM3YBODfP6tyEn-Nnds4_4T1rWjQ47Ho';

// Initialize Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

console.log('✅ Supabase client initialized for project: znuytfzrlgaptxppzjtv');
