import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// The client is created on first use, not at import time: `next build` prerenders pages without
// the Supabase env vars (e.g. Preview deployments) and must not crash while importing this module.
function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno.");
    }
    client = createClient(url, anonKey);
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});

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
