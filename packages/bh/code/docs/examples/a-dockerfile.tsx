import { useState } from 'react';
import { CodeEditor } from '@bh/code';

const DOCKERFILE = `FROM node:22-alpine AS build
WORKDIR /app
COPY . .
# The lockfile decides every version.
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

FROM caddy:2
COPY --from=build /app/dist /srv`;

export function ADockerfile() {
  const [text, setText] = useState(DOCKERFILE);
  return <CodeEditor value={text} onChange={setText} lang="dockerfile" title="Dockerfile" />;
}
