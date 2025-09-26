import { useState } from "react";

export interface FilterOptions {
  platform?: "chatgpt" | "claude" | "perplexity";
  role?: "user" | "assistant" | "system" | "tool";
  hasAttachments?: boolean;
  isStarred?: boolean;
  dateRange?: "last7days" | "last30days" | "last90days" | "all";
}

interface FilterButtonsProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
}

export function FilterButtons({
  filters,
  onFiltersChange,
}: FilterButtonsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === "all" ? undefined : value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined
  );

  return (
    <div className="mb-4">
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wider hover:bg-yellow-100 px-2 py-1 border border-black"
          style={{
            fontFamily: 'monospace, "Courier New", monospace',
            boxShadow: "2px 2px 0px #000000",
            transition: "all 0.1s ease",
          }}
        >
          <span className="bg-red-500 text-white px-1">🔍</span>[ FILTERS ]
          {hasActiveFilters && (
            <span
              className="bg-red-500 text-white text-xs px-2 py-1 border border-black font-bold"
              style={{
                fontFamily: 'monospace, "Courier New", monospace',
                boxShadow: "2px 2px 0px #000000",
              }}
            >
              {Object.values(filters).filter((v) => v !== undefined).length}
            </span>
          )}
          <span
            className={`transform transition-transform font-bold ${
              isExpanded ? "rotate-180" : ""
            }`}
            style={{ fontFamily: 'monospace, "Courier New", monospace' }}
          >
            ▼
          </span>
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-bold text-white uppercase tracking-wider bg-red-500 px-2 py-1 border border-black hover:bg-red-600 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            style={{
              fontFamily: 'monospace, "Courier New", monospace',
              boxShadow: "2px 2px 0px #000000",
              transition: "all 0.1s ease",
            }}
          >
            [ CLEAR ]
          </button>
        )}
      </div>

      {/* Filter Options */}
      {isExpanded && (
        <div
          className="space-y-4 p-4 bg-yellow-50 border-2 border-black mb-4"
          style={{
            fontFamily: 'monospace, "Courier New", monospace',
            boxShadow: "4px 4px 0px #000000",
          }}
        >
          {/* Platform Filter */}
          <div>
            <label
              className="block text-xs font-bold text-black mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'monospace, "Courier New", monospace' }}
            >
              [ PLATFORM ]
            </label>
            <div className="flex gap-2 flex-wrap">
              {["all", "chatgpt", "claude", "perplexity"].map((platform) => (
                <button
                  key={platform}
                  onClick={() => handleFilterChange("platform", platform)}
                  className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border border-black transition-all ${
                    filters.platform === platform ||
                    (platform === "all" && filters.platform === undefined)
                      ? "bg-red-500 text-white hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                      : "bg-white text-black hover:bg-yellow-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                  }`}
                  style={{
                    fontFamily: 'monospace, "Courier New", monospace',
                    boxShadow: "2px 2px 0px #000000",
                  }}
                >
                  {platform === "all"
                    ? "[ ALL ]"
                    : `[ ${platform.toUpperCase()} ]`}
                </button>
              ))}
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label
              className="block text-xs font-bold text-black mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'monospace, "Courier New", monospace' }}
            >
              [ MESSAGE TYPE ]
            </label>
            <div className="flex gap-2">
              {["all", "user", "assistant"].map((role) => (
                <button
                  key={role}
                  onClick={() => handleFilterChange("role", role)}
                  className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border border-black transition-all ${
                    filters.role === role ||
                    (role === "all" && filters.role === undefined)
                      ? "bg-red-500 text-white hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                      : "bg-white text-black hover:bg-yellow-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                  }`}
                  style={{
                    fontFamily: 'monospace, "Courier New", monospace',
                    boxShadow: "2px 2px 0px #000000",
                  }}
                >
                  {role === "all" ? "[ ALL ]" : `[ ${role.toUpperCase()} ]`}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-2 gap-4">
            {/* Attachments Filter */}
            <div>
              <label
                className="block text-xs font-bold text-black mb-2 uppercase tracking-wider"
                style={{ fontFamily: 'monospace, "Courier New", monospace' }}
              >
                [ ATTACHMENTS ]
              </label>
              <div className="flex flex-col gap-2">
                {["all", "with", "without"].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      const value =
                        type === "all" ? undefined : type === "with";
                      handleFilterChange("hasAttachments", value);
                    }}
                    className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border border-black transition-all ${
                      filters.hasAttachments === (type === "with") ||
                      (type === "all" && filters.hasAttachments === undefined)
                        ? "bg-red-500 text-white hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                        : "bg-white text-black hover:bg-yellow-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    }`}
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      boxShadow: "2px 2px 0px #000000",
                    }}
                  >
                    {type === "all"
                      ? "[ ALL ]"
                      : type === "with"
                      ? "[ WITH ]"
                      : "[ WITHOUT ]"}
                  </button>
                ))}
              </div>
            </div>

            {/* Starred Filter */}
            <div>
              <label
                className="block text-xs font-bold text-black mb-2 uppercase tracking-wider"
                style={{ fontFamily: 'monospace, "Courier New", monospace' }}
              >
                [ STARRED ]
              </label>
              <div className="flex flex-col gap-2">
                {["all", "starred", "unstarred"].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      const value =
                        type === "all" ? undefined : type === "starred";
                      handleFilterChange("isStarred", value);
                    }}
                    className={`px-2 py-1 text-xs font-bold uppercase tracking-wider border border-black transition-all ${
                      filters.isStarred === (type === "starred") ||
                      (type === "all" && filters.isStarred === undefined)
                        ? "bg-red-500 text-white hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                        : "bg-white text-black hover:bg-yellow-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                    }`}
                    style={{
                      fontFamily: 'monospace, "Courier New", monospace',
                      boxShadow: "2px 2px 0px #000000",
                    }}
                  >
                    {type === "all"
                      ? "[ ALL ]"
                      : type === "starred"
                      ? "[ ⭐ STARRED ]"
                      : "[ ☆ UNSTARRED ]"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <label
              className="block text-xs font-bold text-black mb-2 uppercase tracking-wider"
              style={{ fontFamily: 'monospace, "Courier New", monospace' }}
            >
              [ DATE RANGE ]
            </label>
            <div className="flex gap-2 flex-wrap">
              {["all", "last7days", "last30days", "last90days"].map((range) => (
                <button
                  key={range}
                  onClick={() => handleFilterChange("dateRange", range)}
                  className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border border-black transition-all ${
                    filters.dateRange === range ||
                    (range === "all" && filters.dateRange === undefined)
                      ? "bg-red-500 text-white hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                      : "bg-white text-black hover:bg-yellow-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                  }`}
                  style={{
                    fontFamily: 'monospace, "Courier New", monospace',
                    boxShadow: "2px 2px 0px #000000",
                  }}
                >
                  {range === "all"
                    ? "[ ALL TIME ]"
                    : range === "last7days"
                    ? "[ 7 DAYS ]"
                    : range === "last30days"
                    ? "[ 30 DAYS ]"
                    : "[ 90 DAYS ]"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
