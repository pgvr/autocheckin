/* eslint-disable react/display-name */
import { type LucideIcon } from "lucide-react";
import React from "react";
import { Button, type ButtonProps } from "./button";

export interface IconButtonProps extends Omit<ButtonProps, "size"> {
  Icon: LucideIcon;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ Icon, ...props }, ref) => {
    return (
      <Button {...props} ref={ref} size="icon">
        <Icon className="h-4 w-4" />
      </Button>
    );
  },
);
