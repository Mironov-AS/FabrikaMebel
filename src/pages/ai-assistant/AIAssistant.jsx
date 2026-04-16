import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, User, Trash2, Lightbulb, Loader2, Key, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const SUGGESTIONS = [
  'Какие договоры сейчас активны?',
  'Есть ли просроченные платежи?',
  'Покажи заказы в производстве',
  'Какие рекламации открыты?',
  'Какой контрагент имеет наибольшую задолженность?',
  'Какие заказы нужно отгрузить в ближайшее время?',
  'Какова общая сумма активных договоров?',
  'Есть ли договоры с истекающим сроком?',
];

// ── Markdown renderer ────────────────────────────────────────────────────────

function renderInlineHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:0.8em;font-family:monospace">$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}

function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', content: codeLines.join('\n') });
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h3) { blocks.push({ type: 'h3', content: h3[1] }); i++; continue; }
    if (h2) { blocks.push({ type: 'h2', content: h2[1] }); i++; continue; }
    if (h1) { blocks.push({ type: 'h1', content: h1[1] }); i++; continue; }

    // Horizontal rule (--- / *** / ___) — skip
    if (line.match(/^[-*_]{3,}\s*$/)) { i++; continue; }

    // Unordered list
    if (line.match(/^[-*•] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) {
        items.push(lines[i].replace(/^[-*•] /, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (line.match(/^\d+[.)]\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+[.)]\s/)) {
        items.push(lines[i].replace(/^\d+[.)]\s/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Empty line → skip
    if (line.trim() === '') { i++; continue; }

    // Paragraph (collect consecutive text lines)
    const textLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^[#\-*•]/) &&
      !lines[i].match(/^\d+[.)]\s/) &&
      !lines[i].startsWith('```')
    ) {
      textLines.push(lines[i]);
      i++;
    }
    if (textLines.length) blocks.push({ type: 'p', content: textLines.join('\n') });
    // Safety: if nothing was consumed (unrecognised line), always advance to prevent infinite loop
    else i++;
  }

  return blocks;
}

function InlineHtml({ text }) {
  return <span dangerouslySetInnerHTML={{ __html: renderInlineHtml(text) }} />;
}

function MarkdownRenderer({ content }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1': return <p key={idx} className="font-bold text-base mt-1"><InlineHtml text={block.content} /></p>;
          case 'h2': return <p key={idx} className="font-semibold text-sm mt-1"><InlineHtml text={block.content} /></p>;
          case 'h3': return <p key={idx} className="font-medium text-sm mt-1"><InlineHtml text={block.content} /></p>;
          case 'code': return (
            <pre key={idx} className="bg-gray-100 rounded-lg p-3 text-xs overflow-x-auto my-1 font-mono whitespace-pre-wrap">
              <code>{block.content}</code>
            </pre>
          );
          case 'ul': return (
            <ul key={idx} className="list-disc ml-4 space-y-0.5">
              {block.items.map((item, j) => <li key={j}><InlineHtml text={item} /></li>)}
            </ul>
          );
          case 'ol': return (
            <ol key={idx} className="list-decimal ml-4 space-y-0.5">
              {block.items.map((item, j) => <li key={j}><InlineHtml text={item} /></li>)}
            </ol>
          );
          case 'p': return <p key={idx}><InlineHtml text={block.content} /></p>;
          default: return null;
        }
      })}
    </div>
  );
}

// ── Message bubbles ──────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-500' : 'bg-purple-100'
      }`}>
        {isUser
          ? <User size={15} className="text-white" />
          : <Bot size={15} className="text-purple-600" />
        }
      </div>

      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-blue-500 text-white rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
      }`}>
        {isUser
          ? msg.content
          : <MarkdownRenderer content={msg.content} />
        }
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
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-gray-200 text-gray-800 shadow-sm">
        {text
          ? <MarkdownRenderer content={text} />
          : <span className="flex gap-1 items-center text-gray-400 text-sm"><Loader2 size={14} className="animate-spin" /> Думаю...</span>
        }
      </div>
    </div>
  );
}

// ── API key banner ───────────────────────────────────────────────────────────

function ApiKeyBanner() {
  return (
    <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
      <Key size={16} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="text-xs text-amber-800">
        <p className="font-semibold mb-1">Требуется API ключ Anthropic</p>
        <p className="mb-1">Добавьте ключ в файл <code className="bg-amber-100 px-1 rounded">backend/.env</code>:</p>
        <code className="block bg-amber-100 rounded p-1.5 font-mono text-xs">
          ANTHROPIC_API_KEY=sk-ant-api03-...
        </code>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 flex items-center gap-0.5 text-amber-700 hover:text-amber-900 font-medium"
        >
          Получить ключ <ChevronRight size={12} />
        </a>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AIAssistant() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const timeoutRef = useRef(null);

  // Throttled scroll: schedule at most one scroll per animation frame during streaming.
  const scrollPendingRef = useRef(false);
  const scheduleScroll = useCallback((smooth) => {
    if (scrollPendingRef.current) return;
    scrollPendingRef.current = true;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      scrollPendingRef.current = false;
    });
  }, []);

  // Scroll smoothly when a new message is committed to history.
  useEffect(() => {
    scheduleScroll(true);
  }, [history, scheduleScroll]);

  // Scroll instantly (and throttled via RAF) while streaming text arrives.
  useEffect(() => {
    if (streaming) scheduleScroll(false);
  }, [streamText, streaming, scheduleScroll]);

  // Throttle state updates: accumulate streamed text in a ref and flush at most every 50 ms.
  const streamBufferRef = useRef('');
  const flushTimerRef = useRef(null);

  const flushStreamText = useCallback(() => {
    flushTimerRef.current = null;
    setStreamText(streamBufferRef.current);
  }, []);

  const updateStreamText = useCallback((text) => {
    streamBufferRef.current = text;
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushStreamText, 50);
    }
  }, [flushStreamText]);

  const sendMessage = useCallback(async (text) => {
    const userMsg = text.trim();
    if (!userMsg || streaming) return;

    setError(null);
    setApiKeyMissing(false);
    setInput('');
    setStreaming(true);
    setStreamText('');
    streamBufferRef.current = '';

    const prevHistory = [...history];
    setHistory(prev => [...prev, { role: 'user', content: userMsg }]);

    const controller = new AbortController();
    abortRef.current = controller;

    // Hard timeout: abort after 120 s of total request time.
    timeoutRef.current = setTimeout(() => {
      controller.abort();
    }, 120_000);

    // Activity timeout: abort if no data arrives for 30 s.
    let activityTimer = null;
    const resetActivityTimer = () => {
      clearTimeout(activityTimer);
      activityTimer = setTimeout(() => {
        controller.abort();
      }, 30_000);
    };
    resetActivityTimer();

    try {
      const authHeader = api.defaults.headers.common['Authorization'] || '';
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ message: userMsg, history: prevHistory }),
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
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          resetActivityTimer();
          buffer += decoder.decode(result.value, { stream: true });
        }
        if (done) break;

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const raw = part.slice(6).trim();
          if (raw === '[DONE]') { done = true; break; }

          try {
            const data = JSON.parse(raw);
            if (data.error) {
              if (data.error.includes('ANTHROPIC_API_KEY') || data.error.includes('401')) {
                setApiKeyMissing(true);
              }
              throw new Error(data.error);
            }
            if (data.text) {
              fullText += data.text;
              updateStreamText(fullText);
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr;
          }
        }
      }

      // Flush any pending throttled update before committing to history.
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
      setStreamText(fullText);

      setHistory(prev => [...prev, { role: 'assistant', content: fullText }]);
    } catch (err) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
      if (err.name !== 'AbortError') {
        const msg = err.message || 'Ошибка при обращении к ИИ-ассистенту';
        if (msg.includes('ANTHROPIC_API_KEY') || msg.includes('401')) setApiKeyMissing(true);
        setError(msg);
      } else {
        // AbortError — could be manual stop or timeout.
        const isTimeout = !controller.signal.aborted || timeoutRef.current === null;
        const accumulated = streamBufferRef.current;
        if (accumulated) {
          // Partial response received — commit what we have.
          setHistory(prev => [...prev, { role: 'assistant', content: accumulated }]);
        } else {
          setError('Запрос был прерван или превышено время ожидания ответа от ИИ-ассистента.');
        }
        void isTimeout; // suppress unused warning
      }
    } finally {
      clearTimeout(activityTimer);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setStreaming(false);
      setStreamText('');
      streamBufferRef.current = '';
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [history, streaming, updateStreamText]);

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
    setApiKeyMissing(false);
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
            <p className="text-xs text-gray-500">Работает на Claude (Anthropic) · Знает все данные системы</p>
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
            <h2 className="text-xl font-semibold text-gray-800 mb-1">ИИ-ассистент ContractPro</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-sm">
              Задайте вопрос о договорах, клиентах, заказах, платежах или рекламациях
            </p>
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

        {history.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {streaming && <TypingBubble text={streamText} />}

        {error && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Bot size={15} className="text-red-500" />
            </div>
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
              <strong>Ошибка:</strong> {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* API key banner */}
      {apiKeyMissing && <ApiKeyBanner />}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
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
          Shift+Enter для новой строки · Claude Opus 4.6
        </p>
      </div>
    </div>
  );
}
