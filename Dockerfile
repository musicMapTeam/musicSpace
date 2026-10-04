FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web ./web
COPY scripts ./scripts
COPY runtime-preview/src/music-catalogue.js runtime-preview/src/map-catalogue.js runtime-preview/src/admission-protocol.js ./runtime-preview/src/
COPY vite.config.js ./
COPY vite.avatar.config.js vite.livehouse.config.js vite.character.config.js vite.event.config.js vite.map.config.js ./
# `npm run build` first runs `npm run ai:ort` (scripts/ai/copy-ort.mjs), which copies the onnxruntime-web runtime into web/public/ai/ort/.
RUN npm run build:all

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data
COPY --from=build /app/dist ./dist
COPY server ./server
COPY runtime-preview/src ./runtime-preview/src
COPY runtime-preview/drizzle ./runtime-preview/drizzle
COPY package.json ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/event/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
