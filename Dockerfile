# ---- Build Stage ----
FROM oven/bun:1.1.13 as build
WORKDIR /app
COPY . .
RUN bun install --production

# ---- Run Stage ----
FROM oven/bun:1.1.13 as run
WORKDIR /app
COPY --from=build /app /app

# Set environment variables (override at runtime or with .env file)
ENV AWS_ACCESS_KEY_ID=your_access_key_here
ENV AWS_SECRET_ACCESS_KEY=your_secret_key_here
ENV AWS_REGION=us-east-1
ENV S3_BUCKET_NAME=your-bucket-name

EXPOSE 3001
CMD ["bun", "run", "server.ts"] 