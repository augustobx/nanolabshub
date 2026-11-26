"use client";

import { RefreshCw } from "lucide-react";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Header({ onRefresh, isRefreshing = false }: HeaderProps) {
  if (!onRefresh) return null;
  return (
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Actualizar datos"
        className="bh-btn bh-btn-secondary bh-btn--small"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        <span>{isRefreshing ? "Actualizando…" : "Actualizar"}</span>
      </button>
    </div>
  );
}
