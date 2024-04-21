import * as React from "react";

import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { useMediaQuery } from "~/utils/use-media-query";
import { Form, useZodForm } from "./ui/form/form";
import { FormInput } from "./ui/form/form-input";

export function SetApiKeyDialog({
  children: trigger,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const title = "Set API key";
  const description =
    "We need your Cal.com API key so that we can schedule meetings on your behalf. We will also create a webhook so that we can react accordingly when you reschedule or cancel meetings.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <ApiKeyForm
            onClose={() => {
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <ApiKeyForm
          className="px-4"
          onClose={() => {
            setOpen(false);
          }}
        />
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const ApiKeyFormSchema = z.object({
  apiKey: z.string().min(1, "Required"),
});

function ApiKeyForm({
  className,
  onClose,
}: React.ComponentProps<"form"> & { onClose: () => void }) {
  const utils = api.useUtils();
  const updateUserMutation = api.user.update.useMutation({
    onSuccess: async () => {
      await utils.user.info.invalidate();
      onClose();
      toast.success("Success", {
        description: "You're ready to add contacts now.",
      });
    },
  });
  const form = useZodForm({
    schema: ApiKeyFormSchema,
  });
  return (
    <Form
      form={form}
      onSubmit={(values) => {
        updateUserMutation.mutate({
          calApiKey: values.apiKey,
        });
      }}
      className={cn("grid items-start gap-4", className)}
    >
      <FormInput label="API key" type="password" name="apiKey" />

      <Button type="submit" isLoading={updateUserMutation.isPending}>
        Confirm
      </Button>
    </Form>
  );
}
