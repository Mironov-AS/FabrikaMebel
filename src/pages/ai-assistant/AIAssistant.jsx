import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Trash2, Lightbulb, Loader2 } from 'lucide-react';
import api from '../../services/api';

const SUGGESTIONS = [
  'Какие договоры сейчас активны?',
  'Есть ли просроченные платежи?',
  'Покажи заказы в производстве',
  'Какие рекламации открыты?',
  'Какой контрагент имеет наибольшую задолженность?',
  'Какие заказы нужно отгрузить в ближайшее время?',
];

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-500' : 'bg-purple-100'
      }`}>
        {isUser
          ? <User size={15} className="text-white" />
          : <Bot size={15} className="text-purple-600" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-500 text-white rounded-tr-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingBubble({ text }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
        <Bot size={15} className="text-purple-600" />
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-white border border-gray-200 text-gray-800 shadow-sm">
        {text || <span className="flex gap-1 items-center text-gray-400"><Loader2 size={14} className="animate-spin" /> Думаю...</span>}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streamText]);

  async function sendMessage(text) {
    const userMsg = text.trim();
    if (!userMsg || streaming) return;

    setError(null);
    setInput('');
    setStreaming(true);
    setStreamText('');

    const newHistory = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const authHeader = api.defaults.headers.common['Authorization'] || '';
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          message: userMsg,
          history: history, // send previous history (without the new message)
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const raw = part.slice(6);
          if (raw === '[DONE]') break;

          try {
            const data = JSON.parse(raw);
            if (data.error) throw new Error(data.error);
            if (data.text) {
              fullText += data.text;
              setStreamText(fullText);
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }

      // Commit streamed response to history
      setHistory(prev => [...prev, { role: 'assistant', content: fullText }]);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Ошибка при обращении к ИИ-ассистенту');
      }
    } finally {
      setStreaming(false);
      setStreamText('');
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearHistory() {
    setHistory([]);
    setError(null);
    setInput('');
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  const isEmpty = history.length === 0 && !streaming;

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <Bot size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">ИИ-ассистент</h1>
            <p className="text-xs text-gray-500">Отвечает на вопросы по данным системы</p>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={13} />
            Очистить
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
              <Bot size={28} className="text-purple-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Добро пожаловать!</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-sm">
              Задайте вопрос о договорах, клиентах, заказах, платежах или рекламациях
            </p>
            {/* Suggestions */}
            <div className="w-full max-w-lg">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3 justify-center">
                <Lightbulb size={12} />
                Примеры вопросов
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:border-purple-300 hover:bg-purple-50 transition-colors text-gray-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {streaming && <TypingBubble text={streamText} />}

        {error && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Bot size={15} className="text-red-500" />
            </div>
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
              <strong>Ошибка:</strong> {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        {/* Compact suggestions when chat is active */}
        {!isEmpty && !streaming && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="shrink-0 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-1 hover:border-purple-300 hover:bg-purple-50 transition-colors text-gray-600 whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спросите что-нибудь... (Enter для отправки)"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 disabled:bg-gray-50 disabled:text-gray-400 max-h-32"
            style={{ height: 'auto', minHeight: '44px' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
          {streaming ? (
            <button
              onClick={stopStreaming}
              className="shrink-0 w-10 h-10 rounded-xl bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
              title="Остановить"
            >
              <span className="w-3 h-3 bg-red-500 rounded-sm" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 flex items-center justify-center transition-colors"
              title="Отправить"
            >
              <Send size={16} className={input.trim() ? 'text-white' : 'text-gray-400'} />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Shift+Enter для новой строки
        </p>
      </div>
    </div>
  );
}
