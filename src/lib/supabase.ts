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

export type UserStatus = "pending" | "active" | "blocked";
export type UserRole = "admin" | "user";

/** Result of register_login(): what the signed-in account is allowed to do. */
export type Access = { status: UserStatus; role: UserRole };

export type AppUser = {
  email: string;
  user_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
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
  /** Legacy: JSON string with the cost breakdown (superseded by `snapshot`) */
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Decision data (migration 20261020_quotation_decision_data.sql)
  piece_name: string | null;
  piece_description: string | null;
  client_contact: string | null;
  channel: "directo" | "mercadolibre" | "instagram" | "whatsapp" | "otro";
  /** Price actually quoted to the client; null on quotations created before the migration */
  final_price: number | null;
  valid_until: string | null;
  internal_notes: string | null;
  /** Inputs and results used when the quotation was made (QuotationSnapshot in quotation-meta.ts) */
  snapshot: unknown;
  lost_reason: "caro" | "tardanza" | "arrepentimiento" | "competencia" | "sin_respuesta" | "otro" | null;
  decided_at: string | null;
};
