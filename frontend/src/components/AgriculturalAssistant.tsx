import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Bot, User, MapPin, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import type { ChatMessage, GridCell } from '../types';
import { sendChatMessage } from '../services/assistantApi';

interface AgriculturalAssistantProps {
  analysisId: string | null;
  selectedCell: GridCell | null;
  onMapAction: (action: { type: string; cell_id: string; lat: number; lon: number }) => void;
}

export const AgriculturalAssistant: React.FC<AgriculturalAssistantProps> = ({ analysisId, selectedCell, onMapAction }) => {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'AI Assistant is temporarily disabled. Crop analysis is available.',
    timestamp: new Date().toISOString()
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const isDisabled = true; // explicitly disabled per instructions
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expanded]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isDisabled) return;
    
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setExpanded(true);
    
    try {
      const res = await sendChatMessage(text, analysisId || undefined, selectedCell?.cell_id, messages);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toISOString(),
        evidence: res.evidence,
        map_action: res.map_action
      };
      setMessages([...newMessages, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error communicating with the server. Please try again later.',
        timestamp: new Date().toISOString()
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Why is my crop stressed?",
    "Is the soil healthy?",
    "What should I check?",
    "Explain NDVI"
  ];

  return (
    <div className="card">
      <div className="card-header card-header-clickable" onClick={() => setExpanded(!expanded)}>
        <span className="card-title">
          <MessageCircle className="icon-sm" style={{ color: '#38bdf8' }} /> 
          AI Assistant
        </span>
        {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
      </div>
      
      {expanded && (
        <div className="card-body" style={{ padding: '0.4rem' }}>
          <div className="chat-container custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'} fade-in`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem', color: msg.role === 'user' ? '#bae6fd' : '#94a3b8', fontSize: '0.6rem' }}>
                    {msg.role === 'user' ? <User className="icon-xs" /> : <Bot className="icon-xs" />}
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </div>
                  {msg.content}
                  
                  {msg.evidence && msg.evidence.length > 0 && (
                    <div style={{ marginTop: '0.4rem' }}>
                      {msg.evidence.map((ev, i) => (
                        <span key={i} className="evidence-tag">{ev}</span>
                      ))}
                    </div>
                  )}
                  
                  {msg.map_action && (
                    <div>
                      <button 
                        className="map-action-btn"
                        onClick={() => onMapAction(msg.map_action!)}
                      >
                        <MapPin className="icon-xs" />
                        VIEW ON MAP ({msg.map_action.cell_id})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message chat-message-assistant fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Loader2 className="icon-xs animate-spin" /> Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          <div className="quick-actions">
            {!isDisabled && suggestions.map((sug, i) => (
              <span key={i} className="quick-action-chip" onClick={() => handleSend(sug)}>
                {sug}
              </span>
            ))}
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="chat-input"
              placeholder={isDisabled ? "Assistant temporarily disabled" : "Ask about your crop, soil, or field..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend(input);
              }}
              disabled={loading || isDisabled}
            />
            <button 
              className="chat-send-btn" 
              onClick={() => handleSend(input)}
              disabled={!input.trim() || loading || isDisabled}
            >
              <Send className="icon-xs" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
