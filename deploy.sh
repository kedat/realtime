#!/bin/bash
# Quick deployment script for offline translation server

set -e

echo "🚀 Offline Translation Server Deployment"
echo "=" $(printf "%s" "=====================================")

# Check if virtual environment exists
if [ ! -d "backend_venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv backend_venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source backend_venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Download models if they don't exist
if [ ! -d "models" ] || [ -z "$(ls -A models 2>/dev/null)" ]; then
    echo "🌐 Downloading translation models (requires internet)..."
    python utils/download_models.py
else
    echo "✅ Models already downloaded"
fi

# Test offline capability
echo "🔒 Testing offline translation..."
python utils/test_offline.py

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "🚀 To start the server:"
echo "   source backend_venv/bin/activate"
echo "   python server.py"
echo ""
echo "🌐 Then open: http://localhost:3000"
echo ""
echo "📦 For Docker deployment:"
echo "   docker build -t translation-server ."
echo "   docker run -p 8765:8765 -p 3000:3000 translation-server"
