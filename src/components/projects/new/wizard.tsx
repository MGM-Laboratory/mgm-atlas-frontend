'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Plus,
  Rocket,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label, FieldHelp } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { RichTextEditor } from '@/components/rich-text/editor';
import { PhaseBadge } from '@/components/projects/project-thumbnail';
import { Stepper } from './stepper';
import { api, uploadToPresigned } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type {
  CollaborationRole,
  MediaType,
  ProjectMedia,
  ProjectPhase,
  ProjectVisibility,
  Tag,
} from '@/lib/types';
import { PROJECT_PHASE_LABEL } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'basic', label: 'Basic info' },
  { key: 'media', label: 'Media' },
  { key: 'details', label: 'Details' },
  { key: 'settings', label: 'Settings' },
  { key: 'review', label: 'Review' },
];

interface WizardProps {
  groupedTags: { category: string; items: Tag[] }[];
  collaborationRoles: CollaborationRole[];
}

interface DraftMedia {
  id: string;
  file: File;
  previewUrl: string;
  type: MediaType;
}

interface FormState {
  title: string;
  shortDescription: string;
  phase: ProjectPhase;
  description: object;
  techStack: string[];
  collaborationRoles: string[];
  tagIds: string[];
  visibility: ProjectVisibility;
  internalLinks: { pmTool?: string; repository?: string; staging?: string; designs?: string };
  media: DraftMedia[];
}

const EMPTY_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const PHASES: ProjectPhase[] = [
  'IDEA',
  'PLANNING',
  'IN_DEVELOPMENT',
  'IN_REVIEW',
  'SHIPPED',
];

export function NewProjectWizard({ groupedTags, collaborationRoles }: WizardProps) {
  const router = useRouter();
  const { show } = useToast();

  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>({
    title: '',
    shortDescription: '',
    phase: 'PLANNING',
    description: EMPTY_DOC,
    techStack: [],
    collaborationRoles: [],
    tagIds: [],
    visibility: 'PUBLIC',
    internalLinks: {},
    media: [],
  });

  const errors = useStepErrors(form, step);

  const create = useMutation({
    mutationFn: async () => {
      const project = await api<{ id: string; slug: string }>('/projects', {
        method: 'POST',
        body: {
          title: form.title.trim(),
          shortDescription: form.shortDescription.trim(),
          description: form.description,
          phase: form.phase,
          visibility: form.visibility,
          techStack: form.techStack,
          collaborationRoles: form.collaborationRoles,
          tagIds: form.tagIds,
          internalLinks: form.internalLinks,
        },
      });

      // Upload each media item in order. The first becomes the thumbnail.
      for (let i = 0; i < form.media.length; i++) {
        const m = form.media[i];
        const presign = await api<{
          uploadUrl: string;
          publicUrl: string;
          type: MediaType;
        }>(apiPaths.presignMedia(project.id), {
          method: 'POST',
          body: { contentType: m.file.type, contentLength: m.file.size },
        });
        await uploadToPresigned(presign.uploadUrl, m.file);
        await api<ProjectMedia>(apiPaths.registerMedia(project.id), {
          method: 'POST',
          body: { url: presign.publicUrl, type: presign.type, order: i },
        });
      }

      return project;
    },
    onSuccess: (project) => {
      show({ tone: 'success', title: 'Project created', description: 'Your project is live on the dashboard.' });
      router.push(`/projects/${project.slug}` as never);
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Could not create project', description: (err as Error).message }),
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    if (Object.keys(errors).length > 0) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  return (
    <div className="space-y-8">
      <Stepper steps={STEPS} activeIndex={step} onStep={setStep} />

      <Card>
        <CardBody className="space-y-6 p-7">
          {step === 0 ? (
            <BasicInfoStep form={form} update={update} errors={errors} />
          ) : null}
          {step === 1 ? <MediaStep form={form} update={update} /> : null}
          {step === 2 ? (
            <DetailsStep
              form={form}
              update={update}
              errors={errors}
              groupedTags={groupedTags}
              collaborationRoles={collaborationRoles}
            />
          ) : null}
          {step === 3 ? <SettingsStep form={form} update={update} /> : null}
          {step === 4 ? <ReviewStep form={form} groupedTags={groupedTags} /> : null}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (step === 0 ? router.back() : setStep(step - 1))}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={Object.keys(errors).length > 0}>
            Continue
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </Button>
        ) : (
          <Button onClick={() => create.mutate()} loading={create.isPending} size="lg">
            <Rocket className="h-4 w-4" strokeWidth={2.25} />
            Publish project
          </Button>
        )}
      </div>
    </div>
  );
}

function useStepErrors(form: FormState, step: number) {
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (form.title.trim().length < 2) errors.title = 'Title is required.';
    if (form.shortDescription.trim().length < 10) errors.shortDescription = 'Add a short, punchy line (10+ chars).';
  }
  if (step === 2) {
    if (!form.description || JSON.stringify(form.description) === JSON.stringify(EMPTY_DOC)) {
      errors.description = 'Add a short description so contributors know what this is about.';
    }
  }
  return errors;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 1
function BasicInfoStep({
  form,
  update,
  errors,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">The basics</h2>
        <p className="text-body-sm text-ink-2">A name, a sentence, and what stage you&apos;re in.</p>
      </div>

      <div>
        <Label required htmlFor="title">
          Project title
        </Label>
        <Input
          id="title"
          maxLength={120}
          placeholder="MGM Garden — interactive plant catalog"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          invalid={!!errors.title}
        />
        <FieldHelp error={errors.title}>Keep it short and memorable.</FieldHelp>
      </div>

      <div>
        <Label required htmlFor="short">
          Short description
        </Label>
        <Textarea
          id="short"
          rows={3}
          maxLength={280}
          placeholder="A web-based catalog that lets visitors explore and identify plants found in the lab garden."
          value={form.shortDescription}
          onChange={(e) => update('shortDescription', e.target.value)}
          invalid={!!errors.shortDescription}
        />
        <FieldHelp error={errors.shortDescription}>
          {280 - form.shortDescription.length} characters left.
        </FieldHelp>
      </div>

      <div>
        <Label>Current phase</Label>
        <Select value={form.phase} onValueChange={(v) => update('phase', v as ProjectPhase)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHASES.map((p) => (
              <SelectItem key={p} value={p}>
                {PROJECT_PHASE_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 2
function MediaStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: DraftMedia[] = [...form.media];
    for (const file of Array.from(files)) {
      if (next.length >= 10) break;
      next.push({
        id: Math.random().toString(36).slice(2),
        file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
      });
    }
    update('media', next);
  }

  function remove(id: string) {
    const target = form.media.find((m) => m.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    update('media', form.media.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Show what you&apos;re building</h2>
        <p className="text-body-sm text-ink-2">
          Upload a thumbnail (required) and up to 10 gallery items. Drag to reorder later from the
          project page.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          'flex aspect-[16/8] w-full max-w-2xl flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-surface-muted text-ink-3',
          'transition-colors hover:border-line-strong hover:bg-line/40',
        )}
      >
        <Upload className="h-6 w-6" strokeWidth={2.25} />
        <span className="text-[14px] font-medium text-ink">Click to upload</span>
        <span className="text-[12px]">JPEG, PNG, WebP, GIF up to 10 MB · MP4 / WebM up to 100 MB</span>
      </button>

      {form.media.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {form.media.map((m, idx) => (
            <li
              key={m.id}
              className="relative overflow-hidden rounded-lg border border-line bg-white"
            >
              <div className="relative aspect-[16/9] bg-surface-muted">
                {m.type === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={m.previewUrl} className="h-full w-full object-cover" muted />
                )}
                {idx === 0 ? (
                  <span className="absolute left-2 top-2 inline-flex h-5 items-center rounded-full bg-brand-blue px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white">
                    Thumbnail
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-[12px] text-ink-2">{m.file.name}</span>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  aria-label="Remove"
                  className="text-ink-3 hover:text-brand-red"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 3
function DetailsStep({
  form,
  update,
  errors,
  groupedTags,
  collaborationRoles,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Record<string, string>;
  groupedTags: { category: string; items: Tag[] }[];
  collaborationRoles: CollaborationRole[];
}) {
  const [techInput, setTechInput] = React.useState('');

  function addTech() {
    const v = techInput.trim();
    if (!v) return;
    if (form.techStack.includes(v)) return;
    update('techStack', [...form.techStack, v]);
    setTechInput('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Tell the story</h2>
        <p className="text-body-sm text-ink-2">
          Walk through the goals, scope, and where you are. Embed images, code, and links freely.
        </p>
      </div>

      <div>
        <Label required>Description</Label>
        <RichTextEditor
          value={form.description}
          onChange={(json) => update('description', json)}
          placeholder="What are you building, who's it for, and what does the team need?"
        />
        <FieldHelp error={errors.description} />
      </div>

      <div>
        <Label>Tech stack</Label>
        <div className="flex gap-2">
          <Input
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTech();
              }
            }}
            placeholder="e.g. Next.js"
          />
          <Button type="button" variant="secondary" onClick={addTech}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Add
          </Button>
        </div>
        {form.techStack.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {form.techStack.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[13px] text-ink-2"
              >
                {t}
                <button
                  type="button"
                  onClick={() => update('techStack', form.techStack.filter((x) => x !== t))}
                  aria-label={`Remove ${t}`}
                  className="text-ink-3 hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <Label>Tags</Label>
        <div className="space-y-3">
          {groupedTags.map((g) => (
            <div key={g.category}>
              <span className="text-[12px] font-medium text-ink-3">{g.category}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.items.map((t) => {
                  const active = form.tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        update(
                          'tagIds',
                          active ? form.tagIds.filter((x) => x !== t.id) : [...form.tagIds, t.id],
                        )
                      }
                      className={cn(
                        'inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium transition-colors',
                        active
                          ? 'bg-brand-blue text-white'
                          : 'bg-surface-muted text-ink-2 hover:bg-line',
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Recruiting for</Label>
        <p className="mb-2 text-[13px] text-ink-3">
          Pick the roles you&apos;re looking to fill. People can apply via the contribute button.
        </p>
        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
          {collaborationRoles.map((r) => (
            <label key={r.id} className="inline-flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={form.collaborationRoles.includes(r.name)}
                onCheckedChange={(c) =>
                  update(
                    'collaborationRoles',
                    c
                      ? [...form.collaborationRoles, r.name]
                      : form.collaborationRoles.filter((x) => x !== r.name),
                  )
                }
              />
              <span className="text-[14px] text-ink">{r.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 4
function SettingsStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Settings</h2>
        <p className="text-body-sm text-ink-2">Visibility and team-only links.</p>
      </div>

      <div>
        <Label>Visibility</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => update('visibility', 'PUBLIC')}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
              form.visibility === 'PUBLIC'
                ? 'border-brand-blue bg-brand-blue-50/50'
                : 'border-line hover:border-line-strong',
            )}
          >
            <Eye className="h-5 w-5 text-brand-blue" strokeWidth={2.25} />
            <div>
              <div className="text-[14px] font-medium text-ink">Public to MGM Lab</div>
              <p className="mt-0.5 text-[12px] text-ink-2">
                All authenticated members can see this project on the dashboard.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => update('visibility', 'PRIVATE')}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
              form.visibility === 'PRIVATE'
                ? 'border-brand-blue bg-brand-blue-50/50'
                : 'border-line hover:border-line-strong',
            )}
          >
            <EyeOff className="h-5 w-5 text-ink-2" strokeWidth={2.25} />
            <div>
              <div className="text-[14px] font-medium text-ink">Private — team only</div>
              <p className="mt-0.5 text-[12px] text-ink-2">
                Only invited members can see this project.
              </p>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Internal links (optional)</Label>
        <p className="text-[13px] text-ink-3">
          Visible to team members only. You can add or change these later.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['pmTool', 'repository', 'staging', 'designs'] as const).map((key) => (
            <label key={key} className="block">
              <span className="block text-[12px] font-medium text-ink-2">
                {key === 'pmTool' && 'Project board (Linear, Jira, Notion…)'}
                {key === 'repository' && 'Repository'}
                {key === 'staging' && 'Staging URL'}
                {key === 'designs' && 'Design files'}
              </span>
              <Input
                placeholder="https://"
                value={form.internalLinks[key] ?? ''}
                onChange={(e) =>
                  update('internalLinks', { ...form.internalLinks, [key]: e.target.value })
                }
                className="mt-1"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Step 5
function ReviewStep({
  form,
  groupedTags,
}: {
  form: FormState;
  groupedTags: { category: string; items: Tag[] }[];
}) {
  const allTags = groupedTags.flatMap((g) => g.items);
  const tags = allTags.filter((t) => form.tagIds.includes(t.id));
  const cover = form.media[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Almost there</h2>
        <p className="text-body-sm text-ink-2">
          Quick look before publishing. You can edit any field later from the project&apos;s manage panel.
        </p>
      </div>

      <article className="overflow-hidden rounded-xl border border-line">
        <div className="relative aspect-[16/9] bg-surface-muted">
          {cover ? (
            cover.type === 'IMAGE' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={cover.previewUrl} muted className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-ink-4">
              <span className="text-[14px]">No thumbnail uploaded</span>
            </div>
          )}
        </div>
        <div className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <PhaseBadge phase={form.phase} />
            <Badge tone={form.visibility === 'PUBLIC' ? 'success' : 'neutral'} uppercase>
              {form.visibility.toLowerCase()}
            </Badge>
          </div>
          <h3 className="font-display text-display-lg tracking-[-0.02em] text-ink">{form.title}</h3>
          <p className="text-body text-ink-2">{form.shortDescription}</p>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t.id} tone="neutral">
                  {t.name}
                </Badge>
              ))}
            </div>
          ) : null}
          {form.collaborationRoles.length > 0 ? (
            <div>
              <h4 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
                Recruiting for
              </h4>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {form.collaborationRoles.map((r) => (
                  <Badge key={r} tone="info">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
