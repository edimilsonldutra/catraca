# deps: dependências completas (build e gates)
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# gates: código inteiro, roda typecheck, lint e testes (scripts/gates.sh)
FROM deps AS gates
COPY . .
CMD ["bash", "scripts/check.sh"]

# build: compila o TypeScript
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx tsc -p tsconfig.build.json

# runtime: só dependências de produção e o código compilado
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
USER node
EXPOSE 3080
CMD ["node", "dist/server.js"]
