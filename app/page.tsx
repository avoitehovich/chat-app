"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { marked } from "marked";
import { PacmanLoader } from "react-spinners";
import { FaArrowRight, FaTrash, FaSun, FaMoon, FaBars, FaTimes } from "react-icons/fa";

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

  // Load sessions and theme from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem("chatSessions");
    if (savedSessions) setSessions(JSON.parse(savedSessions));

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setIsDarkTheme(savedTheme === "dark");
  }, []);

  // Save sessions and theme to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("chatSessions", JSON.stringify(sessions));
    }
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
  }, [sessions, isDarkTheme]);

  const getCurrentSession = () =>
    sessions.find((s) => s.id === currentSessionId) || null;

  const handleSubmit = async () => {
    if (!topic) return;

    const timestamp = new Date().toLocaleTimeString();
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
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, userMessage] }
            : s
        )
      );
    }

    setTopic("");
    setIsLoading(true);

    try {
      const res = await axios.post(
        "https://api.edenai.run/v2/text/chat",
        {
          providers: "openai",
          text: `Tell me the most relevant content about ${topic}`,
          chatbot_global_action: "Act as a helpful assistant",
          temperature: 0.7,
          max_tokens: 200,
        },
        {
          headers: {
            Authorization: process.env.NEXT_PUBLIC_EDEN_AI_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      const aiResponse = res.data.openai.generated_text;
      const assistantMessage: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toLocaleTimeString(),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, assistantMessage] }
            : s
        )
      );
    } catch (error) {
      console.error("Error fetching response:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, something went wrong. Try again!",
        timestamp: new Date().toLocaleTimeString(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, errorMessage] }
            : s
        )
      );
    } finally {
      setIsLoading(false);
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
          ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white"
          : "bg-gradient-to-br from-gray-100 to-white text-gray-900"
      }`}
    >
      {/* Sidebar with Sessions */}
      <div
        className={`${
          isSidebarOpen ? "w-1/4" : "w-16"
        } p-4 border-r border-gray-700 transition-all duration-300 flex flex-col`}
      >
        <div className="flex justify-between items-center mb-4">
          {isSidebarOpen && <h2 className="text-xl font-bold">Chat Sessions</h2>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-xl"
          >
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
        {isSidebarOpen && (
          <>
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between mb-2"
                >
                  <div
                    onClick={() => handleSessionClick(session.id)}
                    className={`flex-1 p-3 rounded-lg cursor-pointer transition-colors ${
                      currentSessionId === session.id
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {session.name}
                  </div>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="ml-2 text-red-400 hover:text-red-500"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-gray-400">No sessions yet.</p>
            )}
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-extrabold text-blue-400">Chat App</h1>
          <button onClick={toggleTheme} className="text-2xl">
            {isDarkTheme ? <FaSun /> : <FaMoon />}
          </button>
        </div>

        {/* Chat History */}
        <div
          className={`flex-1 mb-6 p-4 rounded-lg shadow-lg overflow-y-auto ${
            isDarkTheme ? "bg-gray-900" : "bg-white"
          }`}
        >
          {getCurrentSession()?.messages?.length ?? 0 > 0 ? (
            getCurrentSession()!.messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-500 ml-auto max-w-md"
                    : `${isDarkTheme ? "bg-gray-700" : "bg-gray-200"} max-w-md`
                }`}
              >
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">
                    {msg.role === "user" ? "You" : "AI"}
                  </span>
                  <span
                    className={`text-xs ${
                      isDarkTheme ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
                <div
                  className={`prose prose-sm max-w-none mt-1 ${
                    isDarkTheme ? "prose-invert" : ""
                  }`}
                  dangerouslySetInnerHTML={{ __html: marked(msg.content) }}
                />
              </div>
            ))
          ) : (
            <p
              className={`italic ${
                isDarkTheme ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Start a new chat!
            </p>
          )}
        </div>

        {/* Centered Input Area */}
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <div className="relative w-full max-w-2xl">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a topic (e.g., space exploration)"
              className={`w-full p-4 pr-12 border rounded-lg shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isDarkTheme
                  ? "bg-gray-800 text-white border-gray-600 placeholder-gray-400"
                  : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
              } min-h-[80px] h-auto`}
              rows={3}
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={`absolute bottom-3 right-3 p-2 rounded-md transition-colors ${
                isDarkTheme
                  ? "bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500"
                  : "bg-blue-400 hover:bg-blue-500 disabled:bg-gray-300"
              }`}
            >
              <FaArrowRight className="text-white" />
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex justify-center mt-4 absolute bottom-20 inset-x-0">
            <PacmanLoader color={isDarkTheme ? "#60a5fa" : "#2563eb"} size={25} />
          </div>
        )}
      </div>
    </main>
  );
}