#!/bin/bash
# Deploy/update script for the pharmacy app on a VPS.
# Run from the project root: ./deploy.sh

set -e

echo "🔄 Pulling latest code..."
git pull

echo "📦 Installing dependencies..."
yarn install

echo "🏗️  Building production bundle..."
NODE_OPTIONS="--max-old-space-size=2048" yarn build

echo "🔁 Restarting PM2 process..."
if pm2 describe pharmacy > /dev/null 2>&1; then
  pm2 restart pharmacy
else
  pm2 start "yarn start" --name pharmacy
  pm2 save
fi

echo "✅ Done! App is running on http://localhost:3000"
pm2 status pharmacy
