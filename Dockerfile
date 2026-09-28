FROM node:22-alpine

WORKDIR /app

# Copy only what we need
COPY package*.json ./
COPY tsconfig.json ./

# Run npm ci
RUN npm ci --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Run the build
CMD ["sh", "-c", "set -e && echo '=== Starting Astro build ===' && echo 'Current directory: $(pwd)' && echo 'Contents: $(ls -la)' && npm run build 2>&1"]
