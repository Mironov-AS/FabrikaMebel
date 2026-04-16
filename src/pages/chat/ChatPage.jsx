import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, ChevronDown, MessageSquare } from 'lucide-react';
import useAppStore from '../../store/appStore';


const QUICK_REPLIES = [
  'Заказ принят в производство',
  'Отгрузка запланирована на...',
  'Требуется уточнение деталей',
];

function formatTime(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split(' ');
  return parts[1] ?? parts[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.split(' ')[0];
}

// Build unique conversation threads from messages
function buildConversations(messages) {
  const map = {};
  messages.forEach((msg) => {
    const key = `${msg.counterpartyId}_${msg.contractId}`;
    if (!map[key]) {
      map[key] = { counterpartyId: msg.counterpartyId, contractId: msg.contractId, messages: [], unread: 0 };
    }
    map[key].messages.push(msg);
    if (!msg.read && msg.from === 'client') map[key].unread += 1;
  });
  return Object.values(map);
}

export default function ChatPage() {
  const { chatMessages, contracts, counterparties, sendMessage } = useAppStore();
  const [activeConv, setActiveConv] = useState(null);
  const [inputText, setInputText] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef(null);

  // Memoize — only recompute when chatMessages reference changes
  const conversations = useMemo(() => buildConversations(chatMessages), [chatMessages]);

  // Precompute per-conversation lookup maps in one pass (O(n) instead of O(n²))
  const convMeta = useMemo(() => {
    const map = {};
    chatMessages.forEach((m) => {
      const key = `${m.counterpartyId}_${m.contractId}`;
      if (!map[key]) map[key] = { lastMsg: null, unread: 0 };
      map[key].lastMsg = m; // messages are ordered, so last wins
      if (!m.read && m.from === 'client') map[key].unread += 1;
    });
    return map;
  }, [chatMessages]);

  const lastMsg = (conv) => convMeta[`${conv.counterpartyId}_${conv.contractId}`]?.lastMsg ?? null;
  const unreadCount = (conv) => convMeta[`${conv.counterpartyId}_${conv.contractId}`]?.unread ?? 0;

  // Auto-select first conversation (depends on memoized conversations)
  useEffect(() => {
    if (!activeConv && conversations.length > 0) {
      setActiveConv(conversations[0]);
    }
  }, [conversations, activeConv]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeConv]);

  const getCounterparty = (id) => counterparties.find((c) => c.id === id);
  const getContract = (id) => contracts.find((c) => c.id === id);

  // Messages for active conversation
  const activeMessages = activeConv
    ? chatMessages.filter(
        (m) => m.counterpartyId === activeConv.counterpartyId && m.contractId === activeConv.contractId,
      )
    : [];

  function handleSend() {
    if (!inputText.trim() || !activeConv) return;
    sendMessage({
      contractId: activeConv.contractId,
      counterpartyId: activeConv.counterpartyId,
      from: 'manager',
      author: 'Менеджер',
      text: inputText.trim(),
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      read: true,
    });
    setInputText('');
    setShowQuickReplies(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function applyQuickReply(text) {
    setInputText(text);
    setShowQuickReplies(false);
  }

  // Group messages by date for date separators
  function groupByDate(messages) {
    const groups = [];
    let lastDate = null;
    messages.forEach((msg) => {
      const date = formatDate(msg.date);
      if (date !== lastDate) {
        groups.push({ type: 'date', date });
        lastDate = date;
      }
      groups.push({ type: 'message', msg });
    });
    return groups;
  }

  const activeCP = activeConv ? getCounterparty(activeConv.counterpartyId) : null;
  const activeContract = activeConv ? getContract(activeConv.contractId) : null;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      {/* ── Left: Conversations list ── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Переписка</h2>
          <p className="text-xs text-gray-400 mt-0.5">{conversations.length} диалог(а)</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Нет диалогов</div>
          ) : (
            conversations.map((conv, i) => {
              const cp = getCounterparty(conv.counterpartyId);
              const contract = getContract(conv.contractId);
              const last = lastMsg(conv);
              const unread = unreadCount(conv);
              const isActive =
                activeConv &&
                activeConv.counterpartyId === conv.counterpartyId &&
                activeConv.contractId === conv.contractId;

              return (
                <button
                  key={i}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition-colors ${
                    isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveConv(conv)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {cp?.name?.[0] ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${isActive ? 'font-semibold text-blue-700' : 'font-medium text-gray-900'}`}>
                          {cp?.name ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{contract?.number ?? '—'}</p>
                      </div>
                    </div>
                    {unread > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unread}
                      </span>
                    )}
                  </div>
                  {last && (
                    <div className="mt-1.5 flex items-end justify-between gap-2 pl-11">
                      <p className="text-xs text-gray-500 truncate">
                        {last.from === 'manager' ? 'Вы: ' : ''}{last.text}
                      </p>
                      <span className="text-xs text-gray-300 flex-shrink-0">{formatTime(last.date)}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Chat window ── */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                {activeCP?.name?.[0] ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{activeCP?.name ?? '—'}</p>
                <p className="text-xs text-gray-400">{activeContract?.number} — {activeContract?.subject}</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-gray-50">
            {groupByDate(activeMessages).map((item, i) => {
              if (item.type === 'date') {
                return (
                  <div key={i} className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">{item.date}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                );
              }
              const { msg } = item;
              const isManager = msg.from === 'manager';
              return (
                <div key={msg.id} className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${isManager ? '' : 'flex items-end gap-2'}`}>
                    {!isManager && (
                      <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 mb-4">
                        {msg.author?.[0] ?? '?'}
                      </div>
                    )}
                    <div>
                      {!isManager && (
                        <p className="text-xs text-gray-500 mb-1 ml-0.5">{msg.author}</p>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isManager
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <p className={`text-xs mt-1 ${isManager ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                        {formatTime(msg.date)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
            {/* Quick replies dropdown */}
            <div className="relative mb-2">
              <button
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors py-1"
                onClick={() => setShowQuickReplies((v) => !v)}
              >
                <MessageSquare size={13} />
                Быстрый ответ
                <ChevronDown size={12} className={`transition-transform ${showQuickReplies ? 'rotate-180' : ''}`} />
              </button>
              {showQuickReplies && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10 w-72">
                  {QUICK_REPLIES.map((qr, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      onClick={() => applyQuickReply(qr)}
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[42px] max-h-[120px]"
                placeholder="Написать сообщение..."
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
                  inputText.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                onClick={handleSend}
                disabled={!inputText.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Выберите диалог</p>
          </div>
        </div>
      )}
    </div>
  );
}
