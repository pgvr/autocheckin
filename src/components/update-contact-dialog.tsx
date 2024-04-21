import * as React from "react";

import { CheckInFrequency } from "@prisma/client";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";
import { useMediaQuery } from "~/utils/use-media-query";
import { Form, useZodForm } from "./ui/form/form";
import { FormInput } from "./ui/form/form-input";
import { FormSelect } from "./ui/form/form-select";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

export function UpdateContactDialog({
  id,
  isOpen,
  onOpenChange,
}: {
  id: string;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const contactQuery = api.contact.byId.useQuery({ id }, { enabled: !!id });

  const title = "Update contact";

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {!contactQuery.data ? (
            <div className="flex items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <ContactForm
              onClose={() => {
                onOpenChange(false);
              }}
              contact={contactQuery.data}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        {!contactQuery.data ? (
          <div className="flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ContactForm
            className="px-4"
            contact={contactQuery.data}
            onClose={() => {
              onOpenChange(false);
            }}
          />
        )}
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
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

const ContactFormSchema = z.object({
  name: z.string().min(1, "Required"),
  checkInFrequency: z.nativeEnum(CheckInFrequency),
});

function ContactForm({
  className,
  onClose,
  contact,
}: React.ComponentProps<"form"> & {
  onClose: () => void;
  contact: RouterOutputs["contact"]["byId"];
}) {
  const utils = api.useUtils();
  const updateContactMutation = api.contact.update.useMutation({
    onSuccess: async () => {
      await utils.contact.list.invalidate();
      onClose();
      toast.success("Contact updated", {});
    },
  });
  const form = useZodForm({
    schema: ContactFormSchema,
    defaultValues: {
      checkInFrequency: contact.checkInFrequency,
      name: contact.name,
    },
  });
  return (
    <Form
      form={form}
      onSubmit={(values) => {
        updateContactMutation.mutate({
          id: contact.id,
          name: values.name,
          checkInFrequency: values.checkInFrequency,
        });
      }}
      className={cn("grid items-start gap-4", className)}
    >
      <FormInput label="Name" placeholder="John Doe" name="name" />
      <Input label="Cal.com link" disabled name="cal" value={contact.calLink} />
      <FormSelect
        label="Frequency"
        name="checkInFrequency"
        options={[
          { label: "Weekly-ish", value: CheckInFrequency.WEEKLY },
          { label: "Bi-weekly-ish", value: CheckInFrequency.BIWEEKLY },
          { label: "Monthly-ish", value: CheckInFrequency.MONTHLY },
        ]}
      />

      <Button type="submit" isLoading={updateContactMutation.isPending}>
        Confirm
      </Button>
    </Form>
  );
}
