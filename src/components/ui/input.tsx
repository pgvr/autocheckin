import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

import { cn } from "~/lib/utils";
import { Label } from "./label";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  errorMessage?: string;
  name: string;
  label?: string;
};

// eslint-disable-next-line react/display-name
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, name, errorMessage, ...props }, ref) => {
    return (
      <div className={cn("", className)}>
        {label && (
          <Label className="mb-2" htmlFor={name}>
            {label}
          </Label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          )}
          ref={ref}
          name={name}
          id={name}
          aria-invalid={!!errorMessage}
          aria-describedby={`${name}-error`}
          {...props}
        />
        <AnimatePresence>
          {errorMessage && (
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
              className="text-start text-sm text-destructive"
              id={`${name}-error`}
            >
              {errorMessage}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

export { Input };
