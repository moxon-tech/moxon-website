(function initMoxonSupabaseClient() {
  const config = window.MOXON_SUPABASE_CONFIG;
  if (!config?.url || !config?.anonKey || !window.supabase?.createClient) {
    window.MOXON_SUPABASE_CLIENT = null;
    return;
  }

  window.MOXON_SUPABASE_CLIENT = window.supabase.createClient(config.url, config.anonKey);
})();
