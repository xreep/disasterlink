import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface HelpRequest {
  id: string
  victim_name: string | null
  victim_phone: string | null
  need_type: string
  description: string | null
  location_state: string
  location_district: string
  latitude: number | null
  longitude: number | null
  severity: string
  people: number
  status: string
  source: string
  created_at: string
}

export interface Volunteer {
  id: string
  name: string
  district: string
  state: string
  skill: string
  status: string
  task_id: string | null
}

export interface Resource {
  id: number
  name: string
  category: string
  available: number
  deployed: number
  total: number
  location: string
}

export interface Disaster {
  id: number
  name: string
  type: string
  is_active: boolean
}
