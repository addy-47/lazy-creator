# Use Node.js 20 as the base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm if not already available
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .
COPY .env* ./

# Build the application with specified mode
ARG VITE_MODE=production
ENV VITE_MODE=${VITE_MODE}

RUN if [ "$VITE_MODE" = "production" ] ; then pnpm build --mode ${VITE_MODE} ; fi

# Production stage (Static Serving)
FROM nginx:alpine AS production
ARG VITE_MODE=production
# Skip if development
RUN if [ "$VITE_MODE" = "development" ] ; then exit 0 ; fi

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port (Internal container port)
EXPOSE 5555

# Start nginx server
CMD ["nginx", "-g", "daemon off;"]

# Development stage (Live Reload)
FROM builder AS development
EXPOSE 5555
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5555"]
