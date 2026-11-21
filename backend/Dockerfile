# Build stage: install everything, compile, then drop dev dependencies.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Runtime stage: compiled output and production dependencies only.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# The seed applies pending migrations and creates the default user, then the API starts.
CMD ["sh", "-c", "node dist/database/seed/seed.js && exec node dist/main.js"]
