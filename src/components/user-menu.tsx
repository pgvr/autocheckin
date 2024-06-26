import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { LogOut, MessageCircleHeart, ScrollText } from "lucide-react";

export function UserNav() {
  const { data } = useSession();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={data?.user.image ?? ""}
              alt={data?.user.name ?? "Avatar"}
            />
            <AvatarFallback>
              {data?.user.name ? data.user.name[0] : ""}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {data?.user.name}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {data?.user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <a href="https://autocheckin.productlane.com/roadmap" target="_blank">
            <DropdownMenuItem Icon={MessageCircleHeart}>
              Feedback
            </DropdownMenuItem>
          </a>
          <a
            href="https://autocheckin.productlane.com/changelog"
            target="_blank"
          >
            <DropdownMenuItem Icon={ScrollText}>Changelog</DropdownMenuItem>
          </a>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            Icon={LogOut}
            onClick={() => {
              void router.push("/logout");
            }}
          >
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
