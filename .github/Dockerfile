FROM node:18-slim

WORKDIR /app

# Install system dependencies for Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium from Debian repositories (works on ARM64)
RUN apt-get update && apt-get install -y \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copy entire project
COPY . .

# Install dependencies with Puppeteer skip download (using system Chrome)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm install

# Add non-root user
RUN useradd -m -u 9999 chromeuser && chown -R chromeuser:chromeuser /app
USER chromeuser

# Set Chrome path for Puppeteer to use Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Run tests
CMD ["npm", "test"]