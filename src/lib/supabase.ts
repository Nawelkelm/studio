import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Printer = {
  id: string;
  name: string;
  filament_cost_per_kg: number;
  electricity_cost_kwh: number;
  printer_power: number;
  printer_lifespan: number;
  printer_cost: number;
  failure_rate_percent: number;
  created_at: string;
  updated_at: string;
};

export type Quotation = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  client_name: string;
  printer_id: string;
  printer_name: string;
  material_used: string;
  print_weight_grams: number;
  print_time_hours: number;
  print_time_minutes: number;
  quantity: number;
  extra_costs: number;
  profit_multiplier: number;
  total_cost: number;
  selling_price: number;
  status: "pendiente" | "aprobada" | "rechazada";
  notes: string | null;
  created_at: string;
  updated_at: string;
};
