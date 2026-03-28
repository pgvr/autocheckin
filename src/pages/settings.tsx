import { type GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ComposedAlertDialog } from "~/components/alert-dialog";
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
import { Spinner } from "~/components/ui/spinner";
import { UserNav } from "~/components/user-menu";
import { getServerAuthSession } from "~/server/auth";
import { api } from "~/utils/api";

export default function SettingsPage() {
  const utils = api.useUtils();
  const userInfoQuery = api.user.info.useQuery();
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const disconnectCalMutation = api.user.disconnectCal.useMutation({
    onSuccess: async () => {
      await utils.user.info.invalidate();
      toast.success("Cal.com disconnected", {
        description:
          "Autocheckin will stop scheduling new check-ins until you reconnect.",
      });
    },
    onError: (error) => {
      toast.error("Failed to disconnect Cal.com", {
        description: error.message,
      });
    },
  });

  const isLoading = userInfoQuery.isLoading;
  const userInfo = userInfoQuery.data;

  return (
    <>
      <NextSeo title="Settings" />
      <div className="container p-4">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <div className="font-display text-2xl">Autocheckin</div>
            <div className="text-sm text-muted-foreground">Settings</div>
          </div>
          <UserNav />
        </div>

        <ComposedAlertDialog
          confirmText="Disconnect"
          variant="negative"
          title="Disconnect Cal.com?"
          description="Existing Cal.com bookings will stay in place, but Autocheckin will stop scheduling future check-ins until you reconnect."
          isOpen={isDisconnectDialogOpen}
          cancelText="Cancel"
          onCancel={() => {
            setIsDisconnectDialogOpen(false);
          }}
          onConfirm={async () => {
            await disconnectCalMutation.mutateAsync();
            setIsDisconnectDialogOpen(false);
          }}
          onOpenChange={(isOpen) => {
            setIsDisconnectDialogOpen(isOpen);
          }}
        />

        {isLoading && (
          <div className="flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {!isLoading && (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cal.com connection</CardTitle>
                <CardDescription>
                  Manage the Cal.com account Autocheckin uses for event lookups,
                  booking, and future scheduling.
                </CardDescription>
              </CardHeader>

              {userInfo?.hasCalConnection ? (
                <>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={userInfo.calProfile?.avatarUrl ?? ""}
                          alt={userInfo.calProfile?.name ?? "Cal.com"}
                        />
                        <AvatarFallback>
                          {userInfo.calProfile?.name?.[0] ?? "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {userInfo.calProfile?.name ??
                            userInfo.calProfile?.username}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          @{userInfo.calProfile?.username}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Connected and ready for scheduling.
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col items-start gap-4 border-t pt-6 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <p className="max-w-prose text-sm text-muted-foreground">
                      Disconnecting removes Autocheckin&apos;s access but does
                      not cancel meetings already booked in Cal.com.
                    </p>
                    <Button
                      className="shrink-0"
                      variant="destructive"
                      isLoading={disconnectCalMutation.isPending}
                      onClick={() => {
                        setIsDisconnectDialogOpen(true);
                      }}
                    >
                      Disconnect Cal.com
                    </Button>
                  </CardFooter>
                </>
              ) : (
                <>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No Cal.com account is connected right now. Reconnect to
                      resume automatic scheduling. After OAuth consent, you will
                      return to Home.
                    </p>
                  </CardContent>
                  <CardFooter className="border-t pt-6">
                    <Link
                      href="/api/cal/oauth/start"
                      className={buttonVariants({ className: "inline-flex" })}
                    >
                      Connect Cal.com
                    </Link>
                  </CardFooter>
                </>
              )}
            </Card>
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
