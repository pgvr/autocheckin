import { CalendarCheck, CalendarClock, EllipsisVertical } from "lucide-react";
import { type GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { ComposedAlertDialog } from "~/components/alert-dialog";
import { CreateContactDialog } from "~/components/create-contact-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { IconButton } from "~/components/ui/icon-button";
import { Spinner } from "~/components/ui/spinner";
import { UpdateContactDialog } from "~/components/update-contact-dialog";
import { UserNav } from "~/components/user-menu";
import { FrequencyText } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/utils/api";

export default function Home() {
  const router = useRouter();
  const utils = api.useUtils();
  const contactQuery = api.contact.list.useQuery();
  const deleteContactMutation = api.contact.delete.useMutation({
    onSuccess: async () => {
      await utils.contact.list.invalidate();
      toast.success("Contact deleted");
    },
  });
  const userInfoQuery = api.user.info.useQuery();
  const isLoading = contactQuery.isLoading || userInfoQuery.isLoading;
  const [deleteContactId, setDeleteContactId] = useState("");
  const [updateContactId, setUpdateContactId] = useState("");

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const clearCalStatus = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("cal");
      window.history.replaceState(window.history.state, "", url.toString());
    };

    if (router.query.cal === "connected") {
      toast.success("Cal.com connected", {
        description: "Your scheduling connection is ready again.",
      });
      clearCalStatus();
    }

    if (router.query.cal === "error") {
      toast.error("Cal.com connection failed", {
        description: "Please try reconnecting your Cal.com account.",
      });
      clearCalStatus();
    }
  }, [router]);

  return (
    <>
      <NextSeo title="Home" />
      <div className="container p-4">
        <div className="mb-10 flex items-center justify-between">
          <div className="font-display text-2xl">Autocheckin</div>
          <UserNav />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {!isLoading && !userInfoQuery.data?.hasCalConnection && (
          <div className="mx-auto max-w-md space-y-4 text-center">
            <h2 className="font-display text-xl">Reconnect Cal.com</h2>
            <p className="text-muted-foreground">
              API key support has been removed. Connect your Cal.com account
              with OAuth to resume scheduling check-ins and managing contacts.
            </p>
            <Link
              href="/api/cal/oauth/start"
              className={buttonVariants({ className: "inline-flex" })}
            >
              Connect Cal.com
            </Link>
          </div>
        )}

        <ComposedAlertDialog
          confirmText="Delete"
          variant="negative"
          title="Are you sure?"
          description="Deleting the contact cannot be undone."
          isOpen={!!deleteContactId}
          cancelText="Cancel"
          onCancel={() => {
            setDeleteContactId("");
          }}
          onConfirm={async () => {
            await deleteContactMutation.mutateAsync({
              id: deleteContactId,
            });
            setDeleteContactId("");
          }}
          onOpenChange={() => {
            setDeleteContactId("");
          }}
        />

        <UpdateContactDialog
          isOpen={!!updateContactId}
          onOpenChange={() => {
            setUpdateContactId("");
          }}
          id={updateContactId}
        />

        {!isLoading && userInfoQuery.data?.hasCalConnection && (
          <div className="space-y-4">
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={userInfoQuery.data.calProfile?.avatarUrl ?? ""}
                      alt={userInfoQuery.data.calProfile?.name ?? "Cal.com"}
                    />
                    <AvatarFallback>
                      {userInfoQuery.data.calProfile?.name?.[0] ?? "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      Connected to Cal.com as{" "}
                      {userInfoQuery.data.calProfile?.name ??
                        userInfoQuery.data.calProfile?.username}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{userInfoQuery.data.calProfile?.username}
                    </div>
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Manage connection in Settings
                </Link>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {contactQuery.data?.map((contact) => {
                const now = new Date();
                const nextBooking = contact.bookings.find(
                  (b) => b.startTime > now,
                );
                return (
                  <Card key={contact.id} className="overflow-hidden">
                    <div className="flex justify-start p-6">
                      <CardHeader className="flex-1 items-start p-0">
                        <CardTitle className="flex items-center gap-4">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={
                                contact.calAvatarUrl
                                  ? `https://cal.com/${contact.calAvatarUrl}`
                                  : ""
                              }
                              alt={contact.name ?? "Avatar"}
                            />
                            <AvatarFallback className="text-base">
                              {contact.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span>{contact.name}</span>
                        </CardTitle>
                        <CardDescription className="">
                          <Link
                            href={contact.calLink}
                            target="_blank"
                            className="hover:underline"
                          >
                            {contact.calLink}
                          </Link>
                        </CardDescription>
                      </CardHeader>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            Icon={EllipsisVertical}
                            variant="ghost"
                            className=""
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="" align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onMouseOver={() => {
                                void utils.contact.byId.prefetch({
                                  id: contact.id,
                                });
                              }}
                              onClick={() => {
                                setUpdateContactId(contact.id);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteContactId(contact.id);
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock className="h-4 w-4 flex-none" />
                        <div>{FrequencyText[contact.checkInFrequency]}</div>
                      </div>
                      {nextBooking && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarCheck className="h-4 w-4 flex-none" />
                          <div>{nextBooking.startTime.toLocaleString()}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="flex flex-col border-dashed shadow-none">
                <CardHeader>
                  <CardTitle>Create contact</CardTitle>
                  <CardDescription>
                    Add a person you want to stay in touch with.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <CreateContactDialog>
                    <Button className="w-full">Create</Button>
                  </CreateContactDialog>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context);
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
  return { props: {} };
};
