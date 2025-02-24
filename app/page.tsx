"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { marked } from "marked";
import LoadingBar, { LoadingBarRef } from "react-top-loading-bar";
import { FaTrash, FaSun, FaMoon, FaBars, FaTimes, FaPaperPlane } from "react-icons/fa";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type Session = {
  id: string;
  name: string;
  messages: Message[];
};

export default function Home() {
  const [topic, setTopic] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const loadingBarRef = useRef<LoadingBarRef>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem("chatSessions");
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setIsDarkTheme(savedTheme === "dark");
  }, []);

  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem("chatSessions", JSON.stringify(sessions));
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
  }, [sessions, isDarkTheme]);

  const getCurrentSession = () => sessions.find((s) => s.id === currentSessionId) || null;

  const handleSubmit = async () => {
    if (!topic) return;

    const timestamp = new Date().toLocaleString();
    const userMessage: Message = { role: "user", content: topic, timestamp };

    if (!currentSessionId) {
      const newSession: Session = {
        id: Date.now().toString(),
        name: topic.slice(0, 20) || "New Chat",
        messages: [userMessage],
      };
      setSessions((prev) => [...prev, newSession]);
      setCurrentSessionId(newSession.id);
    } else {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId ? { ...s, messages: [...s.messages, userMessage] } : s
        )
      );
    }

    setTopic("");
    setIsLoading(true);
    loadingBarRef.current?.continuousStart();

    try {
      const res = await axios.post("/api/chat", { topic });
      const aiResponse = res.data;
      const assistantMessage: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toLocaleString(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId ? { ...s, messages: [...s.messages, assistantMessage] } : s
        )
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("API Error:", errorMessage);
      const errorResponse: Message = {
        role: "assistant",
        content: "Sorry, something went wrong. Try again!",
        timestamp: new Date().toLocaleString(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId ? { ...s, messages: [...s.messages, errorResponse] } : s
        )
      );
    } finally {
      setIsLoading(false);
      loadingBarRef.current?.complete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const handleSessionClick = (id: string) => {
    setCurrentSessionId(id);
    setTopic("");
  };

  const toggleTheme = () => setIsDarkTheme(!isDarkTheme);

  return (
    <main
      className={`flex min-h-screen ${
        isDarkTheme
          ? "bg-gradient-to-br from-purple-600 to-blue-800 text-white"
          : "bg-gradient-to-br from-gray-100 to-blue-100 text-gray-900"
      }`}
    >
      <LoadingBar color={isDarkTheme ? "#93c5fd" : "#2563eb"} ref={loadingBarRef} />

      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? "w-64" : "w-16"
        } p-4 flex flex-col transition-all duration-300 lg:w-64 md:w-20 sm:w-16 border-r ${
          isDarkTheme ? "border-purple-700" : "border-gray-300"
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          {isSidebarOpen && (
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Chat Sessions
            </h2>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-full hover:bg-purple-500 transition-colors"
            title={isSidebarOpen ? "Collapse" : "Expand"}
          >
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
        {isSidebarOpen && (
          <div className="flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handleSessionClick(session.id)}
                  className={`flex-1 p-2 text-left rounded-lg transition-colors ${
                    currentSessionId === session.id
                      ? "bg-blue-500"
                      : `${isDarkTheme ? "bg-purple-700" : "bg-gray-200"} hover:bg-blue-400`
                  }`}
                >
                  {session.name}
                </button>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="ml-2 p-2 text-red-400 hover:text-red-500 transition-colors"
                  title="Delete Session"
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              ChatSphere
            </span>
            <span role="img" aria-label="logo">
              🌌
            </span>
          </h1>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-purple-400 transition-colors"
            title={isDarkTheme ? "Switch to Light" : "Switch to Dark"}
          >
            {isDarkTheme ? <FaSun /> : <FaMoon />}
          </button>
        </div>

        {/* Chat History */}
        <div
          className={`flex-1 mb-6 p-4 rounded-xl shadow-lg overflow-y-auto ${
            isDarkTheme ? "bg-gray-900/90" : "bg-white/90"
          }`}
        >
          {getCurrentSession()?.messages && getCurrentSession()!.messages.length > 0 ? (
            getCurrentSession()!.messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 p-4 rounded-lg shadow-sm ${
                  msg.role === "user"
                    ? "bg-blue-500/80 ml-auto max-w-md"
                    : `${isDarkTheme ? "bg-purple-700/80" : "bg-gray-200/80"} max-w-md`
                }`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold">{msg.role === "user" ? "You" : "AI"}</span>
                  <span
                    className={`text-xs ${
                      isDarkTheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
                <div
                  className={`prose prose-sm max-w-none ${
                    isDarkTheme ? "prose-invert" : "prose-gray"
                  }`}
                  dangerouslySetInnerHTML={{ __html: marked(msg.content) }}
                />
              </div>
            ))
          ) : (
            <p
              className={`italic text-center ${
                isDarkTheme ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Start a conversation!
            </p>
          )}
        </div>

        {/* Combined Input/Button */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className="relative w-full max-w-2xl pointer-events-auto">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a topic..."
              className={`w-full p-4 pr-12 rounded-xl shadow-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all ${
                isDarkTheme
                  ? "bg-gray-800/90 text-white border-gray-700 placeholder-gray-400"
                  : "bg-white/90 text-gray-900 border-gray-200 placeholder-gray-500"
              } min-h-[60px] h-auto`}
              rows={1}
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={`absolute right-3 bottom-3 p-2 rounded-full transition-all ${
                isDarkTheme
                  ? "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:bg-gray-600"
                  : "bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-500 hover:to-purple-500 disabled:bg-gray-400"
              }`}
              title="Send Message"
            >
              <FaPaperPlane
                className={`${isDarkTheme ? "text-white" : "text-white"}`}
              />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="fixed bottom-20 left-0 right-0 text-center text-sm text-gray-400">
            Fetching…
          </div>
        )}
      </div>
    </main>
  );
}