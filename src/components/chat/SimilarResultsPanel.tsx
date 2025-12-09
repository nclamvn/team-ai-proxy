'use client';

export interface SimilarResult {
  knowledgeCardId: string;
  title: string;
  summary: string;
  score: number;
}

interface SimilarResultsPanelProps {
  results: SimilarResult[];
  onResultClick?: (result: SimilarResult) => void;
}

export default function SimilarResultsPanel({ results, onResultClick }: SimilarResultsPanelProps) {
  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-medium text-slate-900">Câu Trả Lời Tương Tự</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 mb-1">
              Chưa có kết quả tương tự
            </p>
            <p className="text-xs text-slate-400">
              Khi bạn hỏi, hệ thống sẽ tìm các câu hỏi tương tự từ Knowledge Base
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-900">Câu Trả Lời Tương Tự</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tìm thấy {results.length} kết quả liên quan
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {results.map((result) => (
          <button
            key={result.knowledgeCardId}
            onClick={() => onResultClick?.(result)}
            className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-sm font-medium text-slate-900 line-clamp-2">
                {result.title}
              </h4>
              <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                result.score >= 0.9
                  ? 'bg-green-100 text-green-700'
                  : result.score >= 0.8
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {Math.round(result.score * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">
              {result.summary}
            </p>
          </button>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 text-center">
          Click để xem chi tiết câu trả lời
        </p>
      </div>
    </div>
  );
}
