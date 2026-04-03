import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://mzihjwavyxivuqzzeivh.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_t6RsNNs2MBCHy_SXcP6evg_HVAuOAKj";
export const PHOTO_BUCKET = "photos";
export const ADMIN_EMAIL = "COLOQUE_O_SEU_EMAIL_AQUI";
export const DEFAULT_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);