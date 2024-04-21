"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import type { HTMLMotionProps } from "framer-motion";
import type {
  FieldValues,
  SubmitHandler,
  UseFormProps,
  UseFormReturn,
} from "react-hook-form";
import type { TypeOf, ZodSchema } from "zod";
import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FormProvider, useForm } from "react-hook-form";

import { cn } from "~/lib/utils";

// Tricks for generic forwardRef. Do not move this declaration elsewhere as we
// do not want to apply it everywhere. The duplication is not a problem itself
// as this code won't be in the final bundle.
// https://fettblog.eu/typescript-react-generic-forward-refs/#option-3%3A-augment-forwardref
declare module "react" {
  function forwardRef<T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactElement | null,
  ): (props: P & React.RefAttributes<T>) => React.ReactElement | null;
}

interface UseZodFormProps<T extends ZodSchema<any>>
  extends UseFormProps<TypeOf<T>> {
  schema: T;
}

export const useZodForm = <T extends ZodSchema<any>>({
  schema,
  ...formConfig
}: UseZodFormProps<T>) => {
  return useForm({
    ...formConfig,
    resolver: zodResolver(schema),
  });
};

export interface FormProps<T extends FieldValues = any>
  extends Omit<HTMLMotionProps<"form">, "onSubmit" | "ref"> {
  form: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
}

export function FormInner<T extends FieldValues>(
  { form, onSubmit, children, className = "", ...props }: FormProps<T>,
  ref: React.ForwardedRef<HTMLFormElement>,
) {
  return (
    <FormProvider {...form}>
      <motion.form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        {...props}
        className={cn(className)}
        ref={ref}
      >
        {children}
      </motion.form>
    </FormProvider>
  );
}

export const Form = React.forwardRef(FormInner);
