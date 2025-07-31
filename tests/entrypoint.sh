#!/bin/sh

echo "Running entrypoint..."

# Wait for Postgres to be ready
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Waiting for postgres..."
  sleep 2
done

echo "Postgres is ready. Starting app..."

# Start app with PM2
exec npx pm2-runtime ecosystem.config.js