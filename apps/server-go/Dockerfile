# Multi-stage build for HyperSync Go Core
FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o hypersync-go-core main.go

# Production minimal scratch/alpine image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/hypersync-go-core /app/hypersync-go-core

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV CORS_ORIGIN=*

ENTRYPOINT ["/app/hypersync-go-core"]
