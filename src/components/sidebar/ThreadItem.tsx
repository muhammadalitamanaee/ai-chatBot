"use client";

import { useState, useRef, useEffect } from "react";
import type { Thread } from "@/db/schema";

interface Props {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (threadId: string) => void;
  onRename: (threadId: string, newTitle: string) => void;
}

export function ThreadItem({
  thread,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: Props) {
  // Controls whether we're in rename mode
  const [isEditing, setIsEditing] = useState(false);
  console.log("is Active", isActive);
  // Controls whether we're showing the delete confirmation
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // The value in the rename input
  const [editValue, setEditValue] = useState(thread.title);

  // Hover state to show action buttons
  const [isHovered, setIsHovered] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when rename mode starts
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === thread.title) {
      // Nothing changed — just exit edit mode
      setEditValue(thread.title);
      setIsEditing(false);
      return;
    }
    onRename(thread.id, trimmed);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") {
      setEditValue(thread.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group relative flex items-center rounded-lg mb-1 transition-colors ${
        isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsConfirmingDelete(false);
      }}
    >
      {isEditing ? (
        // Rename mode — show input
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleRenameSubmit}
          className="flex-1 px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg outline-none focus:border-neutral-500 mx-1 text-neutral-800"
        />
      ) : (
        // Normal mode — show title button
        <button
          onClick={onSelect}
          className="flex-1 text-left px-3 py-2 text-sm truncate"
        >
          <span
            className={
              isActive ? "text-neutral-900 font-medium" : "text-neutral-600"
            }
          >
            {thread.title}
          </span>
        </button>
      )}

      {/* Action buttons — only show on hover and not while editing */}
      {isHovered && !isEditing && (
        <div className="flex items-center gap-1 pr-2 flex-shrink-0">
          {isConfirmingDelete ? (
            // Delete confirmation
            <>
              <button
                onClick={() => onDelete(thread.id)}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-1"
                title="Confirm delete"
              >
                Delete
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="text-xs text-neutral-400 hover:text-neutral-600 px-1"
                title="Cancel"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {/* Rename button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="text-neutral-400 hover:text-neutral-700 transition-colors p-1 rounded"
                title="Rename"
              >
                {/* Pencil icon */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmingDelete(true);
                }}
                className="text-neutral-400 hover:text-red-500 transition-colors p-1 rounded"
                title="Delete"
              >
                {/* Trash icon */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
