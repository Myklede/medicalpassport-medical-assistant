import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async ({ command, mode }) => {
  const localEnv = command === 'serve' ? loadEnv(mode, process.cwd(), '') : {};
  const localSupabaseVars = command === 'serve'
    ? Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SECRET_KEY'].filter(key => localEnv[key]).map(key => [key, localEnv[key]]))
    : {};
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    optimizeDeps: {
      exclude: ['@base-ui/react', '@base-ui/utils', 'lucide-react'],
      include: ['@base-ui/react > use-sync-external-store/shim', '@base-ui/react > use-sync-external-store/shim/with-selector'],
    },
    server: {
      host: '0.0.0.0',
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
      // Local inference runs outside the Worker sandbox. Keep browser/phone
      // requests same-origin and let the Node dev server reach Python loopback.
      proxy: {
        '/api/wound-sessions': {
          target: 'http://127.0.0.1:8000', changeOrigin: false,
          timeout: 65_000, proxyTimeout: 65_000,
        },
      },
    },
    plugins: [
      {
        name: 'medipass-local-wound-origin',
        configureServer(server: ViteDevServer) {
          server.middlewares.use((request, response, next) => {
            if (request.url?.startsWith('/api/wound-sessions') && ['POST', 'DELETE'].includes(request.method || '')) {
              const origin = request.headers.origin;
              let originHost: string | undefined;
              try { originHost = origin ? new URL(origin).host : undefined; } catch { originHost = 'invalid'; }
              if (originHost && originHost !== request.headers.host) {
                response.writeHead(403, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ detail: 'Yêu cầu phải đến từ cùng trang MediPass.' }));
                return;
              }
            }
            next();
          });
        },
      },
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: { ...localBindingConfig, ...(command === 'serve' ? { vars: localSupabaseVars } : {}) },
      }),
    ],
  };
});
