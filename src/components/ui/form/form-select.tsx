/* eslint-disable react/display-name */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
"use client";

import React from "react";
import { Controller, useFormContext } from "react-hook-form";

import type { SelectProps } from "./select";
import { get } from "~/lib/utils";
import { ComposedSelect } from "./select";

type FormSelectProps = SelectProps;

export const FormSelect = React.memo(
  ({ name, onChange: nativeOnChange, ...props }: FormSelectProps) => {
    const {
      formState: { errors },
      control,
    } = useFormContext();
    const error = get(errors, name);
    return (
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value, ref, ...fieldProps } }) => (
          <ComposedSelect
            {...props}
            onChange={(e) => {
              onChange(e);
              if (nativeOnChange) {
                nativeOnChange(e);
              }
            }}
            value={value}
            ref={ref}
            errorMessage={error ? String(error.message) : undefined}
            {...fieldProps}
          />
        )}
      />
    );
  },
);
