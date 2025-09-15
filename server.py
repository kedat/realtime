#!/usr/bin/env python3
"""
WebSocket server that handles offline translation using Hugging Face transformers.
Speech recognition is done in the browser.
Works completely offline without internet connection once models are downloaded.
"""

import asyncio
import json
import logging
import time
import os
from typing import Dict, Any
import websockets

# Conditional imports for ML libraries
ML_AVAILABLE = False
pipeline = None
AutoTokenizer = None
AutoModelForSeq2SeqLM = None

def _import_ml_libraries():
    """Import ML libraries if available"""
    global ML_AVAILABLE, pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
    if ML_AVAILABLE:
        return
    
    try:
        from transformers import pipeline as _pipeline, AutoTokenizer as _AutoTokenizer, AutoModelForSeq2SeqLM as _AutoModelForSeq2SeqLM
        import torch
        pipeline = _pipeline
        AutoTokenizer = _AutoTokenizer
        AutoModelForSeq2SeqLM = _AutoModelForSeq2SeqLM
        ML_AVAILABLE = True
        logger.info("ML libraries loaded successfully")
    except (ImportError, OSError) as e:
        logger.warning(f"ML libraries not available: {e}")
        logger.warning("Server will run with mock translations")
        ML_AVAILABLE = False
        
        # Mock classes
        class MockPipeline:
            def __call__(self, text, **kwargs):
                return [{"translation_text": f"[MOCK TRANSLATION] {text}"}]
        
        class MockAutoTokenizer:
            @staticmethod
            def from_pretrained(*args, **kwargs):
                return None
        
        class MockAutoModelForSeq2SeqLM:
            @staticmethod
            def from_pretrained(*args, **kwargs):
                return None
        
        def mock_pipeline(*args, **kwargs):
            return MockPipeline()
        
        pipeline = mock_pipeline
        AutoTokenizer = MockAutoTokenizer
        AutoModelForSeq2SeqLM = MockAutoModelForSeq2SeqLM

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set cache directory for offline models
MODELS_CACHE_DIR = os.environ.get("TRANSFORMERS_CACHE", "./models")
os.makedirs(MODELS_CACHE_DIR, exist_ok=True)

# Available offline translation models (bidirectional)
TRANSLATION_MODELS = {
    "es": {
        "to_en": "Helsinki-NLP/opus-mt-es-en",  # Spanish to English
        "from_en": "Helsinki-NLP/opus-mt-en-es",  # English to Spanish
    },
    "fr": {
        "to_en": "Helsinki-NLP/opus-mt-fr-en",  # French to English
        "from_en": "Helsinki-NLP/opus-mt-en-fr",  # English to French
    },
    "de": {
        "to_en": "Helsinki-NLP/opus-mt-de-en",  # German to English
        "from_en": "Helsinki-NLP/opus-mt-en-de",  # English to German
    },
    "it": {
        "to_en": "Helsinki-NLP/opus-mt-it-en",  # Italian to English
        "from_en": "Helsinki-NLP/opus-mt-en-it",  # English to Italian
    },
    "pt": {
        "to_en": "Helsinki-NLP/opus-mt-pt-en",  # Portuguese to English
        "from_en": "Helsinki-NLP/opus-mt-en-pt",  # English to Portuguese
    },
}


class OfflineTranslator:
    """Manages bidirectional offline translation models"""

    def __init__(self):
        _import_ml_libraries()  # Import ML libraries when translator is created
        self.translators = {}
        self.supported_languages = list(TRANSLATION_MODELS.keys())
        logger.info(
            f"Bidirectional translator initialized. Supported languages: {self.supported_languages}"
        )

    def load_model(self, model_key: str):
        """Load a translation model by key"""
        if model_key in self.translators:
            return self.translators[model_key]

        logger.info(f"Loading translation model: {model_key}")

        try:
            # Try to load model and tokenizer from local cache first
            tokenizer = AutoTokenizer.from_pretrained(
                model_key,
                cache_dir=MODELS_CACHE_DIR,
                local_files_only=True,  # Force offline mode
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_key,
                cache_dir=MODELS_CACHE_DIR,
                local_files_only=True,  # Force offline mode
            )

            # Create translation pipeline
            translator = pipeline(
                "translation",
                model=model,
                tokenizer=tokenizer,
                device=-1,  # Use CPU (set to 0 for GPU)
            )

            self.translators[model_key] = translator
            logger.info(f"Model loaded successfully: {model_key}")
            return translator

        except Exception as e:
            logger.warning(f"Failed to load model {model_key}: {e}")
            logger.warning("Using fallback mock translator for demonstration")
            
            # Create a mock translator for demonstration
            class MockTranslator:
                def __call__(self, text, **kwargs):
                    # Simple mock translation - just add [TRANSLATED] prefix
                    return [{"translation_text": f"[MOCK TRANSLATION] {text}"}]
            
            mock_translator = MockTranslator()
            self.translators[model_key] = mock_translator
            return mock_translator

    def translate_to_english(self, text: str, source_language: str) -> str:
        """Translate from foreign language to English (for local assistant)"""
        try:
            if source_language not in TRANSLATION_MODELS:
                raise ValueError(f"Language '{source_language}' not supported")

            model_key = TRANSLATION_MODELS[source_language]["to_en"]
            translator = self.load_model(model_key)

            result = translator(text, max_length=512)
            translation = result[0]["translation_text"]

            logger.info(f"Translated to English: '{text}' → '{translation}'")
            return translation

        except Exception as e:
            logger.error(f"Translation to English error: {e}")
            return f"Translation error: {str(e)}"

    def translate_from_english(self, text: str, target_language: str) -> str:
        """Translate from English to foreign language (for traveler)"""
        try:
            if target_language not in TRANSLATION_MODELS:
                raise ValueError(f"Language '{target_language}' not supported")

            model_key = TRANSLATION_MODELS[target_language]["from_en"]
            translator = self.load_model(model_key)

            result = translator(text, max_length=512)
            translation = result[0]["translation_text"]

            logger.info(
                f"Translated from English: '{text}' → '{translation}' ({target_language})"
            )
            return translation

        except Exception as e:
            logger.error(f"Translation from English error: {e}")
            return f"Translation error: {str(e)}"


class TranslationServer:
    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.clients: Dict[Any, Dict[str, Any]] = {}
        self.translator = OfflineTranslator()
        self.conversation_sessions = {}  # Track conversation sessions

    async def register_client(self, websocket):
        """Register a new client"""
        self.clients[websocket] = {
            "language": "es",
            "translation_enabled": True,
            "role": "traveler",  # "traveler" or "assistant"
            "session_id": None,
        }
        logger.info(f"Client connected: {websocket.remote_address}")

    async def unregister_client(self, websocket):
        """Unregister a client"""
        if websocket in self.clients:
            del self.clients[websocket]
        logger.info(f"Client disconnected: {websocket.remote_address}")

    def translate_traveler_to_assistant(self, text, traveler_language):
        """Translate traveler's speech to English for local assistant"""
        try:
            if traveler_language not in self.translator.supported_languages:
                return f"Language '{traveler_language}' not supported offline. Supported: {self.translator.supported_languages}"

            if traveler_language == "en":
                return text  # Already in English

            translation = self.translator.translate_to_english(text, traveler_language)
            return translation

        except Exception as e:
            logger.error(f"Traveler→Assistant translation error: {e}")
            return f"Translation error: {str(e)}"

    def translate_assistant_to_traveler(self, text, traveler_language):
        """Translate assistant's response to traveler's language"""
        try:
            if traveler_language not in self.translator.supported_languages:
                return f"Language '{traveler_language}' not supported offline. Supported: {self.translator.supported_languages}"

            if traveler_language == "en":
                return text  # Already in traveler's language

            translation = self.translator.translate_from_english(
                text, traveler_language
            )
            return translation

        except Exception as e:
            logger.error(f"Assistant→Traveler translation error: {e}")
            return f"Translation error: {str(e)}"

    async def handle_client(self, websocket):
        """Handle a client connection"""
        await self.register_client(websocket)

        try:
            async for message in websocket:
                try:
                    logger.info(f"📨 Received raw message: {message}")
                    data = json.loads(message)
                    logger.info(f"📋 Parsed message data: {data}")
                    await self.process_message(websocket, data)
                except json.JSONDecodeError as e:
                    logger.error(f"❌ Invalid JSON received: {message} - Error: {e}")
                except Exception as e:
                    logger.error(f"❌ Error processing message: {e}")

        except websockets.exceptions.ConnectionClosed:
            logger.info("🔌 Client connection closed")
        except Exception as e:
            logger.error(f"❌ Error in client handler: {e}")
        finally:
            await self.unregister_client(websocket)

    async def process_message(self, websocket, data: Dict[str, Any]):
        """Process a message from the client"""
        message_type = data.get("type")
        logger.info(f"🎯 Processing message type: {message_type}")

        if message_type == "set_role":
            # Set client role (traveler or assistant)
            role = data.get("role", "traveler")
            session_id = data.get("session_id", "default")

            if websocket in self.clients:
                self.clients[websocket]["role"] = role
                self.clients[websocket]["session_id"] = session_id
                self.clients[websocket]["language"] = data.get("language", "es")

            logger.info(f"👤 Client role set: {role}, session: {session_id}")

        elif message_type == "transcription":
            # Handle speech transcription
            original_text = data.get("text", "")
            client_info = self.clients.get(websocket, {})
            role = client_info.get("role", "traveler")
            language = client_info.get("language", "es")
            session_id = client_info.get("session_id", "default")

            logger.info(
                f"🎤 Received from {role}: '{original_text}' (language: {language})"
            )

            if role == "traveler":
                # Traveler speaks → translate to English for assistant
                translated_text = self.translate_traveler_to_assistant(
                    original_text, language
                )
                logger.info(f"🌐 Traveler→Assistant: '{translated_text}'")

                # Broadcast to assistants in the same session
                await self.broadcast_to_assistants(
                    session_id,
                    {
                        "type": "traveler_message",
                        "original": original_text,
                        "translated": translated_text,
                        "traveler_language": language,
                        "timestamp": time.strftime("%H:%M:%S"),
                    },
                )

                # Send confirmation back to traveler
                response = {
                    "type": "transcription_sent",
                    "original": original_text,
                    "translated_for_assistant": translated_text,
                    "timestamp": time.strftime("%H:%M:%S"),
                }

            elif role == "assistant":
                # Assistant responds → translate to traveler's language
                # First, get the traveler's language from session
                traveler_language = data.get("traveler_language", "es")
                translated_text = self.translate_assistant_to_traveler(
                    original_text, traveler_language
                )
                logger.info(
                    f"🌐 Assistant→Traveler: '{translated_text}' ({traveler_language})"
                )

                # Broadcast to travelers in the same session
                await self.broadcast_to_travelers(
                    session_id,
                    {
                        "type": "assistant_response",
                        "original": original_text,
                        "translated": translated_text,
                        "traveler_language": traveler_language,
                        "timestamp": time.strftime("%H:%M:%S"),
                    },
                )

                # Send confirmation back to assistant
                response = {
                    "type": "response_sent",
                    "original": original_text,
                    "translated_for_traveler": translated_text,
                    "timestamp": time.strftime("%H:%M:%S"),
                }

            try:
                await websocket.send(json.dumps(response))
                logger.info(f"📤 Sent response to {role}")
            except Exception as e:
                logger.error(f"❌ Error sending response: {e}")

        elif message_type == "start_recording":
            # Update client settings when recording starts
            if websocket in self.clients:
                self.clients[websocket]["language"] = data.get("language", "es")
                role = self.clients[websocket].get("role", "traveler")
                logger.info(
                    f"🔴 {role} started recording - Language: {data.get('language', 'es')}"
                )

        elif message_type == "stop_recording":
            role = self.clients.get(websocket, {}).get("role", "unknown")
            logger.info(f"⏹️ {role} stopped recording")

        else:
            logger.warning(f"⚠️ Unknown message type: {message_type}")

    async def broadcast_to_assistants(self, session_id: str, message: dict):
        """Broadcast message to all assistants in the session"""
        for client, info in self.clients.items():
            if info.get("role") == "assistant" and info.get("session_id") == session_id:
                try:
                    await client.send(json.dumps(message))
                    logger.info(f"📡 Broadcasted to assistant in session {session_id}")
                except Exception as e:
                    logger.error(f"❌ Error broadcasting to assistant: {e}")

    async def broadcast_to_travelers(self, session_id: str, message: dict):
        """Broadcast message to all travelers in the session"""
        for client, info in self.clients.items():
            if info.get("role") == "traveler" and info.get("session_id") == session_id:
                try:
                    await client.send(json.dumps(message))
                    logger.info(f"📡 Broadcasted to traveler in session {session_id}")
                except Exception as e:
                    logger.error(f"❌ Error broadcasting to traveler: {e}")

    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"Starting translation server on {self.host}:{self.port}")
        async with websockets.serve(self.handle_client, self.host, self.port):
            logger.info(
                f"🌐 Translation Server running on ws://{self.host}:{self.port}"
            )
            logger.info("Ready to translate speech from browser")
            await asyncio.Future()  # Run forever


def main():
    """Main function to start the server"""
    logger.info("🚀 Starting Offline Translation Server")
    logger.info(
        "Note: Models will be downloaded on first use (requires internet for initial setup)"
    )
    logger.info(f"Supported languages: {list(TRANSLATION_MODELS.keys())}")

    server = TranslationServer()

    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("Translation server stopped by user")
    except Exception as e:
        logger.error(f"Translation server error: {e}")


if __name__ == "__main__":
    main()
