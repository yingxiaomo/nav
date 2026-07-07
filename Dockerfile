# Stage 1: Build frontend static files
FROM node:20-alpine AS frontend
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build Go backend (static binary) + UPX 压缩
FROM golang:1.25-alpine AS gb
RUN apk add --no-cache ca-certificates tzdata upx
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /nav-server ./cmd/nav-server && upx --best -q /nav-server

# Stage 3: Minimal runtime
FROM scratch
WORKDIR /app
COPY --from=gb /etc/ssl/certs /etc/ssl/certs
COPY --from=gb /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=gb /nav-server /nav-server
COPY --from=frontend /app/out ./public
VOLUME /app/data
ENV PORT=8642 DATABASE_URL=/app/data/nav.db UPLOAD_DIR=/app/data/uploads CORS_ORIGIN=*
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD ["/nav-server", "healthcheck"]
EXPOSE 8642
CMD ["/nav-server"]
