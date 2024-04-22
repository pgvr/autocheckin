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
import { CheckInFrequency } from "@prisma/client";
import { FormSelect } from "./ui/form/form-select";

export function CreateContactDialog({
  children: trigger,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const title = "Create contact";
  const description =
    "You just need to paste a Cal.com link of someone you want to stay in touch with and we'll do the rest.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <ContactForm
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
        <ContactForm
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

const ContactFormSchema = z.object({
  name: z.string().min(1, "Required"),
  calLink: z.string().refine(
    (val) => {
      if (!val) {
        return false;
      }
      // https://cal.com/patrick-productlane/30min?date=2024-04-22&month=2024-04
      const splits = val.split("cal.com");
      const urlPart = splits[1];
      if (!urlPart) {
        return false;
      }
      const slashSplits = urlPart.split("/");
      const [, username, type] = slashSplits;
      if (!username || !type) {
        return false;
      }

      return true;
    },
    { message: "The Cal.com link needs to include an event type" },
  ),
  checkInFrequency: z.nativeEnum(CheckInFrequency),
});

function ContactForm({
  className,
  onClose,
}: React.ComponentProps<"form"> & { onClose: () => void }) {
  const utils = api.useUtils();
  const createContactMutation = api.contact.create.useMutation({
    onSuccess: async () => {
      await utils.contact.list.invalidate();
      onClose();
      toast.success("Contact created", {
        description: "Keep an eye out for your first check-in.",
      });
    },
  });
  const form = useZodForm({
    schema: ContactFormSchema,
    defaultValues: {
      checkInFrequency: CheckInFrequency.WEEKLY,
    },
  });
  return (
    <Form
      form={form}
      onSubmit={(values) => {
        createContactMutation.mutate({
          name: values.name,
          checkInFrequency: values.checkInFrequency,
          calLink: values.calLink,
        });
      }}
      className={cn("grid items-start gap-4", className)}
    >
      <FormInput label="Name" placeholder="John Doe" name="name" />
      <FormInput
        label="Cal.com link"
        placeholder="https://cal.com/..."
        name="calLink"
      />
      <FormSelect
        label="Frequency"
        name="checkInFrequency"
        options={[
          { label: "Weekly-ish", value: CheckInFrequency.WEEKLY },
          { label: "Bi-weekly-ish", value: CheckInFrequency.BIWEEKLY },
          { label: "Monthly-ish", value: CheckInFrequency.MONTHLY },
          { label: "Quarterly-ish", value: CheckInFrequency.QUARTERLY },
          { label: "Bi-yearly-ish", value: CheckInFrequency.BIYEARLY },
          { label: "Yearly-ish", value: CheckInFrequency.YEARLY },
        ]}
      />

      <Button type="submit" isLoading={createContactMutation.isPending}>
        Confirm
      </Button>
    </Form>
  );
}
