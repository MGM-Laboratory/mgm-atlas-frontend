'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Mail, Send, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label, FieldHelp } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';

const OTHER = '__other__';

const schema = z
  .object({
    role: z.string().min(1, 'Pick a role you want to contribute as.'),
    customRole: z.string().optional(),
    message: z.string().min(20, 'Tell the team a bit about why — at least 20 characters.').max(2000),
  })
  .refine(
    (v) => v.role !== OTHER || (v.customRole && v.customRole.trim().length >= 2),
    { path: ['customRole'], message: 'Type the role you want to apply as.' },
  );
type FormValues = z.infer<typeof schema>;

interface Props {
  projectSlug: string;
  projectTitle: string;
  /** Roles the project is currently recruiting for (may be empty). */
  collaborationRoles: string[];
  user: { name: string; email: string };
}

export function ContributeModal({ projectSlug, projectTitle, collaborationRoles, user }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get('contribute') === '1';
  const setOpen = (next: boolean) => {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set('contribute', '1');
    else sp.delete('contribute');
    router.replace(`/projects/${projectSlug}${sp.toString() ? `?${sp}` : ''}` as never, {
      scroll: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="md">
        <ModalBody
          projectSlug={projectSlug}
          projectTitle={projectTitle}
          collaborationRoles={collaborationRoles}
          user={user}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ModalBody({
  projectSlug,
  projectTitle,
  collaborationRoles,
  user,
  onClose,
}: Props & { onClose: () => void }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [submitted, setSubmitted] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: collaborationRoles[0] ?? OTHER,
      customRole: '',
      message: '',
    },
  });

  const role = form.watch('role');
  const customRole = form.watch('customRole') ?? '';

  const submit = useMutation({
    mutationFn: (values: FormValues) =>
      api(apiPaths.contribute(projectSlug), {
        method: 'POST',
        body: {
          role: values.role === OTHER ? values.customRole!.trim() : values.role,
          message: values.message,
        },
      }),
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ['discovery'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['contributions', 'mine'] });
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not submit', description: (err as Error).message }),
  });

  if (submitted) {
    return (
      <div className="text-center">
        <span className="mx-auto inline-grid h-14 w-14 place-items-center rounded-full bg-brand-green-50 text-brand-green">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.25} />
        </span>
        <DialogTitle className="mt-4">Request sent</DialogTitle>
        <DialogDescription>
          The project manager will review your request and get back to you. You&apos;ll see a
          notification when there&apos;s an update — and you can withdraw the request anytime
          from your dashboard.
        </DialogDescription>
        <DialogFooter className="mt-6 sm:justify-center">
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => submit.mutate(values))}
      className="space-y-5"
    >
      <div>
        <DialogTitle>Contribute to {projectTitle}</DialogTitle>
        <DialogDescription>
          Tell the team how you&apos;d like to help. They&apos;ll reach out by email after review.
        </DialogDescription>
      </div>

      {collaborationRoles.length > 0 ? (
        <div className="rounded-lg border border-brand-blue/20 bg-brand-blue-50 p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-brand-blue">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            Open positions
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {collaborationRoles.map((r) => (
              <Badge key={r} tone="info">
                {r}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-surface-muted p-3.5 text-[12px] text-ink-3">
          The team hasn&apos;t opened specific positions, but you can still propose how
          you&apos;d like to contribute.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Your name</Label>
          <input
            disabled
            value={user.name}
            className="h-10 w-full rounded border border-line bg-surface-muted px-3.5 text-[15px] text-ink-2"
          />
        </div>
        <div>
          <Label>Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input
              disabled
              value={user.email}
              className="h-10 w-full rounded border border-line bg-surface-muted pl-9 pr-3.5 text-[15px] text-ink-2"
            />
          </div>
        </div>
      </div>

      <div>
        <Label required>Which division/role do you want to apply for?</Label>
        <Select
          value={role}
          onValueChange={(v) => form.setValue('role', v, { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a role" />
          </SelectTrigger>
          <SelectContent>
            {collaborationRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
            <SelectItem value={OTHER}>Other (specify)…</SelectItem>
          </SelectContent>
        </Select>
        <FieldHelp error={form.formState.errors.role?.message} />

        {role === OTHER ? (
          <div className="mt-2.5">
            <Input
              autoFocus
              placeholder="e.g. Marketing Lead, Researcher, UX Writer…"
              maxLength={120}
              invalid={!!form.formState.errors.customRole}
              {...form.register('customRole')}
            />
            <FieldHelp error={form.formState.errors.customRole?.message}>
              {120 - customRole.length} characters left.
            </FieldHelp>
          </div>
        ) : null}
      </div>

      <div>
        <Label required>Why are you a good fit?</Label>
        <Textarea
          rows={5}
          placeholder="Share your relevant experience, what excites you about this project, and how much time you can give."
          invalid={!!form.formState.errors.message}
          {...form.register('message')}
        />
        <FieldHelp error={form.formState.errors.message?.message}>
          {2000 - (form.watch('message')?.length ?? 0)} characters left.
        </FieldHelp>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={submit.isPending}>
          <Send className="h-3.5 w-3.5" strokeWidth={2.25} />
          Send request
        </Button>
      </DialogFooter>
    </form>
  );
}
