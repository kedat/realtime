# Offline Translation Server Deployment

This guide explains how to deploy the real-time translation server for completely offline use.

## 🎯 Deployment Options

### Option 1: Docker Container (Recommended)

#### Build the container:

```bash
# Build Docker image with pre-downloaded models
docker build -t translation-server .

# Run the container
docker run -d \
  --name translation-app \
  -p 8765:8765 \
  -p 3000:3000 \
  translation-server
```

#### Container Features:

- ✅ All models pre-downloaded
- ✅ No internet required after build
- ✅ Portable across systems
- ✅ Consistent environment

### Option 2: Standalone Package

#### 1. Install dependencies:

```bash
pip install -r requirements.txt
```

#### 2. Download models (requires internet):

```bash
python utils/download_models.py
```

#### 3. Verify offline capability:

```bash
python utils/download_models.py verify
```

#### 4. Run offline:

```bash
# Set offline mode
export TRANSFORMERS_OFFLINE=1
export TRANSFORMERS_CACHE=./models

# Start server
python server.py
```

## 📦 What Gets Downloaded

The following translation models (~3.1GB total):

| Language   | To English                 | From English               |
| ---------- | -------------------------- | -------------------------- |
| Spanish    | Helsinki-NLP/opus-mt-es-en | Helsinki-NLP/opus-mt-en-es |
| French     | Helsinki-NLP/opus-mt-fr-en | Helsinki-NLP/opus-mt-en-fr |
| German     | Helsinki-NLP/opus-mt-de-en | Helsinki-NLP/opus-mt-en-de |
| Italian    | Helsinki-NLP/opus-mt-it-en | Helsinki-NLP/opus-mt-en-it |
| Portuguese | Helsinki-NLP/opus-mt-pt-en | Helsinki-NLP/opus-mt-en-pt |

## 🔒 Offline Verification

Once models are downloaded, test offline mode:

```bash
# Disconnect from internet
# Run verification
python utils/download_models.py verify

# Check cache size
python utils/download_models.py size
```

## 🚀 Production Deployment

### Docker Compose (Full Stack)

Create `docker-compose.yml`:

```yaml
version: "3.8"
services:
  translation-server:
    build: .
    ports:
      - "8765:8765"
      - "3000:3000"
    environment:
      - TRANSFORMERS_OFFLINE=1
      - TRANSFORMERS_CACHE=/app/models
    volumes:
      - models_cache:/app/models
    restart: unless-stopped

volumes:
  models_cache:
```

Run with:

```bash
docker-compose up -d
```

### Systemd Service (Linux)

Create `/etc/systemd/system/translation-server.service`:

```ini
[Unit]
Description=Offline Translation Server
After=network.target

[Service]
Type=simple
User=translation
WorkingDirectory=/opt/translation-server
Environment=TRANSFORMERS_OFFLINE=1
Environment=TRANSFORMERS_CACHE=/opt/translation-server/models
ExecStart=/opt/translation-server/venv/bin/python server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## 🔧 Configuration

### Environment Variables

- `TRANSFORMERS_CACHE`: Models cache directory (default: ./models)
- `TRANSFORMERS_OFFLINE`: Force offline mode (set to 1)
- `HF_HOME`: Hugging Face cache directory

### Server Configuration

Edit `server.py` to modify:

- Port: `port=8765`
- Host: `host="0.0.0.0"` for external access
- Supported languages in `TRANSLATION_MODELS`

## 📊 System Requirements

### Minimum:

- RAM: 4GB
- Storage: 5GB (for models + OS)
- CPU: 2 cores

### Recommended:

- RAM: 8GB
- Storage: 10GB SSD
- CPU: 4 cores
- GPU: Optional (for faster translation)

## 🛠️ Troubleshooting

### Models not loading:

```bash
# Check cache directory
ls -la ./models

# Re-download models
rm -rf ./models
python utils/download_models.py
```

### Memory issues:

- Reduce concurrent connections
- Use CPU-only mode (no GPU)
- Restart service periodically

### Network errors:

- Ensure offline mode: `export TRANSFORMERS_OFFLINE=1`
- Check firewall settings for ports 8765, 3000
- Verify WebSocket connections

## 🔐 Security Considerations

1. **Network isolation**: Run in isolated network
2. **User permissions**: Run as non-root user
3. **File permissions**: Restrict model cache access
4. **Updates**: Plan for security updates without internet

## 📈 Performance Tips

1. **Preload models**: Load all models at startup
2. **Model caching**: Keep models in memory
3. **Connection pooling**: Reuse WebSocket connections
4. **CPU optimization**: Use optimized PyTorch builds

## ✅ Deployment Checklist

- [ ] Models downloaded and verified
- [ ] Offline mode tested
- [ ] Docker image built (if using containers)
- [ ] Network configuration tested
- [ ] Security settings applied
- [ ] Monitoring setup (optional)
- [ ] Backup strategy for model cache
- [ ] Update procedure documented
