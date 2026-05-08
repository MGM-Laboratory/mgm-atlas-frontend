'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, ShieldCheck, User as UserIcon } from 'lucide-react';
import { clearSession, getStoredSession } from '@/lib/auth-client';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  isAdmin?: boolean;
}

export function UserMenu({ isAdmin }: Props) {
  const router = useRouter();
  const session = getStoredSession();
  const user = session?.user;
  const accountUrl = process.env.NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL;

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={user?.name ? `${user.name} menu` : 'Account menu'}
          className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Avatar src={user?.image ?? undefined} name={user?.name ?? '?'} size={32} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5 normal-case tracking-normal">
            <span className="text-[13px] font-semibold text-ink">{user?.name ?? 'You'}</span>
            <span className="truncate text-[12px] font-normal text-ink-3">{user?.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={'/me' as never}>
            <UserIcon className="h-4 w-4 text-ink-2" strokeWidth={2.25} />
            Your dashboard
          </Link>
        </DropdownMenuItem>
        {accountUrl ? (
          <DropdownMenuItem asChild>
            <a href={accountUrl} target="_blank" rel="noreferrer">
              <Settings className="h-4 w-4 text-ink-2" strokeWidth={2.25} />
              Account settings
            </a>
          </DropdownMenuItem>
        ) : null}
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href={'/admin' as never}>
              <ShieldCheck className="h-4 w-4 text-brand-blue" strokeWidth={2.25} />
              Admin panel
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-brand-red">
          <LogOut className="h-4 w-4" strokeWidth={2.25} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

