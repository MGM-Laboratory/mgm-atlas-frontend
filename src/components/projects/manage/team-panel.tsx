'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, UserPlus, ShieldCheck, ShieldOff, X, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { CollaborationRole, ProjectDetailInsider, ProjectMember, ProjectRole, UserSummary } from '@/lib/types';

interface Props {
  project: ProjectDetailInsider;
  collaborationRoles: CollaborationRole[];
}

export function TeamPanel({ project, collaborationRoles }: Props) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const updateMember = useMutation({
    mutationFn: (vars: { memberId: string; role?: ProjectRole; title?: string }) =>
      api(apiPaths.member(project.id, vars.memberId), {
        method: 'PATCH',
        body: { role: vars.role, title: vars.title },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', project.slug] });
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not update', description: (err as Error).message }),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      api(apiPaths.member(project.id, memberId), { method: 'DELETE' }),
    onSuccess: () => {
      show({ tone: 'success', title: 'Member removed' });
      qc.invalidateQueries({ queryKey: ['project', project.slug] });
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not remove', description: (err as Error).message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Team</h2>
          <p className="mt-1 text-body-sm text-ink-2">
            {project.members.length} {project.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" strokeWidth={2.25} />
          Invite
        </Button>
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line bg-white">
        {project.members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            isOwner={m.user.id === project.owner.id}
            onChangeRole={(role) => updateMember.mutate({ memberId: m.id, role })}
            onRemove={() => removeMember.mutate(m.id)}
            isUpdating={updateMember.isPending && updateMember.variables?.memberId === m.id}
            isRemoving={removeMember.isPending && removeMember.variables === m.id}
          />
        ))}
      </ul>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        projectId={project.id}
        projectSlug={project.slug}
        roles={collaborationRoles}
      />
    </div>
  );
}

function MemberRow({
  member,
  isOwner,
  onChangeRole,
  onRemove,
  isUpdating,
  isRemoving,
}: {
  member: ProjectMember;
  isOwner: boolean;
  onChangeRole: (role: ProjectRole) => void;
  onRemove: () => void;
  isUpdating: boolean;
  isRemoving: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <Avatar src={member.user.avatarUrl} name={member.user.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{member.user.name}</span>
          {isOwner ? <Badge tone="info">Owner</Badge> : null}
          {member.title ? <Badge tone="neutral">{member.title}</Badge> : null}
        </div>
        <span className="block truncate text-[12px] text-ink-3">{member.user.email}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={member.role}
          onValueChange={(v) => onChangeRole(v as ProjectRole)}
          disabled={isOwner || isUpdating}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PROJECT_MANAGER">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-blue" strokeWidth={2.25} />
                Project Manager
              </span>
            </SelectItem>
            <SelectItem value="CONTRIBUTOR">
              <span className="inline-flex items-center gap-1.5">
                <ShieldOff className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
                Contributor
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={isOwner}
          loading={isRemoving}
          aria-label="Remove member"
          className="text-ink-3 hover:bg-brand-red-50 hover:text-brand-red"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </div>
    </li>
  );
}

function InviteDialog({
  open,
  onClose,
  projectId,
  projectSlug,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectSlug: string;
  roles: CollaborationRole[];
}) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<UserSummary | null>(null);
  const [role, setRole] = React.useState<ProjectRole>('CONTRIBUTOR');
  const [title, setTitle] = React.useState<string>('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 180);
    return () => window.clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setDebounced('');
      setSelectedUser(null);
      setRole('CONTRIBUTOR');
      setTitle('');
      setShowSuggestions(false);
    }
  }, [open]);

  // Close the suggestion dropdown if the user clicks outside the input region.
  React.useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggestions]);

  const userSearch = useQuery({
    queryKey: ['users', debounced],
    queryFn: () =>
      api<{ items: UserSummary[] }>(
        `/users?q=${encodeURIComponent(debounced)}&pageSize=8`,
      ),
    enabled: debounced.trim().length >= 1 && open,
    staleTime: 30_000,
  });

  const invite = useMutation({
    mutationFn: () =>
      api(apiPaths.invite(projectId), {
        method: 'POST',
        body: {
          userId: selectedUser?.id,
          role,
          title: title.trim() ? title.trim() : undefined,
        },
      }),
    onSuccess: () => {
      show({
        tone: 'success',
        title: 'Invite sent',
        description: 'They will be added to the team after they accept.',
      });
      qc.invalidateQueries({ queryKey: ['project', projectSlug] });
      onClose();
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Invite failed', description: (err as Error).message }),
  });

  const suggestions = userSearch.data?.items ?? [];
  const canSend = !!selectedUser && !invite.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent size="md">
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogDescription>
          They&apos;ll get a notification and join the team after accepting. You can also
          pre-fill their contribution title — Backend Engineer, Designer, whatever fits.
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <div ref={wrapperRef} className="relative">
            <Label required>Find someone</Label>
            {selectedUser ? (
              <div className="flex items-center gap-3 rounded border border-line bg-surface-muted p-2.5">
                <Avatar src={selectedUser.avatarUrl} name={selectedUser.name} size={28} />
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="truncate font-medium text-ink">{selectedUser.name}</div>
                  <div className="truncate text-ink-3">{selectedUser.email}</div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Clear selection"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearch('');
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
                <Input
                  value={search}
                  placeholder="Type a name or email…"
                  autoComplete="off"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-9"
                />
                {userSearch.isFetching ? (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-ink-4" />
                ) : null}

                {showSuggestions && debounced.trim().length >= 1 ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-2">
                    {userSearch.isLoading ? (
                      <div className="px-3 py-3 text-[13px] text-ink-3">Searching…</div>
                    ) : suggestions.length === 0 ? (
                      <div className="px-3 py-3 text-[13px] text-ink-3">No matches.</div>
                    ) : (
                      <ul className="max-h-60 overflow-y-auto py-1">
                        {suggestions.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelectedUser(u);
                                setSearch('');
                                setShowSuggestions(false);
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted"
                            >
                              <Avatar src={u.avatarUrl} name={u.name} size={28} />
                              <div className="min-w-0 flex-1 text-[13px]">
                                <div className="truncate font-medium text-ink">{u.name}</div>
                                <div className="truncate text-ink-3">{u.email}</div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label required>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                  <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[12px] text-ink-3">
                Permissions inside the project.
              </p>
            </div>
            <div>
              <Label>Contribution title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Backend Engineer"
                maxLength={120}
                list="atlas-collab-roles"
              />
              <datalist id="atlas-collab-roles">
                {roles.map((r) => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
              <p className="mt-1 text-[12px] text-ink-3">
                Shows on the member badge. Pick a preset or type your own.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={!canSend}>
            <UserPlus className="h-4 w-4" strokeWidth={2.25} />
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
