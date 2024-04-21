import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { Spinner } from "~/components/ui/spinner";

export default function Logout() {
  useEffect(() => {
    void signOut({ callbackUrl: "/" });
  }, []);
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Spinner />
    </div>
  );
}
