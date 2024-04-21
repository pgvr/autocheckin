import Link from "next/link";
import { Button } from "~/components/ui/button";

export default function Home() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <main className="text-center">
        <div className="mb-4 font-display text-2xl">Check in</div>
        <Link href="/login">
          <Button>Login</Button>
        </Link>
      </main>
    </div>
  );
}
