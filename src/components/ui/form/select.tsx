"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import React from "react";
import { z } from "zod";

import { cn } from "~/lib/utils";

import { Label } from "../label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select";

export const OptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});
export type Option = z.infer<typeof OptionSchema>;

export interface SelectProps {
  value?: string | undefined;
  onChange?: (value: string) => void;
  className?: string;
  selectClassName?: string;
  options: Array<Option>;
  label?: ReactNode;
  disabled?: boolean;
  name: string;
  errorMessage?: ReactNode;
  showErrorMessage?: boolean;
  placeholder?: string;
}
export const ComposedSelect = React.memo(
  React.forwardRef<HTMLButtonElement, SelectProps>(
    (
      {
        value,
        onChange,
        className,
        selectClassName,
        options,
        disabled,
        name,
        errorMessage,
        label,
        showErrorMessage = true,
        placeholder = "Select...",
      },
      ref,
    ) => {
      return (
        <div className={cn("flex flex-col", className)}>
          {label && (
            <Label className="mb-1.5" htmlFor={name}>
              {label}
            </Label>
          )}
          <Select disabled={disabled} value={value} onValueChange={onChange}>
            <SelectTrigger
              className={cn(selectClassName)}
              name={name}
              ref={ref}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup className="max-h-52 overflow-auto">
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <AnimatePresence>
            {errorMessage && showErrorMessage && (
              <motion.p
                initial={{
                  opacity: 0,
                  height: 0,
                  marginTop: 0,
                }}
                animate={{
                  opacity: 1,
                  height: "auto",
                  marginTop: "0.5rem",
                }}
                exit={{
                  opacity: 0,
                  height: 0,
                  marginTop: 0,
                }}
                transition={{ duration: 0.1 }}
                className="text-sm text-destructive"
                id={`${name}-error`}
              >
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      );
    },
  ),
);
