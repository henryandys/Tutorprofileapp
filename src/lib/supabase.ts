import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseAnonKey = publicAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions
export type UserRole = 'student' | 'tutor' | 'parent';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  location?: string;
  bio?: string;
  phone?: string;
  date_of_birth?: string;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}
