FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY apps/assistant-web/package.json apps/assistant-web/package.json
COPY packages/assistant-api-contract/package.json packages/assistant-api-contract/package.json

RUN npm ci

FROM deps AS builder

WORKDIR /app
COPY apps/assistant-web apps/assistant-web
COPY packages/assistant-api-contract packages/assistant-api-contract

ARG NEXT_PUBLIC_ASSISTANT_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_ASSISTANT_API_URL=$NEXT_PUBLIC_ASSISTANT_API_URL

RUN npm --workspace apps/assistant-web run generate:api
RUN npm --workspace apps/assistant-web run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/assistant-web /app/apps/assistant-web
COPY --from=builder /app/packages/assistant-api-contract /app/packages/assistant-api-contract

EXPOSE 3000

CMD ["npm", "--workspace", "apps/assistant-web", "run", "start"]
