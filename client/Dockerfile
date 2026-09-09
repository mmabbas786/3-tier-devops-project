# Stage 1: Build React App
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Optional: pass REACT_APP_API as build arg (defaults to /api)
ARG REACT_APP_API=/api
ENV REACT_APP_API=$REACT_APP_API

RUN npm run build

# Stage 2: Serve with NGINX
FROM nginx:alpine

# 🟢 Copy correct default.conf to override nginx default
COPY default.conf /etc/nginx/conf.d/default.conf

# 🟢 Copy React build output
COPY --from=build /app/build /usr/share/nginx/html

# 🔒 Prevent directory listings and ensure correct permissions
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["/bin/sh", "-c", "sed -i 's/listen 80;/listen '${PORT:-80}';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
