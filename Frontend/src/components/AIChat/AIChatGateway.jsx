import React, { useEffect, useRef, useState } from "react";
import { getMemberChat, sendMemberChat } from "../../api/memberService";
import { sendPublicAiChat } from "../../api/aiServerService";
import { getStoredUser } from "../../utils/auth";
import "./AIChat.css";

const initialMessages = [
  {
    sender: "bot",
    text: "Chao ban! Toi la tro ly AI. Ban can tra cuu thong tin gia pha, thanh vien, bang tin hay su kien?",
  },
];

const AIChatGateway = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const user = getStoredUser();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, loading]);

  useEffect(() => {
    if (!user?.id) return;

    let alive = true;
    getMemberChat()
      .then((result) => {
        if (!alive) return;
        const history = (result.messages || []).map((message) => ({
          sender: message.sender_type === "user" ? "user" : "bot",
          text: message.content,
        }));
        setMessages(history.length > 0 ? history : initialMessages);
      })
      .catch(() => {
        if (alive) setMessages(initialMessages);
      });

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const prompt = input.trim();
    setMessages((prev) => [...prev, { sender: "user", text: prompt }]);
    setInput("");
    setLoading(true);

    try {
      const result = user ? await sendMemberChat(prompt) : await sendPublicAiChat(prompt);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: result.ai_message || result.answer || result.message || "Xin loi, toi khong the phan tich cau hoi luc nay.",
        },
      ]);
    } catch (err) {
      if (user && (err?.status === 401 || err?.status === 403)) {
        try {
          const result = await sendPublicAiChat(prompt);
          setMessages((prev) => [
            ...prev,
            {
              sender: "bot",
              text: result.ai_message || result.answer || "Phien dang nhap da het han. Toi dang tra loi o che do cong khai.",
            },
          ]);
          return;
        } catch {
          // Fall through to the normal error message.
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: err?.message ? `Loi AI: ${err.message}` : "Loi may chu AI: Thu thap du lieu that bai.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-chat-widget">
      {isOpen && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">Tro ly Gia Pha AI</div>
          <div className="ai-chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-message ${m.sender === "user" ? "ai-msg-user" : "ai-msg-bot"}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="ai-message ai-msg-bot">Dang suy nghi...</div>}
            <div ref={endRef} />
          </div>
          <form className="ai-chat-input" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Hoi ve thanh vien, gia pha, bang tin, su kien..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              Gui
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className="ai-chat-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Chat voi AI"
        aria-label="Chat voi AI"
      >
        AI
      </button>
    </div>
  );
};

export default AIChatGateway;
