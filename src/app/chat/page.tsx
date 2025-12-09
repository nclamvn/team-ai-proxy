'use client';

import { useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import MessageList, { Message } from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import SimilarResultsPanel, { SimilarResult } from '@/components/chat/SimilarResultsPanel';

// Temporary user ID for development - replace with auth
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

interface ChatResponse {
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  content: string;
  model: string;
  createdAt: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  similarResults: SimilarResult[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [similarResults, setSimilarResults] = useState<SimilarResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string>('');

  const handleSend = useCallback(async (content: string) => {
    if (isLoading) return;

    // Add user message optimistically
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const userMessage: Message = {
      id: tempUserMsgId,
      role: 'user',
      content,
    };

    // Add loading indicator for assistant
    const tempAssistantMsgId = `temp-assistant-${Date.now()}`;
    const loadingMessage: Message = {
      id: tempAssistantMsgId,
      role: 'assistant',
      content: '',
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEV_USER_ID,
        },
        body: JSON.stringify({
          conversationId,
          message: content,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send message');
      }

      const data: ChatResponse = await response.json();

      // Update conversation ID if new
      if (!conversationId) {
        setConversationId(data.conversationId);
      }

      // Update similar results
      setSimilarResults(data.similarResults || []);

      // Replace loading message with actual response
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === tempUserMsgId) {
            return { ...msg, id: data.userMessageId };
          }
          if (msg.id === tempAssistantMsgId) {
            return {
              id: data.assistantMessageId,
              role: 'assistant' as const,
              content: data.content,
              createdAt: data.createdAt,
            };
          }
          return msg;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Remove loading message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempAssistantMsgId));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading]);

  const handleSimilarClick = (result: SimilarResult) => {
    // For now, just log - can expand to show modal or navigate
    console.log('Similar result clicked:', result);
    alert(`Similar answer:\n\n${result.title}\n\n${result.summary}`);
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setSimilarResults([]);
    setError(null);
    setPendingQuestion('');
  };

  const handleSampleClick = (question: string) => {
    setPendingQuestion(question);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <Topbar
        title="Chat AI"
        subtitle={conversationId ? `Cuộc trò chuyện ${conversationId.slice(0, 8)}...` : 'Cuộc trò chuyện mới'}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Error banner */}
          {error && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-100">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* New chat button */}
          {messages.length > 0 && (
            <div className="px-6 py-2 border-b border-slate-100">
              <button
                onClick={handleNewChat}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Cuộc trò chuyện mới
              </button>
            </div>
          )}

          {/* Messages */}
          <MessageList messages={messages} onSampleClick={handleSampleClick} />

          {/* Input */}
          <MessageInput onSend={handleSend} disabled={isLoading} initialMessage={pendingQuestion} />
        </div>

        {/* Similar results sidebar */}
        <div className="w-80 border-l border-slate-200 bg-white hidden lg:block">
          <SimilarResultsPanel
            results={similarResults}
            onResultClick={handleSimilarClick}
          />
        </div>
      </div>
    </div>
  );
}
