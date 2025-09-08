"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Square,
  Download,
  Trash2,
  Globe,
  Volume2,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";

// Add declaration for webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface TranscriptionData {
  original: string;
  translated: string;
  confidence?: number;
  timestamp: string;
  type?:
    | "traveler_message"
    | "assistant_response"
    | "transcription_sent"
    | "response_sent";
  role?: "traveler" | "assistant";
}

interface ConnectionStatus {
  connected: boolean;
  recording: boolean;
  processing: boolean;
}

interface UserRole {
  type: "traveler" | "assistant";
  sessionId: string;
  travelerLanguage?: string;
}

const LANGUAGES = {
  es: { name: "Spanish", flag: "🇪🇸" },
  fr: { name: "French", flag: "🇫🇷" },
  de: { name: "German", flag: "🇩🇪" },
  it: { name: "Italian", flag: "🇮🇹" },
  pt: { name: "Portuguese", flag: "🇵🇹" },
  zh: { name: "Chinese", flag: "🇨🇳" },
  ja: { name: "Japanese", flag: "🇯🇵" },
  ko: { name: "Korean", flag: "🇰🇷" },
  ru: { name: "Russian", flag: "🇷🇺" },
  ar: { name: "Arabic", flag: "🇸🇦" },
  hi: { name: "Hindi", flag: "🇮🇳" },
  nl: { name: "Dutch", flag: "🇳🇱" },
  sv: { name: "Swedish", flag: "🇸🇪" },
  no: { name: "Norwegian", flag: "🇳🇴" },
  da: { name: "Danish", flag: "🇩🇰" },
  fi: { name: "Finnish", flag: "🇫🇮" },
};

export default function Home() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    recording: false,
    processing: false,
  });
  const [transcriptions, setTranscriptions] = useState<TranscriptionData[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("es");
  const [translationEnabled, setTranslationEnabled] = useState(true);
  const [volume, setVolume] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyzer, setAnalyzer] = useState<AnalyserNode | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>({
    type: "traveler",
    sessionId: "session-1",
    travelerLanguage: "es",
  });
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  const originalTextRef = useRef<HTMLDivElement>(null);
  const translatedTextRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const newSocket = new WebSocket("ws://localhost:8765");

      newSocket.onopen = () => {
        setConnectionStatus((prev) => ({ ...prev, connected: true }));
        console.log("Connected to WebSocket server");

        // Set initial role when connected
        const message = {
          type: "set_role",
          role: userRole.type,
          session_id: userRole.sessionId,
          language:
            userRole.type === "traveler" ? userRole.travelerLanguage : "en",
        };
        newSocket.send(JSON.stringify(message));
        console.log("🎭 Initial role set:", userRole);
      };

      newSocket.onclose = () => {
        setConnectionStatus((prev) => ({
          ...prev,
          connected: false,
          recording: false,
        }));
        console.log("Disconnected from WebSocket server");
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "traveler_message") {
            // Message from traveler to assistant
            const transcriptionData: TranscriptionData = {
              original: data.original || "",
              translated: data.translated || "",
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              type: "traveler_message",
              role: "traveler",
            };
            setTranscriptions((prev) => [...prev, transcriptionData]);
            setConnectionStatus((prev) => ({ ...prev, processing: false }));
          } else if (data.type === "assistant_response") {
            // Response from assistant to traveler
            const transcriptionData: TranscriptionData = {
              original: data.original || "",
              translated: data.translated || "",
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              type: "assistant_response",
              role: "assistant",
            };
            setTranscriptions((prev) => [...prev, transcriptionData]);
            setConnectionStatus((prev) => ({ ...prev, processing: false }));
          } else if (data.type === "transcription_sent") {
            // Confirmation that traveler's message was sent
            console.log(
              "Message sent to assistant:",
              data.translated_for_assistant
            );
            const transcriptionData: TranscriptionData = {
              original: data.original || "",
              translated: data.translated_for_assistant || "",
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              type: "transcription_sent",
              role: "traveler",
            };
            setTranscriptions((prev) => [...prev, transcriptionData]);
            setConnectionStatus((prev) => ({ ...prev, processing: false }));
          } else if (data.type === "response_sent") {
            // Confirmation that assistant's response was sent
            console.log(
              "Response sent to traveler:",
              data.translated_for_traveler
            );
            const transcriptionData: TranscriptionData = {
              original: data.original || "",
              translated: data.translated_for_traveler || "",
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
              type: "response_sent",
              role: "assistant",
            };
            setTranscriptions((prev) => [...prev, transcriptionData]);
            setConnectionStatus((prev) => ({ ...prev, processing: false }));
          } else if (data.type === "transcription") {
            // Legacy support
            const transcriptionData: TranscriptionData = {
              original: data.original || "",
              translated: data.translated || "",
              confidence: data.confidence,
              timestamp: new Date().toLocaleTimeString(),
            };
            setTranscriptions((prev) => [...prev, transcriptionData]);
            setConnectionStatus((prev) => ({ ...prev, processing: false }));
          } else if (data.type === "processing") {
            setConnectionStatus((prev) => ({ ...prev, processing: true }));
          } else if (data.type === "error") {
            console.error("Server error:", data.message);
            setConnectionStatus((prev) => ({ ...prev, processing: false }));
          }
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      newSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      setSocket(newSocket);
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          console.log("🔴 Speech recognition started");
          setConnectionStatus((prev) => ({ ...prev, recording: true }));
        };

        recognition.onresult = (event: any) => {
          console.log("🎤 Speech recognition result event:", event);
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(
              `📝 Transcript ${i}: "${transcript}" (final: ${event.results[i].isFinal})`
            );

            if (event.results[i].isFinal) {
              finalTranscript = transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Update current transcript with interim results
          if (interimTranscript) {
            setCurrentTranscript(interimTranscript);
          }

          // Handle final transcript
          if (finalTranscript) {
            setCurrentTranscript(""); // Clear interim transcript

            // Send to server for translation
            if (
              socket &&
              socket.readyState === WebSocket.OPEN &&
              finalTranscript.trim()
            ) {
              console.log(
                "📤 Sending transcription to server:",
                finalTranscript
              );
              const message = {
                type: "transcription",
                text: finalTranscript,
                language:
                  userRole.type === "traveler" ? selectedLanguage : "en",
                traveler_language:
                  userRole.travelerLanguage || selectedLanguage,
                translation_enabled: translationEnabled,
              };
              console.log("📦 Message payload:", message);
              socket.send(JSON.stringify(message));
            } else if (finalTranscript.trim()) {
              console.log("⚠️ Socket not ready, transcript:", finalTranscript);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
        };

        setRecognition(recognition);
      } else {
        console.error("Speech recognition not supported");
      }
    }
  }, [socket, selectedLanguage, translationEnabled]);

  // Audio visualization
  useEffect(() => {
    if (analyzer && connectionStatus.recording) {
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);

      const updateVolume = () => {
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(average);

        if (connectionStatus.recording) {
          requestAnimationFrame(updateVolume);
        }
      };

      updateVolume();
    }
  }, [analyzer, connectionStatus.recording]);

  // Auto-scroll to bottom when new transcriptions arrive
  useEffect(() => {
    if (originalTextRef.current) {
      originalTextRef.current.scrollTop = originalTextRef.current.scrollHeight;
    }
    if (translatedTextRef.current) {
      translatedTextRef.current.scrollTop =
        translatedTextRef.current.scrollHeight;
    }
  }, [transcriptions]);

  // Keyboard shortcut to switch roles (Tab key)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Tab" && !connectionStatus.recording) {
        event.preventDefault();
        const newRole = userRole.type === "traveler" ? "assistant" : "traveler";
        setupRole(newRole, userRole.sessionId, userRole.travelerLanguage);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [userRole, connectionStatus.recording]);

  const setupRole = (
    role: "traveler" | "assistant",
    sessionId: string,
    travelerLang?: string
  ) => {
    const newUserRole = {
      type: role,
      sessionId: sessionId,
      travelerLanguage: travelerLang || selectedLanguage,
    };

    setUserRole(newUserRole);
    setShowRoleSelector(false);

    if (role === "assistant") {
      setSelectedLanguage("en"); // Assistant speaks English
    } else {
      setSelectedLanguage(travelerLang || selectedLanguage);
    }

    // Send role update to server
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = {
        type: "set_role",
        role: role,
        session_id: sessionId,
        language: role === "traveler" ? travelerLang || selectedLanguage : "en",
      };
      socket.send(JSON.stringify(message));
      console.log("🎭 Role updated:", newUserRole);
    }
  };

  const startRecording = async () => {
    try {
      if (!recognition) {
        alert("Speech recognition not supported in this browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setMediaStream(stream);

      // Set up audio context for visualization
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyzerNode = context.createAnalyser();
      analyzerNode.fftSize = 256;
      source.connect(analyzerNode);

      setAudioContext(context);
      setAnalyzer(analyzerNode);

      // Start speech recognition
      recognition.start();
      setConnectionStatus((prev) => ({ ...prev, recording: true }));

      console.log("Started speech recognition");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (recognition) {
      recognition.stop();
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }

    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }

    setAnalyzer(null);
    setVolume(0);
    setCurrentTranscript(""); // Clear interim transcript
    setConnectionStatus((prev) => ({
      ...prev,
      recording: false,
      processing: false,
    }));

    console.log("Stopped speech recognition");
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
  };

  const downloadTranscription = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const content = `Real-Time Transcription - ${new Date().toLocaleString()}
${"=".repeat(60)}

ORIGINAL TEXT:
${"-".repeat(30)}
${transcriptions.map((t) => t.original).join(" ")}

TRANSLATED TEXT (${
      LANGUAGES[selectedLanguage as keyof typeof LANGUAGES]?.name
    }):
${"-".repeat(30)}
${transcriptions.map((t) => t.translated).join(" ")}

DETAILED LOG:
${"-".repeat(30)}
${transcriptions
  .map((t, i) => `[${t.timestamp}] ${t.original} → ${t.translated}`)
  .join("\n")}
`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getVolumeHeight = () => {
    return Math.min(volume * 2, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"></div>
          <div
            className="absolute top-3/4 right-1/4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"
            style={{ animationDelay: "1s" }}
          ></div>
          <div
            className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>
      </div>

      {/* Role Selection Modal */}
      <AnimatePresence>
        {showRoleSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full"
            >
              <h2 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                🌍 Translation Assistant
              </h2>
              <p className="text-slate-300 text-center mb-8">
                Choose your role in the conversation
              </p>

              <div className="space-y-4">
                <button
                  onClick={() =>
                    setupRole("traveler", "session-1", selectedLanguage)
                  }
                  className="w-full p-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105"
                >
                  <div className="text-2xl mb-2">🧳</div>
                  <div className="text-xl font-bold">I'm a Traveler</div>
                  <div className="text-sm opacity-90">
                    I need help communicating in a foreign country
                  </div>
                </button>

                <button
                  onClick={() => setupRole("assistant", "session-1")}
                  className="w-full p-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white font-medium transition-all duration-200 hover:scale-105"
                >
                  <div className="text-2xl mb-2">🤝</div>
                  <div className="text-xl font-bold">I'm a Local Assistant</div>
                  <div className="text-sm opacity-90">
                    I help travelers communicate
                  </div>
                </button>
              </div>

              {userRole.type === "traveler" && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Your Language:
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    {Object.entries(LANGUAGES).map(([code, { name, flag }]) => (
                      <option key={code} value={code}>
                        {flag} {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            {userRole.type === "traveler"
              ? "🧳 Traveler Assistant"
              : "🤝 Local Helper"}
          </h1>
          <p className="text-xl text-slate-300 mb-6">
            {userRole.type === "traveler"
              ? "Speak in your language, we'll translate for the local assistant"
              : "Help travelers by responding in English, we'll translate for them"}
          </p>

          {/* Quick Role Indicator */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                userRole.type === "traveler"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              }`}
            >
              {userRole.type === "traveler"
                ? "🧳 Traveler Mode"
                : "🤝 Assistant Mode"}
            </div>
            <div className="text-slate-400 text-sm">
              Session: {userRole.sessionId}
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full glass-effect ${
                connectionStatus.connected ? "text-green-400" : "text-red-400"
              }`}
            >
              {connectionStatus.connected ? (
                <Wifi size={16} />
              ) : (
                <WifiOff size={16} />
              )}
              <span className="text-sm font-medium">
                {connectionStatus.connected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {connectionStatus.processing && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-effect text-blue-400">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Processing...</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="glass-effect rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
              {/* Role Switcher */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  🎭 Role
                  <span className="text-xs text-slate-400 ml-2">
                    (Press Tab to switch)
                  </span>
                </label>
                <button
                  onClick={() => {
                    const newRole =
                      userRole.type === "traveler" ? "assistant" : "traveler";
                    setupRole(
                      newRole,
                      userRole.sessionId,
                      userRole.travelerLanguage
                    );
                  }}
                  disabled={connectionStatus.recording}
                  className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    userRole.type === "traveler"
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100`}
                >
                  <span className="text-lg">
                    {userRole.type === "traveler" ? "🧳" : "🤝"}
                  </span>
                  {userRole.type === "traveler" ? "Traveler" : "Assistant"}
                </button>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Globe className="inline w-4 h-4 mr-1" />
                  Translate to
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  disabled={connectionStatus.recording}
                >
                  {Object.entries(LANGUAGES).map(([code, lang]) => (
                    <option key={code} value={code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Translation Toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Translation
                </label>
                <button
                  onClick={() => setTranslationEnabled(!translationEnabled)}
                  disabled={connectionStatus.recording}
                  className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${
                    translationEnabled
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {translationEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              {/* Recording Controls */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  🎤{" "}
                  {userRole.type === "traveler"
                    ? "Traveler Mic"
                    : "Assistant Mic"}
                  {connectionStatus.recording && (
                    <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded-full animate-pulse">
                      LIVE
                    </span>
                  )}
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={
                      connectionStatus.recording
                        ? stopRecording
                        : startRecording
                    }
                    disabled={!connectionStatus.connected}
                    className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      connectionStatus.recording
                        ? "bg-red-600 hover:bg-red-700 text-white recording-pulse"
                        : userRole.type === "traveler"
                        ? "bg-blue-600 hover:bg-blue-700 text-white hover:scale-105"
                        : "bg-purple-600 hover:bg-purple-700 text-white hover:scale-105"
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    {connectionStatus.recording ? (
                      <>
                        <Square size={20} />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic size={20} />
                        {userRole.type === "traveler"
                          ? "🧳 Speak as Traveler"
                          : "🤝 Speak as Assistant"}
                      </>
                    )}
                  </button>

                  <button
                    onClick={clearTranscriptions}
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all hover:scale-105"
                    title="Clear all transcriptions"
                  >
                    <Trash2 size={20} />
                  </button>

                  <button
                    onClick={downloadTranscription}
                    disabled={transcriptions.length === 0}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    title="Download transcription"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audio Visualizer */}
          <AnimatePresence>
            {connectionStatus.recording && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-effect rounded-2xl p-6 mb-6"
              >
                <div className="flex items-center justify-center gap-4">
                  <Volume2 className="text-green-400" size={24} />
                  <div className="flex items-end gap-1 h-12 flex-1 max-w-md">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-gradient-to-t from-green-600 to-green-400 rounded-t-sm transition-all duration-100"
                        style={{
                          width: "100%",
                          height: `${Math.max(
                            getVolumeHeight() * (0.5 + Math.random() * 0.5),
                            5
                          )}%`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-green-400 font-mono text-sm">
                    {Math.round(volume)}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Transcription Areas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Conversation Display */}
          <div className="glass-effect rounded-2xl p-6 col-span-full">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              � Conversation
              {transcriptions.length > 0 && (
                <span className="text-sm text-slate-400 font-normal">
                  ({transcriptions.length} messages)
                </span>
              )}
            </h3>
            <div
              ref={originalTextRef}
              className="h-96 overflow-y-auto bg-slate-800/30 rounded-xl p-4 border border-slate-600"
            >
              <AnimatePresence>
                {transcriptions.map((transcription, index) => (
                  <motion.div
                    key={index}
                    initial={{
                      opacity: 0,
                      x: transcription.type === "traveler_message" ? -20 : 20,
                    }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`mb-3 p-3 rounded-lg border-l-4 ${
                      transcription.type === "traveler_message"
                        ? "bg-blue-700/30 border-blue-500 ml-0 mr-8"
                        : "bg-green-700/30 border-green-500 ml-8 mr-0"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {transcription.type === "traveler_message"
                          ? "🧳"
                          : "🤝"}
                      </span>
                      <span className="text-sm font-medium text-slate-300">
                        {transcription.type === "traveler_message"
                          ? "Traveler"
                          : "Local Assistant"}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {transcription.timestamp}
                      </span>
                    </div>

                    <div className="text-white font-medium mb-1">
                      "{transcription.original}"
                    </div>

                    {transcription.translated !== transcription.original && (
                      <div className="text-slate-300 text-sm italic border-t border-slate-600 pt-2 mt-2">
                        → "{transcription.translated}"
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Current transcript being spoken (interim results) */}
              {currentTranscript && connectionStatus.recording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`mb-3 p-3 rounded-lg border-l-4 border-dashed ${
                    userRole.type === "traveler"
                      ? "bg-blue-700/20 border-blue-400 ml-0 mr-8"
                      : "bg-green-700/20 border-green-400 ml-8 mr-0"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {userRole.type === "traveler" ? "🧳" : "🤝"}
                    </span>
                    <span className="text-sm font-medium text-slate-300">
                      {userRole.type === "traveler"
                        ? "Traveler"
                        : "Local Assistant"}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 bg-red-500 rounded-full"
                      />
                      Speaking...
                    </span>
                  </div>
                  <div className="text-white/70 font-medium italic">
                    "{currentTranscript}"
                  </div>
                </motion.div>
              )}

              {transcriptions.length === 0 && !currentTranscript && (
                <div className="text-slate-400 text-center py-8">
                  <div className="text-4xl mb-4">💬</div>
                  <p>No conversation yet.</p>
                  <p className="text-sm mt-2">
                    {userRole.type === "traveler"
                      ? "Start speaking in your language!"
                      : "Wait for a traveler to speak, then respond in English!"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8 text-slate-400"
        >
          <p className="text-sm">
            Powered by OpenAI Whisper & Google Translate • Real-time WebSocket
            connection
          </p>
        </motion.div>
      </div>
    </div>
  );
}
