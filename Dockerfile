# ---- Stage 0: Development ----
FROM node:lts-alpine AS dev
WORKDIR /usr/src/app

# Install runtime system dependencies for scrapers
RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip3 install --no-cache-dir gallery-dl yt-dlp --break-system-packages

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent

RUN chown -R node /usr/src/app
USER node

EXPOSE 3000
CMD ["npx", "next", "dev", "-H", "0.0.0.0"]

# ---- Stage 1: Build ----
FROM node:lts-alpine AS builder
WORKDIR /usr/src/app

# Do NOT set NODE_ENV=production here — npm would skip devDependencies.
# Leaving it unset ensures the full install.

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent

# Now set production for the build and prune
ENV NODE_ENV=production
COPY . .
RUN npm run build

# ---- Stage 2: Run ----
FROM node:lts-alpine AS runner
WORKDIR /usr/src/app

# Install runtime system dependencies for scrapers
RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip3 install --no-cache-dir gallery-dl yt-dlp --break-system-packages

ENV NODE_ENV=production

# Copy the standalone server output (includes traced node_modules)
COPY --from=builder /usr/src/app/.next/standalone ./
# Standalone doesn't include static assets — copy separately
COPY --from=builder /usr/src/app/.next/static ./.next/static
# Public directory (empty placeholders for symlinks created by entrypoint)
COPY --from=builder /usr/src/app/public ./public
# Non-code files needed at runtime
COPY --from=builder /usr/src/app/drizzle ./drizzle
COPY --from=builder /usr/src/app/gallery-dl-default.conf ./gallery-dl-default.conf
COPY --from=builder /usr/src/app/docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 3000

RUN chmod +x /usr/src/app/docker-entrypoint.sh
RUN chown -R node /usr/src/app
USER node

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
