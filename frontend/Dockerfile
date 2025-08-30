# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Final dummy stage (we don’t serve here, only copy artifacts out)
FROM alpine:3.19
WORKDIR /app
COPY --from=build /app/dist /app/dist
CMD ["echo", "Frontend build complete"]
