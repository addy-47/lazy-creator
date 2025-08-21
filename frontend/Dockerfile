# Stage 1: Build the application
FROM node:20-alpine as build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .

RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Copy built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port the container will listen on
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]