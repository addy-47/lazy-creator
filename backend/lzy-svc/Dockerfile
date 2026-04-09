# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o lzy-svc ./cmd/lzy-svc/main.go

# Final stage
FROM alpine:3.21

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/lzy-svc .
COPY --from=builder /app/.env .
# Ensure YouTube client secret is available at runtime
COPY --from=builder /app/yt-client-secret.json .
COPY --from=builder /app/sa-secret.json .

# Expose the service port
EXPOSE 8888

# Command to run the service
CMD ["./lzy-svc"]
