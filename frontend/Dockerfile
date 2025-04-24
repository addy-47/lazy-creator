FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build the app for production
RUN npm run build

# Use Nginx to serve the static files
FROM nginx:stable-alpine

# Copy build files from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run specific: use PORT environment variable
ENV PORT 8080
EXPOSE 8080

# Update nginx conf to listen on $PORT and start nginx
CMD sed -i -e 's/$PORT/'"$PORT"'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;' 