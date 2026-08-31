FROM rust:1-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for Docker layer caching.
# Cargo.lock is committed for reproducible builds (Rust binary best practice).
COPY Cargo.toml ./
COPY Cargo.lock* ./

# Pre-build dependencies in a dummy crate for layer caching
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Copy actual source and build
COPY . .
RUN touch src/main.rs
RUN cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/backend /app/backend

# Railway automatically assigns the PORT environment variable.
# We expose it dynamically if needed by some platforms, but it's optional.
# Removing ENV PORT=3000 to prevent conflicts with Railway's load balancer.

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-3000}/api/v1/health || exit 1

CMD ["/app/backend"]
