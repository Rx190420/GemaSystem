# Railway's automatic Node builder (Nixpacks) can install this app fine, but
# Puppeteer's Chromium then fails at *runtime* with
# "error while loading shared libraries: libnss3.so: cannot open shared object file"
# (or similar) — the base Node image is missing the system libraries Chrome
# needs to actually launch. A Dockerfile that installs Chromium + its
# dependencies via apt is the reliable fix; Railway auto-detects and uses this
# file instead of Nixpacks as soon as it exists in the service's root.
FROM node:20-bookworm-slim

# System Chromium + the shared libraries it needs to run headless. Installing
# the browser via apt (instead of letting puppeteer download its own copy)
# guarantees a build made for this exact OS/arch, and skips a large, flaky
# download during `npm install`.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell puppeteer to use the apt-installed Chromium above instead of downloading
# its own — faster builds, and guaranteed to match the libraries just installed.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js ./

# Railway injects PORT at runtime; the app reads it (see index.js). Documented
# here for anyone reading the image, not required for Railway itself.
EXPOSE 3001

CMD ["node", "index.js"]
