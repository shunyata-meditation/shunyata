# syntax=docker/dockerfile:1
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-slim AS runtime

# Nitro listens on NITRO_PORT ?? PORT; leave NITRO_PORT unset so Railway's injected PORT wins.
# PORT=3000 is only the fallback for running the image outside Railway.
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
