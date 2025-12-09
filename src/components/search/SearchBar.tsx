'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  disabled?: boolean;
  initialValue?: string;
}

export default function SearchBar({ onSearch, disabled, initialValue = '' }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed && !disabled) {
      onSearch(trimmed);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-2xl">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm trong Knowledge Base..."
          disabled={disabled}
          className="w-full pl-10 pr-20 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={disabled || !query.trim()}
          className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400"
        >
          Tìm kiếm
        </button>
      </div>
    </form>
  );
}
