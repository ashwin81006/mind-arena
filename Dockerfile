# Multi-service container for Mind Arena (Java Authoritative Server + Web Server & WebSocket Bridge)
FROM eclipse-temurin:17-jdk-jammy

# Install Node.js 20 runtime
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and compile Java authoritative server
COPY server/ ./server/
RUN javac -d server/src server/src/mindarena/*.java

# Copy client code, install dependencies and build production frontend
COPY client/ ./client/
RUN cd client && npm install && npm run build

# Port exposed for Web & WebSocket connections (Render/Railway injects PORT)
ENV PORT=5051
EXPOSE 5051

# Start Java Server in background and WebSocket Bridge/Web Server in foreground
CMD ["sh", "-c", "java -cp server/src mindarena.Server & node client/bridge.js"]
