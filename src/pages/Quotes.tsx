import { useEffect, useState, useCallback } from "react";
import { useAppStore, api } from "@/store";
import { formatDateTime } from "@/utils/formatDate";
import {
  Sparkles,
  MessageSquare,
  Loader2,
  ScrollText,
  AlertTriangle,
  ThumbsUp,
} from "lucide-react";

interface QuoteData {
  id: number;
  content: string;
  type: "encourage" | "warning";
  generated_at: string;
}

export default function Quotes() {
  const { quotes, setQuotes, addQuote } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    try {
      const data = await api<QuoteData[]>("/quotes");
      setQuotes(data as any);
    } catch (err) {
      console.error("Failed to fetch quotes:", err);
      setError("获取语录失败");
    } finally {
      setLoading(false);
    }
  }, [setQuotes]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const quote = await api<QuoteData>("/quotes/generate", {
        method: "POST",
      });
      addQuote(quote as any);
    } catch (err) {
      console.error("Failed to generate quote:", err);
      setError("生成语录失败，请稍后再试");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-md-on-surface flex items-center gap-2">
            <ScrollText className="w-6 h-6" />
            AI 语录
          </h1>
          <div className="h-10 w-28 animate-pulse rounded-full bg-md-surface-container-high" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="md-card p-6 animate-pulse">
            <div className="h-6 w-3/4 rounded bg-md-surface-container-high mb-3" />
            <div className="h-4 w-1/2 rounded bg-md-surface-container-high" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-md-on-surface flex items-center gap-2">
          <ScrollText className="w-6 h-6" />
          AI 语录
        </h1>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="md-btn md-btn-filled"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              生成语录
            </>
          )}
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-md-error-container text-md-error text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Quote List */}
      {quotes.length === 0 ? (
        <div className="md-card-elevated p-12 text-center">
          <MessageSquare className="w-16 h-16 text-md-on-surface-variant/30 mx-auto mb-4" />
          <p className="text-md-on-surface-variant text-lg mb-2">还没有语录</p>
          <p className="text-md-on-surface-variant text-sm">
            点击上方的"生成语录"按钮，让AI为你生成一条专属自律语录吧！
          </p>
          <ThumbsUp className="w-8 h-8 text-md-on-surface-variant/20 mx-auto mt-4" />
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote, index) => {
            const q = quote as unknown as QuoteData;
            return (
              <div
                key={q.id}
                className={`md-card-elevated p-5 border-l-4 ${
                  q.type === "encourage"
                    ? "border-l-[var(--md-primary)]"
                    : "border-l-[var(--md-error)]"
                } ${index === 0 ? "animate-slide-up" : ""}`}
              >
                <div className="relative pl-4 mb-3">
                  <div className="absolute left-0 top-0 text-md-on-surface-variant/20 text-2xl leading-none select-none">
                    &ldquo;
                  </div>
                  <p className="text-md-on-surface text-lg leading-relaxed">
                    {q.content}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className="md-chip"
                    style={
                      q.type === "encourage"
                        ? {
                            backgroundColor: "var(--md-primary-container)",
                            color: "var(--md-on-primary-container)",
                            borderColor: "transparent",
                          }
                        : {
                            backgroundColor: "var(--md-error-container)",
                            color: "var(--md-error)",
                            borderColor: "transparent",
                          }
                    }
                  >
                    {q.type === "encourage" ? "鼓励" : "警示"}
                  </span>
                  <span className="text-xs text-md-on-surface-variant">
                    {formatDateTime(q.generated_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}