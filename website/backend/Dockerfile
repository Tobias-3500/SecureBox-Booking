# ============================================================================
# Dockerfile (backend) — Opskrift på backend-containerens image.
# Pakker Node.js-API'et og alle dets afhængigheder ind i ét genskabeligt image,
# der kører ens lokalt og i produktion.
# ============================================================================

FROM node:18-alpine

WORKDIR /app

# curl bruges af Dockers healthcheck til at kalde /api/health.
RUN apk add --no-cache curl

# Installer afhængigheder først (kopieres separat, så Docker kan cache dette trin).
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --progress=false

# Kopiér resten af kildekoden ind.
COPY . .

EXPOSE 3001

# Start API'et.
CMD ["node", "server.js"]
