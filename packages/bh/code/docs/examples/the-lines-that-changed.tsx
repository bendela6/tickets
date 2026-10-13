import { CodeBlock } from '@bh/code';

const COMPOSE = `services:
  web:
    image: caddy:2
    restart: unless-stopped
    environment:
      - SITE_ADDRESS=example.com`;

export function TheLinesThatChanged() {
  return <CodeBlock value={COMPOSE} lang="yaml" file="compose.yaml" marked={new Set([5, 6])} />;
}
