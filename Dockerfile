FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Production entrypoint: transpile-only (no type-check), no file watcher.
# Local dev overrides this in docker-compose with `npm run dev`.
CMD ["npm", "run", "start:prod"]