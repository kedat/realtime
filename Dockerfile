FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    portaudio19-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download translation models to make it truly offline
RUN python -c "
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import os

# Create models directory
os.makedirs('/app/models', exist_ok=True)

# Pre-download all translation models
models = [
    'Helsinki-NLP/opus-mt-es-en',
    'Helsinki-NLP/opus-mt-en-es',
    'Helsinki-NLP/opus-mt-fr-en',
    'Helsinki-NLP/opus-mt-en-fr',
    'Helsinki-NLP/opus-mt-de-en',
    'Helsinki-NLP/opus-mt-en-de',
    'Helsinki-NLP/opus-mt-it-en',
    'Helsinki-NLP/opus-mt-en-it',
    'Helsinki-NLP/opus-mt-pt-en',
    'Helsinki-NLP/opus-mt-en-pt'
]

for model_name in models:
    print(f'Downloading {model_name}...')
    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir='/app/models')
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name, cache_dir='/app/models')
    print(f'Downloaded {model_name}')
"

# Copy application code
COPY server.py .
COPY nextjs-app ./nextjs-app

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose ports
EXPOSE 8765 3000

# Set environment variables for offline mode
ENV TRANSFORMERS_CACHE=/app/models
ENV HF_HOME=/app/models
ENV TRANSFORMERS_OFFLINE=1

# Start command
CMD ["python", "server.py"]
