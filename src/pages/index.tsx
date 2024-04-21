/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Link from "next/link";
import { Button } from "~/components/ui/button";
import Image from "next/image";
import HeroImage from "~/assets/hero.svg";

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col">
      <div className="container p-4">
        <div className="mb-10 flex items-center justify-between">
          <div className="font-display text-2xl">Autocheckin</div>
          <Link href="/login">
            <Button>Login</Button>
          </Link>
        </div>
      </div>
      <div className="container grid flex-1 grid-cols-1 items-center gap-12 p-4 md:grid-cols-2">
        <div className="">
          <div className="text-balance font-display text-5xl">
            Stay in touch with people you care about via Cal.com
          </div>
          <div className="mt-4 text-balance text-xl text-muted-foreground">
            You simply paste a Cal.com link of someone, select a frequency and
            we will take care of the scheduling for you.
          </div>
          <Link href="/login">
            <Button size="lg" className="mt-4">
              Get started
            </Button>
          </Link>
        </div>

        <Image src={HeroImage} alt="Hero" />
      </div>
    </div>
  );
}
