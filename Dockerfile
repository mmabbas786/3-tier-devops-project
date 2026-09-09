# Stage 1: Build React Frontend
FROM node:18-alpine AS client-builder

WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
ENV REACT_APP_API=/api
ENV CI=false
RUN npm run build

# Stage 2: Production Server (Node.js API + Static Client)
FROM node:22-alpine

WORKDIR /app

# Install API dependencies
COPY api/package*.json ./
RUN npm install --only=production

# Copy API source files
COPY api/ ./

# Copy compiled React UI from builder stage
COPY --from=client-builder /client/build ./client_build

EXPOSE 5000
ENV PORT=5000

CMD ["node", "app.js"]
