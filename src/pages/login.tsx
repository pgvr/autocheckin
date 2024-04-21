import { type GetServerSideProps } from "next";
import { signIn } from "next-auth/react";
import { NextSeo } from "next-seo";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getServerAuthSession } from "~/server/auth";

export default function LoginForm() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  return (
    <>
      <NextSeo title="Login" />
      <div className="relative flex h-screen w-full items-center justify-center p-4">
        <div className="absolute left-4 top-4 font-display text-2xl">
          Autocheckin
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Login</CardTitle>
            <CardDescription>Only Google is supported for now.</CardDescription>
          </CardHeader>
          {/* <CardContent className="grid gap-4"> */}
          {/*   <div className="grid gap-2"> */}
          {/*     <Label htmlFor="email">Email</Label> */}
          {/*     <Input id="email" type="email" placeholder="m@example.com" required /> */}
          {/*   </div> */}
          {/*   <div className="grid gap-2"> */}
          {/*     <Label htmlFor="password">Password</Label> */}
          {/*     <Input id="password" type="password" required /> */}
          {/*   </div> */}
          {/* </CardContent> */}
          <CardFooter>
            <Button
              onClick={() => {
                setIsGoogleLoading(true);
                void signIn("google", { callbackUrl: "/home" });
              }}
              isLoading={isGoogleLoading}
              className="w-full"
            >
              Sign in with Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerAuthSession(context);
  if (session) {
    return {
      redirect: {
        destination: "/home",
        permanent: false,
      },
    };
  }
  return { props: {} };
};
