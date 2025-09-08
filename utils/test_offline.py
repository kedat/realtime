#!/usr/bin/env python3
"""
Test offline translation capability
"""

import os
import sys

# Force offline mode
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["TRANSFORMERS_CACHE"] = "./models"


def test_offline_translation():
    """Test that translation works offline"""
    try:
        # Import after setting environment variables
        from server import OfflineTranslator

        print("🧪 Testing offline translation...")
        translator = OfflineTranslator()

        # Test Spanish to English
        result = translator.translate_to_english("Hola mundo", "es")
        print(f"✅ ES→EN: 'Hola mundo' → '{result}'")

        # Test English to Spanish
        result = translator.translate_from_english("Hello world", "es")
        print(f"✅ EN→ES: 'Hello world' → '{result}'")

        print("🎉 Offline translation test successful!")
        return True

    except Exception as e:
        print(f"❌ Offline translation test failed: {e}")
        return False


if __name__ == "__main__":
    print("🔒 Offline Translation Test")
    print("=" * 40)

    # Check if models directory exists
    if not os.path.exists("./models"):
        print("❌ Models directory not found!")
        print("💡 Run: python download_models.py")
        sys.exit(1)

    # Test offline capability
    success = test_offline_translation()

    if success:
        print("\n✅ Your translation server is ready for offline deployment!")
    else:
        print("\n❌ Offline test failed. Check model cache and try again.")
        sys.exit(1)
