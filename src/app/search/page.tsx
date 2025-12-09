'use client';

import { useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import SearchBar from '@/components/search/SearchBar';
import SearchFilters, { SearchMode } from '@/components/search/SearchFilters';
import SearchResultCard, { SearchResult } from '@/components/search/SearchResultCard';

// Temporary user ID for development - replace with auth
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

interface SearchResponse {
  results: SearchResult[];
}

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEV_USER_ID,
        },
        body: JSON.stringify({
          query,
          mode,
          filters: {
            limit,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Search failed');
      }

      const data: SearchResponse = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [mode, limit]);

  const handleResultClick = (result: SearchResult) => {
    // For now, show alert - can expand to modal or navigation
    console.log('Result clicked:', result);
    alert(`${result.title}\n\n${result.summary}\n\n${result.mainAnswer || ''}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <Topbar
        title="Tìm Kiếm"
        subtitle="Tìm kiếm trong Knowledge Base của team"
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <SearchBar onSearch={handleSearch} disabled={isLoading} />
            <SearchFilters
              mode={mode}
              onModeChange={setMode}
              limit={limit}
              onLimitChange={setLimit}
            />
          </div>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-lg p-5 animate-pulse">
                  <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-slate-100 rounded w-full mb-2" />
                  <div className="h-4 bg-slate-100 rounded w-5/6" />
                </div>
              ))}
            </div>
          )}

          {/* No search yet */}
          {!isLoading && !hasSearched && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Tìm Kiếm Kiến Thức</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Nhập từ khóa để tìm kiếm trong các câu hỏi và trả lời đã có từ team của bạn.
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Semantic Search
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Tìm kiếm nhanh
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* No results */}
          {!isLoading && hasSearched && results.length === 0 && !error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Không tìm thấy kết quả</h3>
                <p className="text-sm text-slate-500">
                  Thử từ khóa khác hoặc thay đổi chế độ tìm kiếm.
                </p>
              </div>
            </div>
          )}

          {/* Results list */}
          {!isLoading && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">
                Tìm thấy {results.length} kết quả
              </p>
              {results.map((result) => (
                <SearchResultCard
                  key={result.knowledgeCardId}
                  result={result}
                  onClick={handleResultClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
