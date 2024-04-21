/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { Input, type InputProps } from "../input";
import { get } from "~/lib/utils";

type FormInputProps = InputProps;

export const FormInput = React.memo(
  ({ name, type, ...props }: FormInputProps) => {
    const {
      formState: { errors },
      register,
    } = useFormContext();
    const error = get(errors, name);
    return (
      <Input
        {...props}
        type={type}
        errorMessage={error ? String(error.message) : undefined}
        {...register(name, {
          onChange: (event) => {
            if (props.onChange) {
              props.onChange(event);
            }
          },
          onBlur: (event) => {
            if (props.onBlur) {
              props.onBlur(event);
            }
          },
        })}
      />
    );
  },
);
FormInput.displayName = "FormInput";
