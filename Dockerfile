FROM node:20-slim

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 libdrm2 \
    libxkbcommon0 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libxshmfence1 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
    libatspi2.0-0 libcups2 libxfixes3 libdbus-1-3 libexpat1 libxcb1 \
    libxext6 libx11-6 fonts-liberation wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Install Playwright Chromium
RUN npx playwright install chromium

# Build dashboard
COPY dashboard/package.json dashboard/package-lock.json* ./dashboard/
RUN cd dashboard && npm install
COPY dashboard/ ./dashboard/
RUN cd dashboard && npx vite build

# Copy app
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
