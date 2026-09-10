declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    SUPABASE_URL?: string;
    SUPABASE_SECRET_KEY?: string;
  }
}
