FROM node:20-slim

# Playwright system deps
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libwayland-client0 \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx playwright install chromium

# Install and build frontend
COPY dashboard/package.json dashboard/package-lock.json ./dashboard/
RUN cd dashboard && npm ci
COPY dashboard/ ./dashboard/
RUN cd dashboard && npx vite build

# Copy backend source
COPY *.js ./

# Data directory (mount a volume here on Railway)
RUN mkdir -p /data/pdfs /data/escritos
ENV DATA_DIR=/data
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "server.js"]
