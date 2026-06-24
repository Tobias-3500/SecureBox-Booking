# ============================================================================
# Dockerfile (frontend) — Bygger React-appen og serverer den med nginx.
#
# To-trins build (multi-stage):
#   1) "build": kompilerer React til statiske filer med "npm run build"
#   2) "production": kopierer kun de færdige filer ind i et lille nginx-image
# Resultatet er et lille, hurtigt image uden Node.js eller kildekode.
# ============================================================================

# Trin 1: byg de statiske React-filer.
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --progress=false

COPY . .
RUN npm run build

# Trin 2: produktionsimage — server de byggede filer med nginx.
FROM nginx:alpine

# De færdige React-filer fra trin 1
COPY --from=build /app/build /usr/share/nginx/html
# Konfiguration for denne interne nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
