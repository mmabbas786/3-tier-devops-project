FROM node:22-alpine

WORKDIR /app

# Install API dependencies
COPY api/package*.json ./
RUN npm install --only=production

# Copy API source files
COPY api/ ./

EXPOSE 5000
ENV PORT=5000

CMD ["node", "app.js"]
