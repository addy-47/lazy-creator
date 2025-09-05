# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Final stage
FROM nginx:1.25-alpine
# Install gettext for envsubst
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
# Copy the nginx config as a template
COPY nginx.conf /etc/nginx/templates/default.conf.template
# Use envsubst to substitute the PORT variable and start nginx
CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
