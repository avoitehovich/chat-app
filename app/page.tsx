"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import axios, { AxiosError } from "axios";
import { marked } from "marked";
import LoadingBar, { LoadingBarRef } from "react-top-loading-bar";
import { FaTrash, FaSun, FaMoon, FaBars, FaTimes, FaPaperPlane, FaEdit, FaThumbtack } from "react-icons/fa";
import EmojiPicker from "emoji-picker-react";
import { Theme } from "emoji-picker-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isPinned?: boolean;
  reactions?: { [emoji: string]: number }; // Track reactions per message
  lastEdited?: string; // Track last edit timestamp
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
  const [isMonochrome, setIsMonochrome] = useState(false);
  const [isNavbarOpen, setIsNavbarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // For session search
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ msgIndex: number; x: number; y: number } | null>(null);
  const [visibleMessages, setVisibleMessages] = useState(10); // For lazy loading
  const loadingBarRef = useRef<LoadingBarRef>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem("chatSessions");
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setIsDarkTheme(savedTheme === "dark");
    const savedMonochrome = localStorage.getItem("monochrome");
    if (savedMonochrome) setIsMonochrome(savedMonochrome === "true");
  }, []);

  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem("chatSessions", JSON.stringify(sessions));
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
    localStorage.setItem("monochrome", isMonochrome.toString());
  }, [sessions, isDarkTheme, isMonochrome]);

  const getCurrentSession = () => sessions.find((s) => s.id === currentSessionId) || null;

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) =>
      session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.messages.some((msg) =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [sessions, searchQuery]);

  const handleSubmit = async () => {
    if (!topic) return;

    const timestamp = new Date().toLocaleString();
    const userMessage: Message = { role: "user", content: topic, timestamp, isPinned: false, reactions: {} };

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
        isPinned: false,
        reactions: {},
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, assistantMessage] }
            : s
        )
      );
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error("API Error:", axiosError.response?.data || axiosError.message);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, something went wrong. Try again!",
        timestamp: new Date().toLocaleString(),
        isPinned: false,
        reactions: {},
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s
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
    setIsNavbarOpen(false);
  };

  const toggleTheme = () => setIsDarkTheme(!isDarkTheme);
  const toggleMonochrome = () => setIsMonochrome(!isMonochrome);

  const togglePinMessage = (messageIndex: number) => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: s.messages.map((msg, idx) =>
                idx === messageIndex ? { ...msg, isPinned: !msg.isPinned } : msg
              ).sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)),
            }
          : s
      )
    );
  };

  const handleEditMessage = (messageIndex: number, content: string) => {
    if (!currentSessionId) return;
    const now = new Date();
    const messageTime = new Date(getCurrentSession()!.messages[messageIndex].timestamp);
    const timeDiff = (now.getTime() - messageTime.getTime()) / 60000; // Minutes

    if (timeDiff > 5) {
      alert("Cannot edit messages older than 5 minutes.");
      return;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: s.messages.map((msg, idx) =>
                idx === messageIndex
                  ? { ...msg, content, lastEdited: now.toLocaleString() }
                  : msg
              ),
            }
          : s
      )
    );
    setEditingMessageIndex(null);
    setEditContent("");
  };

  const addReaction = (messageIndex: number, emoji: string) => {
    if (!currentSessionId) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: s.messages.map((msg, idx) =>
                idx === messageIndex
                  ? {
                      ...msg,
                      reactions: {
                        ...(msg.reactions || {}),
                        [emoji]: (msg.reactions?.[emoji] || 0) + 1,
                      },
                    }
                  : msg
              ),
            }
          : s
      )
    );
    setShowEmojiPicker(null);
  };

  const loadMoreMessages = () => {
    setVisibleMessages((prev) => Math.min(prev + 10, getCurrentSession()?.messages.length || 10));
  };

  return (
    <main
      className={`flex min-h-screen ${
        isMonochrome
          ? isDarkTheme
            ? "bg-gradient-to-br from-gray-800 to-gray-900 text-gray-100"
            : "bg-gradient-to-br from-gray-200 to-gray-100 text-gray-900"
          : isDarkTheme
          ? "bg-gradient-to-br from-purple-600 to-blue-800 text-white"
          : "bg-gradient-to-br from-gray-100 to-blue-100 text-gray-900"
      }`}
    >
      <LoadingBar
        color={
          isMonochrome
            ? isDarkTheme
              ? "#a3a3a3"
              : "#4a5568"
            : isDarkTheme
            ? "#93c5fd"
            : "#2563eb"
        }
        ref={loadingBarRef}
      />

      {/* Left Sidebar (md and up) */}
      <div
        className={`hidden md:flex md:w-64 flex-col p-4 border-r ${
          isMonochrome
            ? isDarkTheme
              ? "border-gray-700"
              : "border-gray-300"
            : isDarkTheme
            ? "border-purple-700"
            : "border-gray-300"
        } bg-opacity-95 ${
          isMonochrome
            ? isDarkTheme
              ? "bg-gray-900"
              : "bg-gray-100"
            : isDarkTheme
            ? "bg-gray-900"
            : "bg-white"
        }`}
      >
        <h2
          className={`text-xl font-bold mb-4 ${
            isMonochrome
              ? isDarkTheme
                ? "text-gray-300"
                : "text-gray-800 bg-clip-text"
              : "bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          }`}
        >
          Chat Sessions
        </h2>
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className={`w-full p-2 rounded-lg border ${
              isMonochrome
                ? isDarkTheme
                  ? "bg-gray-800 text-gray-100 border-gray-600"
                  : "bg-gray-200 text-gray-900 border-gray-300"
                : isDarkTheme
                ? "bg-gray-800 text-white border-gray-700"
                : "bg-white text-gray-900 border-gray-200"
            } focus:outline-none focus:ring-2 focus:ring-purple-400`}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between mb-3">
                <button
                  onClick={() => handleSessionClick(session.id)}
                  className={`flex-1 p-2 text-left rounded-lg transition-colors ${
                    currentSessionId === session.id
                      ? "bg-blue-500"
                      : isMonochrome
                      ? isDarkTheme
                        ? "bg-gray-700 hover:bg-gray-600"
                        : "bg-gray-200 hover:bg-gray-300"
                      : isDarkTheme
                      ? "bg-purple-700 hover:bg-purple-600"
                      : "bg-gray-200 hover:bg-blue-400"
                  }`}
                >
                  {session.name}
                </button>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className={`ml-2 p-2 ${
                    isMonochrome
                      ? isDarkTheme
                        ? "text-gray-400 hover:text-gray-300"
                        : "text-gray-600 hover:text-gray-700"
                      : "text-red-400 hover:text-red-500"
                  } transition-colors`}
                  title="Delete Session"
                >
                  <FaTrash />
                </button>
              </div>
            ))
          ) : (
            <p
              className={`italic ${
                isMonochrome
                  ? isDarkTheme
                    ? "text-gray-400"
                    : "text-gray-500"
                  : isDarkTheme
                  ? "text-gray-400"
                  : "text-gray-500"
              }`}
            >
              No matching sessions
            </p>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar (Mobile Only) */}
        <nav
          className={`fixed top-0 left-0 right-0 z-10 p-4 shadow-xl ${
            isMonochrome
              ? isDarkTheme
                ? "bg-gradient-to-r from-gray-800 to-gray-900"
                : "bg-gradient-to-r from-gray-200 to-gray-100"
              : isDarkTheme
              ? "bg-gradient-to-r from-gray-900 to-purple-800"
              : "bg-gradient-to-r from-white to-blue-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <span
                className={`${
                  isMonochrome
                    ? isDarkTheme
                      ? "text-gray-200"
                      : "text-gray-800"
                    : "bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
                }`}
              >
                ChatSphere
              </span>
              <span role="img" aria-label="logo">
                🌌
              </span>
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-purple-400 transition-colors"
                title={isDarkTheme ? "Switch to Light" : "Switch to Dark"}
              >
                {isDarkTheme ? <FaSun /> : <FaMoon />}
              </button>
              <button
                onClick={toggleMonochrome}
                className="p-2 rounded-full hover:bg-purple-400 transition-colors"
                title={isMonochrome ? "Switch to Gradient" : "Switch to Monochrome"}
              >
                {isMonochrome ? <FaSun className="rotate-180" /> : <FaMoon />}
              </button>
              <button
                onClick={() => setIsNavbarOpen(!isNavbarOpen)}
                className="p-2 rounded-full hover:bg-purple-500 transition-colors md:hidden"
                title={isNavbarOpen ? "Collapse" : "Expand Sessions"}
              >
                {isNavbarOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>
          </div>
          <div className="mt-4 md:hidden overflow-y-auto">
            <div
              className={`${
                isNavbarOpen
                  ? "max-h-60 animate-slideDown"
                  : "max-h-0 animate-slideUp overflow-hidden"
              }`}
            >
              <h2
                className={`text-lg font-semibold mb-2 ${
                  isMonochrome
                    ? isDarkTheme
                      ? "text-gray-300"
                      : "text-gray-700"
                    : isDarkTheme
                    ? "text-gray-300"
                    : "text-gray-700"
                }`}
              >
                Chat Sessions
              </h2>
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sessions..."
                  className={`w-full p-2 rounded-lg border ${
                    isMonochrome
                      ? isDarkTheme
                        ? "bg-gray-800 text-gray-100 border-gray-600"
                        : "bg-gray-200 text-gray-900 border-gray-300"
                      : isDarkTheme
                      ? "bg-gray-800 text-white border-gray-700"
                      : "bg-white text-gray-900 border-gray-200"
                  } focus:outline-none focus:ring-2 focus:ring-purple-400`}
                />
              </div>
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => handleSessionClick(session.id)}
                      className={`flex-1 p-2 text-left rounded-lg transition-colors ${
                        currentSessionId === session.id
                          ? "bg-blue-500"
                          : isMonochrome
                          ? isDarkTheme
                            ? "bg-gray-700 hover:bg-gray-600"
                            : "bg-gray-200 hover:bg-gray-300"
                          : isDarkTheme
                          ? "bg-purple-700 hover:bg-purple-600"
                          : "bg-gray-200 hover:bg-blue-400"
                      }`}
                    >
                      {session.name}
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className={`ml-2 p-2 ${
                        isMonochrome
                          ? isDarkTheme
                            ? "text-gray-400 hover:text-gray-300"
                            : "text-gray-600 hover:text-gray-700"
                          : "text-red-400 hover:text-red-500"
                      } transition-colors`}
                      title="Delete Session"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))
              ) : (
                <p
                  className={`italic ${
                    isMonochrome
                      ? isDarkTheme
                        ? "text-gray-400"
                        : "text-gray-500"
                      : isDarkTheme
                      ? "text-gray-400"
                      : "text-gray-500"
                  }`}
                >
                  No matching sessions
                </p>
              )}
            </div>
          </div>
        </nav>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col p-6 pt-24 md:pt-16">
          <div
            className={`flex-1 mb-20 p-6 rounded-xl shadow-lg overflow-y-auto`}
            style={{
              backgroundColor: isMonochrome
                ? isDarkTheme
                  ? "rgba(31, 41, 55, 0.7)"
                  : "rgba(243, 244, 246, 0.7)"
                : isDarkTheme
                ? "rgba(17, 24, 39, 0.7)"
                : "rgba(255, 255, 255, 0.7)",
            }}
          >
            {(() => {
              const currentSession = getCurrentSession();
              return currentSession?.messages && currentSession.messages.length > 0 ? (
                currentSession.messages
                  .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
                  .slice(0, visibleMessages)
                  .map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-6 p-4 rounded-2xl shadow-xl transition-all max-w-2xl w-full mx-auto hover:shadow-lg hover:scale-102 ${
                        msg.role === "user" ? "ml-auto" : "mr-auto"
                      }`}
                    >
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="font-semibold text-base">
                          {msg.role === "user" ? "You" : "AI"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs italic ${
                              isMonochrome
                                ? isDarkTheme
                                  ? "text-gray-300"
                                  : "text-gray-600"
                                : isDarkTheme
                                ? "text-gray-300"
                                : "text-gray-600"
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                          {msg.role === "user" && (
                            <button
                              onClick={() => {
                                setEditingMessageIndex(index);
                                setEditContent(msg.content);
                              }}
                              className={`p-1 rounded-full transition-colors ${
                                isMonochrome
                                  ? isDarkTheme
                                    ? "text-gray-400 hover:text-gray-300"
                                    : "text-gray-600 hover:text-gray-700"
                                  : isDarkTheme
                                  ? "text-gray-400 hover:text-gray-300"
                                  : "text-gray-600 hover:text-gray-700"
                              }`}
                              title="Edit Message"
                            >
                              <FaEdit />
                            </button>
                          )}
                          <button
                            onClick={() => togglePinMessage(index)}
                            className={`p-1 rounded-full transition-colors ${
                              msg.isPinned
                                ? isMonochrome
                                  ? isDarkTheme
                                    ? "bg-gray-500 text-gray-100"
                                    : "bg-gray-300 text-gray-800"
                                  : isDarkTheme
                                  ? "bg-blue-500 text-white"
                                  : "bg-blue-300 text-gray-900"
                                : isMonochrome
                                ? isDarkTheme
                                  ? "text-gray-400 hover:text-gray-300"
                                  : "text-gray-600 hover:text-gray-700"
                                : isDarkTheme
                                ? "text-gray-400 hover:text-gray-300"
                                : "text-gray-600 hover:text-gray-700"
                            }`}
                            title={msg.isPinned ? "Unpin Message" : "Pin Message"}
                          >
                            <FaThumbtack />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setShowEmojiPicker({
                                msgIndex: index,
                                x: e.currentTarget.getBoundingClientRect().right,
                                y: e.currentTarget.getBoundingClientRect().top,
                              });
                            }}
                            className={`p-1 rounded-full transition-colors ${
                              isMonochrome
                                ? isDarkTheme
                                  ? "text-gray-400 hover:text-gray-300"
                                  : "text-gray-600 hover:text-gray-700"
                                : isDarkTheme
                                ? "text-gray-400 hover:text-gray-300"
                                : "text-gray-600 hover:text-gray-700"
                            }`}
                            title="Add Reaction"
                          >
                            😊
                          </button>
                          {msg.reactions && Object.entries(msg.reactions).length > 0 && (
                            <span
                              className={`text-xs ${
                                isMonochrome
                                  ? isDarkTheme
                                    ? "text-gray-300"
                                    : "text-gray-600"
                                  : isDarkTheme
                                  ? "text-gray-300"
                                  : "text-gray-600"
                              }`}
                            >
                              {Object.entries(msg.reactions)
                                .map(([emoji, count]) => `${emoji} ${count}`)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      {editingMessageIndex === index ? (
                        <div className="flex gap-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className={`w-full p-2 rounded-lg border ${
                              isMonochrome
                                ? isDarkTheme
                                  ? "bg-gray-800 text-gray-100 border-gray-600"
                                  : "bg-gray-200 text-gray-900 border-gray-300"
                                : isDarkTheme
                                ? "bg-gray-800 text-white border-gray-700"
                                : "bg-white text-gray-900 border-gray-200"
                            } focus:outline-none focus:ring-2 focus:ring-purple-400`}
                            rows={1}
                            style={{ height: "auto" }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = "auto";
                              target.style.height = `${Math.min(target.scrollHeight, 80)}px`;
                            }}
                          />
                          <button
                            onClick={() => handleEditMessage(index, editContent)}
                            className={`p-2 rounded-lg transition-colors ${
                              isMonochrome
                                ? isDarkTheme
                                  ? "bg-gray-600 text-gray-100 hover:bg-gray-700"
                                  : "bg-gray-400 text-gray-900 hover:bg-gray-500"
                                : isDarkTheme
                                ? "bg-purple-600 text-white hover:bg-purple-700"
                                : "bg-blue-400 text-white hover:bg-blue-500"
                            }`}
                            title="Save Edit"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessageIndex(null);
                              setEditContent("");
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              isMonochrome
                                ? isDarkTheme
                                  ? "bg-gray-700 text-gray-100 hover:bg-gray-800"
                                  : "bg-gray-500 text-gray-900 hover:bg-gray-600"
                                : isDarkTheme
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "bg-red-400 text-white hover:bg-red-500"
                            }`}
                            title="Cancel Edit"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`prose prose-md max-w-none ${
                            isMonochrome
                              ? isDarkTheme
                                ? "prose-invert text-gray-100"
                                : "prose-gray text-gray-800"
                              : isDarkTheme
                              ? "prose-invert text-gray-100"
                              : "prose-gray text-gray-800"
                          } leading-relaxed`}
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            ["--tw-prose-headings" as string]: isMonochrome
                              ? isDarkTheme
                                ? "#ffffff"
                                : "#111827"
                              : isDarkTheme
                              ? "#ffffff"
                              : "#111827",
                            "--tw-prose-bold": isMonochrome
                              ? isDarkTheme
                                ? "#f3f4f6"
                                : "#111827"
                              : isDarkTheme
                              ? "#f3f4f6"
                              : "#111827",
                            "--tw-prose-links": isMonochrome
                              ? isDarkTheme
                                ? "#a3a3a3"
                                : "#4a5568"
                              : isDarkTheme
                              ? "#93c5fd"
                              : "#2563eb",
                            "--tw-prose-lists": isMonochrome
                              ? isDarkTheme
                                ? "#d1d5db"
                                : "#4a5568"
                              : isDarkTheme
                              ? "#d1d5db"
                              : "#4a5568",
                            "--tw-prose-body": isMonochrome
                              ? isDarkTheme
                                ? "#e5e7eb"
                                : "#1f2937"
                              : isDarkTheme
                              ? "#e5e7eb"
                              : "#1f2937",
                            padding: "1rem",
                            lineHeight: "1.75",
                          } as React.CSSProperties}
                          dangerouslySetInnerHTML={{ __html: marked(msg.content) }}
                        />
                      )}
                    </div>
                  ))
              ) : (
                <p className="italic text-center">Start a conversation!</p>
              );
            })()}
            {(() => {
              const currentSession = getCurrentSession();
              return currentSession?.messages && currentSession.messages.length > visibleMessages ? (
                <button
                  onClick={loadMoreMessages}
                  className={`mt-4 p-2 rounded-lg transition-colors ${
                    isMonochrome
                      ? isDarkTheme
                        ? "bg-gray-700 text-gray-100 hover:bg-gray-600"
                        : "bg-gray-300 text-gray-900 hover:bg-gray-400"
                      : isDarkTheme
                      ? "bg-purple-700 text-white hover:bg-purple-600"
                      : "bg-blue-200 text-gray-900 hover:bg-blue-300"
                  }`}
                  title="Load More Messages"
                >
                  Load More
                </button>
              ) : null;
            })()}
          </div>

          {/* Input Area */}
          <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
            <div className="relative w-full max-w-2xl sm:max-w-md md:max-w-2xl pointer-events-auto">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a topic..."
                className={`w-full p-4 pr-12 rounded-xl shadow-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all ${
                  isMonochrome
                    ? isDarkTheme
                      ? "bg-gray-800/90 text-gray-100 border-gray-700 placeholder-gray-400"
                      : "bg-gray-200/90 text-gray-900 border-gray-300 placeholder-gray-500"
                    : isDarkTheme
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
                  isMonochrome
                    ? isDarkTheme
                      ? "bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:bg-gray-600"
                      : "bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 disabled:bg-gray-400"
                    : isDarkTheme
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:bg-gray-600"
                    : "bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-500 hover:to-purple-500 disabled:bg-gray-400"
                }`}
                title="Send Message"
              >
                <FaPaperPlane
                  className={`${
                    isMonochrome
                      ? isDarkTheme
                        ? "text-gray-100"
                        : "text-gray-900"
                      : isDarkTheme
                      ? "text-white"
                      : "text-white"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Typing Indicator */}
          {isLoading && (
            <div
              className={`fixed bottom-20 left-0 right-0 text-center text-sm ${
                isMonochrome
                  ? isDarkTheme
                    ? "text-gray-400"
                    : "text-gray-500"
                  : isDarkTheme
                  ? "text-gray-400"
                  : "text-gray-500"
              }`}
            >
              Typing…
            </div>
          )}

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div
              className="fixed"
              style={{ top: showEmojiPicker.y, left: showEmojiPicker.x }}
            >
              <EmojiPicker
                onEmojiClick={(emojiData) => addReaction(showEmojiPicker.msgIndex, emojiData.emoji)}
                theme={isDarkTheme ? Theme.DARK : Theme.LIGHT}
                width={300}
                height={400}
              />
            </div>
          )}
        </div>
      </div>

      {/* CSS for Hamburger Animation */}
      <style jsx global>{`
        @keyframes slideDown {
          from {
            max-height: 0;
            opacity: 0;
          }
          to {
            max-height: 15rem;
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            max-height: 15rem;
            opacity: 1;
          }
          to {
            max-height: 0;
            opacity: 0;
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-in forwards;
        }
      `}</style>
    </main>
  );
}