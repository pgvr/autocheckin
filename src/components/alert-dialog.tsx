"use client";

import type { ReactNode } from "react";
import React, { forwardRef, memo, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export interface AlertDialogProps {
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  cancelText?: string;
  confirmText: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  variant?: "positive" | "negative";
}

export const ComposedAlertDialog = memo(
  forwardRef<React.ElementRef<typeof AlertDialogContent>, AlertDialogProps>(
    (
      {
        title,
        description,
        confirmText,
        onCancel,
        onConfirm,
        cancelText = "Cancel",
        isOpen,
        onOpenChange,
        variant = "negative",
      },
      ref,
    ) => {
      const confirmRef = useRef<HTMLButtonElement>(null);
      const [isLoading, setIsLoading] = useState(false);
      return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
          <AlertDialogContent
            ref={ref}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
            }}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              confirmRef.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onCancel}>
                {cancelText}
              </AlertDialogCancel>
              <AlertDialogAction
                variant={variant === "negative" ? "destructive" : "default"}
                isLoading={isLoading}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsLoading(true);
                  try {
                    await onConfirm();
                  } finally {
                    setIsLoading(false);
                  }
                  onOpenChange(false);
                }}
                ref={confirmRef}
              >
                {confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    },
  ),
);
