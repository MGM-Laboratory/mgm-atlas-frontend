'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, ListTodo, Mail, Search, Users } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TeamMember, TeamPayload } from '@/lib/types';

/**
 * Per-project team grid. Managers pinned at the top, contributors below;
 * each card shows avatar, name, collaboration-role title, email, and the
 * project-wide count of currently-assigned tasks. Owner gets a small
 * crown badge.
 *
 * Phase 11 polish: clicking a card opens a read-only profile drawer with
 * phone / department hydrated from Keycloak when the admin token is
 * available. For Phase 6 v1 we surface what's already in the local User
 * table — name, email, avatar, bio — and skip the Keycloak fetch.
 */
export function TeamView({ projectSlug }: { projectSlug: string }) {
  const [search, setSearch] = React.useState('');
  const team = useQuery({
    queryKey: queryKeys.pmo.team(projectSlug),
    queryFn: () => api<TeamPayload>(apiPaths.pmo.team(projectSlug)),
    staleTime: 30_000,
  });

  const q = search.trim().toLowerCase();
  const filterMembers = (rows: TeamMember[]) =>
    !q
      ? rows
      : rows.filter(
          (m) =>
            m.user.name.toLowerCase().includes(q) ||
            m.user.email.toLowerCase().includes(q) ||
            (m.title?.toLowerCase().includes(q) ?? false),
        );

  const managers = filterMembers(team.data?.managers ?? []);
  const contributors = filterMembers(team.data?.contributors ?? []);
  const total = (team.data?.managers.length ?? 0) + (team.data?.contributors.length ?? 0);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink-3">
          <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
          Team
          {team.data ? <span className="font-medium text-ink-2">{total}</span> : null}
        </div>
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search
            strokeWidth={2.25}
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="h-9 pl-8 text-[13px]"
            aria-label="Search team"
          />
        </div>
      </div>

      {team.isLoading ? (
        <TeamSkeleton />
      ) : team.isError ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
          Could not load team.
        </p>
      ) : total === 0 ? (
        <p className="rounded border border-line bg-surface-muted p-4 text-center text-[13px] text-ink-3">
          No one on this team yet.
        </p>
      ) : (
        <>
          {managers.length > 0 ? (
            <section>
              <h3 className="mb-3 text-[12px] uppercase tracking-[0.12em] text-ink-3">
                Project managers ({managers.length})
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {managers.map((m) => (
                  <MemberCard key={m.id} member={m} accent="manager" />
                ))}
              </ul>
            </section>
          ) : null}

          {contributors.length > 0 ? (
            <section>
              <h3 className="mb-3 text-[12px] uppercase tracking-[0.12em] text-ink-3">
                Contributors ({contributors.length})
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {contributors.map((m) => (
                  <MemberCard key={m.id} member={m} accent="contributor" />
                ))}
              </ul>
            </section>
          ) : null}

          {q && managers.length === 0 && contributors.length === 0 ? (
            <p className="rounded border border-line bg-surface-muted p-4 text-center text-[13px] text-ink-3">
              No team members match “{search}”.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function MemberCard({ member, accent }: { member: TeamMember; accent: 'manager' | 'contributor' }) {
  const titleOrRole = member.title ?? (accent === 'manager' ? 'Project manager' : 'Contributor');
  return (
    <li>
      <Card
        className={cn(
          'flex h-full flex-col gap-3 p-4 transition-shadow duration-120 ease-out-soft hover:shadow-2',
          accent === 'manager' && 'ring-1 ring-brand-blue/30',
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar src={member.user.avatarUrl} name={member.user.name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-ink">{member.user.name}</span>
              {member.isOwner ? (
                <span title="Project owner" aria-label="Project owner">
                  <Crown
                    className="h-3.5 w-3.5 text-brand-yellow-ink"
                    strokeWidth={2.5}
                    fill="currentColor"
                  />
                </span>
              ) : null}
            </div>
            <p className="truncate text-[12px] text-ink-3">{titleOrRole}</p>
          </div>
          {accent === 'manager' ? (
            <Badge tone="info" uppercase>
              PM
            </Badge>
          ) : null}
        </div>

        {member.user.bio ? (
          <p className="line-clamp-2 text-[12px] text-ink-2">{member.user.bio}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 text-[12px]">
          <a
            href={`mailto:${member.user.email}`}
            className="inline-flex min-w-0 items-center gap-1 truncate text-ink-3 hover:text-brand-blue"
            title={member.user.email}
          >
            <Mail className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            <span className="truncate">{member.user.email}</span>
          </a>
          <span
            className="inline-flex shrink-0 items-center gap-1 text-ink-3"
            title="Currently-assigned tasks"
          >
            <ListTodo className="h-3 w-3" strokeWidth={2.25} />
            <span className="tabular-nums">{member.taskCount}</span>
          </span>
        </div>
      </Card>
    </li>
  );
}

function TeamSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-line" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-32 animate-pulse rounded-lg bg-line/70" />
        ))}
      </ul>
    </div>
  );
}
