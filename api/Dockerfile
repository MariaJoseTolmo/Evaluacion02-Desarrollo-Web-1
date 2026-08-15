# syntax=docker/dockerfile:1

# --- Etapa de compilación: necesita devDependencies y el compilador de TypeScript.
FROM node:22-alpine AS build
WORKDIR /app

# argon2 trae un addon nativo; si no hay binario precompilado para musl,
# node-gyp lo compila en esta etapa.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Etapa de ejecución: sólo dependencias de producción y el JavaScript compilado.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# Las herramientas de compilación se instalan, se usan y se borran en la misma
# capa para que no queden en la imagen final.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev \
 && npm cache clean --force \
 && apk del .build-deps

COPY --from=build /app/dist ./dist
# Se incluye para poder verificar el despliegue desde adentro del contenedor:
#   docker compose exec api node smoke-test.mjs
COPY smoke-test.mjs ./

USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
