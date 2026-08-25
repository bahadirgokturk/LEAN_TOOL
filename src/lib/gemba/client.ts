import { createClient } from "@supabase/supabase-js";

export function createGembaClient() {
  return createClient(
    "https://xeettwmxooxtwxzevitk.supabase.co",
    "sb_publishable_pdU1baOJtG9xNJ0Z5WnRrA_XkKCBEh0"
  );
}
