'use client';

export type SearchMode = 'hybrid' | 'semantic' | 'keyword';

interface SearchFiltersProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
}

const modeOptions: { value: SearchMode; label: string; description: string }[] = [
  { value: 'hybrid', label: 'Kết hợp', description: 'Kết quả tốt nhất' },
  { value: 'semantic', label: 'Ngữ nghĩa', description: 'Tìm theo ý nghĩa' },
  { value: 'keyword', label: 'Từ khóa', description: 'Khớp chính xác' },
];

const limitOptions = [5, 10, 20, 50];

export default function SearchFilters({
  mode,
  onModeChange,
  limit,
  onLimitChange,
}: SearchFiltersProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Mode selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Chế độ:</span>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onModeChange(option.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Limit selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Hiển thị:</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
        >
          {limitOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt} kết quả
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
