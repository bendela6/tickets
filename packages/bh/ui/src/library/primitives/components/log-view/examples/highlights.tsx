import { LogView } from '@bh/ui';

// What a build prints, as one string: the view splits it at each newline.
const BUILD = `2026-10-08T00:46:03Z Scope: 8 of 9 workspace projects
? Verifying lockfile against supply-chain policies (806 entries)...
✓ Lockfile passes supply-chain policies (806 entries in 4.7s)
[WARN] Tarball download average speed 22 KiB/s (size 37 KiB) is below 50 KiB/s
Progress: resolved 750, reused 0, downloaded 477, added 480
Done in 9.6s using pnpm v12.4.2
Container gateway-docker-proxy-1 Healthy
error: password authentication failed for user "app_owner"
failed before anything was started: docker compose run failed (exit 1)`;

export function Highlights() {
  return <LogView lines={BUILD} label="Build log" className="w-full" />;
}
