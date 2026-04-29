FROM node:22-alpine

WORKDIR /app

# Copy server package files and install production deps only
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy all server source files
COPY server/ ./

EXPOSE 3001

CMD ["node", "index.js"]
