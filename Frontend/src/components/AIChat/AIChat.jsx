import React, { useState, useRef, useEffect } from 'react';
import './AIChat.css';

const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('rag'); // 'rag' | 'db'
  const [messages, setMessages] = useState([{ sender: 'bot', text: 'Chào bạn! Tôi là trợ lý AI. Bạn cần tra cứu thông tin gia phả phân tích hay truy vấn dữ liệu?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  // Chỉ hiển thị Chat Widget nếu user đã đăng nhập
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, loading]);

  if (!user) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const endpoint = mode === 'rag' ? '/ai/rag/chat' : '/ai/db/chat';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: String(user.id), question: userMsg })
      });
      const data = await res.json();
      
      let botResponse = "Xin lỗi, tôi không thể phân tích câu hỏi lúc này.";
      if (res.ok && data.success) {
        // AI result parsing based on standard format
        if (typeof data.data === 'string') {
          botResponse = data.data;
        } else if (data.data && typeof data.data === 'object') {
           botResponse = data.data.text || data.data.answer || data.data.message || JSON.stringify(data.data);
        }
      } else {
         botResponse = data.message || botResponse;
      }
      setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Lỗi máy chủ AI: Thu thập dữ liệu thất bại.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-chat-widget">
      {isOpen && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">Trợ lý Gia phả AI</div>
          <div className="ai-chat-tabs">
            <div className={`ai-tab ${mode === 'rag' ? 'active' : ''}`} onClick={() => setMode('rag')}>Hỏi Đáp Dữ Liệu</div>
            <div className={`ai-tab ${mode === 'db' ? 'active' : ''}`} onClick={() => setMode('db')}>Truy vấn MySQL</div>
          </div>
          <div className="ai-chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-message ${m.sender === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="ai-message ai-msg-bot">Đang suy nghĩ...</div>}
            <div ref={endRef} />
          </div>
          <form className="ai-chat-input" onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder={mode === 'rag' ? "Hỏi về lịch sử..." : "Nhập câu lệnh/ý định DB..."}
              value={input} 
              onChange={e => setInput(e.target.value)} 
              disabled={loading} 
            />
            <button type="submit" disabled={loading}>Gửi</button>
          </form>
        </div>
      )}
      <button className="ai-chat-btn" onClick={() => setIsOpen(!isOpen)} title="Chat với AI">
        ✨
      </button>
    </div>
  );
};

export default AIChat;
