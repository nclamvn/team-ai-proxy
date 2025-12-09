'use client';

export interface SearchResult {
  knowledgeCardId: string;
  title: string;
  summary: string;
  mainAnswer: string | null;
  tags: string[];
  score: number;
  createdAt: string;
}

interface SearchResultCardProps {
  result: SearchResult;
  onClick?: (result: SearchResult) => void;
}

export default function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const scoreLabel = result.score >= 0.9
    ? 'Rất phù hợp'
    : result.score >= 0.8
    ? 'Phù hợp'
    : result.score >= 0.6
    ? 'Tương đối'
    : 'Ít phù hợp';

  const scoreColor = result.score >= 0.9
    ? 'bg-green-100 text-green-700'
    : result.score >= 0.8
    ? 'bg-blue-100 text-blue-700'
    : result.score >= 0.6
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-slate-100 text-slate-600';

  return (
    <div
      onClick={() => onClick?.(result)}
      className="bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-base font-medium text-slate-900 line-clamp-2">
          {result.title}
        </h3>
        <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${scoreColor}`}>
          {Math.round(result.score * 100)}% - {scoreLabel}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-600 line-clamp-3 mb-3">
        {result.summary}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {result.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
            >
              {tag}
            </span>
          ))}
          {result.tags.length > 4 && (
            <span className="text-xs text-slate-400">
              +{result.tags.length - 4} khác
            </span>
          )}
        </div>

        {/* Date */}
        <span className="text-xs text-slate-400">
          {new Date(result.createdAt).toLocaleDateString('vi-VN')}
        </span>
      </div>
    </div>
  );
}
