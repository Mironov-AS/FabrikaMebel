#!/bin/bash
# Start ContractPro — Backend API + Frontend Dev Server

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting ContractPro..."

# Start backend
cd "$PROJECT_DIR/backend"
if [ ! -f "data/database.sqlite" ]; then
  echo "Database not found, seeding..."
  node src/seed.js
fi
node src/server.js &
BACKEND_PID=$!
echo "✓ Backend API started (PID: $BACKEND_PID) on port 3001"

# Start frontend
cd "$PROJECT_DIR"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
echo "✓ Frontend dev server started (PID: $FRONTEND_PID) on port 5173"

echo ""
echo "ContractPro is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001/api/health"
echo ""
echo "Default password for all users: password123"
echo "MFA required for: Директор (director@furniture.ru), Бухгалтер (accountant@furniture.ru)"

wait
