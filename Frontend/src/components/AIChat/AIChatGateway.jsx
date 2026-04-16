import React, { useEffect, useRef, useState } from "react";
import { sendMemberChat } from "../../api/memberService";
import "./AIChat.css";

const AIChatGateway = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Chao ban! Toi la tro ly AI. Ban can tra cuu thong tin gia pha, thanh vien, bang tin hay su kien?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, loading]);

  if (!user) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const prompt = input.trim();
    setMessages((prev) => [...prev, { sender: "user", text: prompt }]);
    setInput("");
    setLoading(true);

    try {
      const result = await sendMemberChat(prompt);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: result.ai_message || result.answer || result.message || "Xin loi, toi khong the phan tich cau hoi luc nay.",
        },
      ]);
    } catch (err) {
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
      <button className="ai-chat-btn" onClick={() => setIsOpen(!isOpen)} title="Chat voi AI">
        AI
      </button>
    </div>
  );
};

export default AIChatGateway;
