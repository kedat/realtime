#!/usr/bin/env python3
"""
Pre-download translation models for offline deployment.
Run this script with internet connection to prepare for offline use.
"""

import os
import sys
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Model cache directory
MODELS_CACHE_DIR = os.environ.get("TRANSFORMERS_CACHE", "./models")

# Available offline translation models
TRANSLATION_MODELS = [
    "Helsinki-NLP/opus-mt-es-en",  # Spanish to English
    "Helsinki-NLP/opus-mt-en-es",  # English to Spanish
    "Helsinki-NLP/opus-mt-fr-en",  # French to English
    "Helsinki-NLP/opus-mt-en-fr",  # English to French
    "Helsinki-NLP/opus-mt-de-en",  # German to English
    "Helsinki-NLP/opus-mt-en-de",  # English to German
    "Helsinki-NLP/opus-mt-it-en",  # Italian to English
    "Helsinki-NLP/opus-mt-en-it",  # English to Italian
    "Helsinki-NLP/opus-mt-pt-en",  # Portuguese to English
    "Helsinki-NLP/opus-mt-en-pt",  # English to Portuguese
]


def download_models():
    """Download all translation models for offline use"""
    os.makedirs(MODELS_CACHE_DIR, exist_ok=True)

    print(f"📦 Downloading translation models to: {MODELS_CACHE_DIR}")
    print(f"🌐 Total models to download: {len(TRANSLATION_MODELS)}")
    print("⚠️  This requires internet connection and will take some time...")
    print()

    for i, model_name in enumerate(TRANSLATION_MODELS, 1):
        try:
            print(f"[{i}/{len(TRANSLATION_MODELS)}] 📥 Downloading {model_name}...")

            # Download tokenizer
            tokenizer = AutoTokenizer.from_pretrained(
                model_name, cache_dir=MODELS_CACHE_DIR
            )

            # Download model
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name, cache_dir=MODELS_CACHE_DIR
            )

            print(f"✅ Successfully downloaded {model_name}")

        except Exception as e:
            print(f"❌ Failed to download {model_name}: {e}")
            return False

    print()
    print("🎉 All models downloaded successfully!")
    print(f"📁 Models cached in: {MODELS_CACHE_DIR}")
    print("🔒 Your translation server can now run completely offline!")
    return True


def verify_offline_models():
    """Verify that models can be loaded in offline mode"""
    print("🔍 Verifying offline models...")

    for model_name in TRANSLATION_MODELS:
        try:
            # Test loading in offline mode
            tokenizer = AutoTokenizer.from_pretrained(
                model_name, cache_dir=MODELS_CACHE_DIR, local_files_only=True
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name, cache_dir=MODELS_CACHE_DIR, local_files_only=True
            )
            print(f"✅ {model_name} - OK")

        except Exception as e:
            print(f"❌ {model_name} - FAILED: {e}")
            return False

    print("🎉 All models verified for offline use!")
    return True


def get_cache_size():
    """Get the total size of the model cache"""
    total_size = 0
    if os.path.exists(MODELS_CACHE_DIR):
        for dirpath, dirnames, filenames in os.walk(MODELS_CACHE_DIR):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                total_size += os.path.getsize(filepath)

    # Convert to human readable format
    if total_size > 1024 * 1024 * 1024:  # GB
        size_str = f"{total_size / (1024 * 1024 * 1024):.2f} GB"
    elif total_size > 1024 * 1024:  # MB
        size_str = f"{total_size / (1024 * 1024):.2f} MB"
    else:
        size_str = f"{total_size / 1024:.2f} KB"

    return size_str


if __name__ == "__main__":
    print("🚀 Translation Model Downloader")
    print("=" * 50)

    if len(sys.argv) > 1:
        if sys.argv[1] == "verify":
            verify_offline_models()
            print(f"📊 Cache size: {get_cache_size()}")
            sys.exit(0)
        elif sys.argv[1] == "size":
            print(f"📊 Current cache size: {get_cache_size()}")
            sys.exit(0)

    # Download models
    success = download_models()

    if success:
        print()
        print("🔍 Verifying downloaded models...")
        if verify_offline_models():
            print(f"📊 Total cache size: {get_cache_size()}")
            print()
            print(
                "🎯 Setup complete! Your translation server is ready for offline deployment."
            )
            print("💡 You can now:")
            print("   1. Build Docker image: docker build -t translation-server .")
            print("   2. Run offline: python server.py")
        else:
            print(
                "⚠️ Some models failed verification. Check your internet connection and try again."
            )
            sys.exit(1)
    else:
        print("❌ Model download failed. Check your internet connection and try again.")
        sys.exit(1)
