'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label, FieldHelp } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import { RichTextEditor } from '@/components/rich-text/editor';
import { MediaUpload } from '@/components/media/media-upload';
import { api, uploadToPresigned } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type {
  CollaborationRole,
  ProjectDetailInsider,
  ProjectMedia,
  ProjectPhase,
  ProjectVisibility,
  Tag,
} from '@/lib/types';
import { PROJECT_PHASE_LABEL } from '@/lib/types';
import { cn } from '@/lib/utils';

const PHASES: ProjectPhase[] = [
  'IDEA',
  'PLANNING',
  'IN_DEVELOPMENT',
  'IN_REVIEW',
  'SHIPPED',
];

interface Props {
  project: ProjectDetailInsider;
  groupedTags: { category: string; items: Tag[] }[];
  collaborationRoles: CollaborationRole[];
}

export function EditProjectForm({ project, groupedTags, collaborationRoles }: Props) {
  const qc = useQueryClient();
  const { show } = useToast();

  const [title, setTitle] = React.useState(project.title);
  const [shortDescription, setShortDescription] = React.useState(project.shortDescription);
  const [phase, setPhase] = React.useState<ProjectPhase>(project.phase);
  const [visibility, setVisibility] = React.useState<ProjectVisibility>(project.visibility);
  const [description, setDescription] = React.useState<object>(project.description as object);
  const [tagIds, setTagIds] = React.useState<string[]>(project.tags.map((t) => t.id));
  const [techStack, setTechStack] = React.useState<string[]>(project.techStack);
  const [techInput, setTechInput] = React.useState('');
  const [recruiting, setRecruiting] = React.useState<string[]>(project.collaborationRoles);
  const [media, setMedia] = React.useState<ProjectMedia[]>(project.media);
  const [links, setLinks] = React.useState({
    pmTool: project.internalLinks?.pmTool ?? '',
    repository: project.internalLinks?.repository ?? '',
    staging: project.internalLinks?.staging ?? '',
    designs: project.internalLinks?.designs ?? '',
  });

  function addTech() {
    const v = techInput.trim();
    if (!v || techStack.includes(v)) return;
    setTechStack((prev) => [...prev, v]);
    setTechInput('');
  }

  const save = useMutation({
    mutationFn: () =>
      api(`/projects/${project.id}`, {
        method: 'PATCH',
        body: {
          title,
          shortDescription,
          phase,
          visibility,
          description,
          techStack,
          collaborationRoles: recruiting,
          tagIds,
          internalLinks: {
            pmTool: links.pmTool || undefined,
            repository: links.repository || undefined,
            staging: links.staging || undefined,
            designs: links.designs || undefined,
          },
        },
      }),
    onSuccess: () => {
      show({ tone: 'success', title: 'Saved' });
      qc.invalidateQueries({ queryKey: ['project', project.slug] });
    },
    onError: (err) =>
      show({ tone: 'danger', title: 'Save failed', description: (err as Error).message }),
  });

  async function uploadInlineImage(file: File) {
    const presign = await api<{
      uploadUrl: string;
      publicUrl: string;
    }>(apiPaths.presignMedia(project.id), {
      method: 'POST',
      body: { contentType: file.type, contentLength: file.size },
    });
    await uploadToPresigned(presign.uploadUrl, file);
    return { url: presign.publicUrl };
  }

  return (
    <div className="space-y-10">
      {/* Basics */}
      <Section title="Basics">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <Label required>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Phase</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as ProjectPhase)}>
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
          <div className="lg:col-span-2">
            <Label required>Short description</Label>
            <Textarea
              rows={2}
              maxLength={280}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
            <FieldHelp>{280 - shortDescription.length} characters left.</FieldHelp>
          </div>
        </div>
      </Section>

      {/* Media */}
      <Section
        title="Media"
        description="The first item is the thumbnail. Drag to reorder. Up to 10 gallery items."
      >
        <MediaUpload projectId={project.id} items={media} onChange={setMedia} />
      </Section>

      {/* Description */}
      <Section title="Description">
        <RichTextEditor
          value={description}
          onChange={setDescription}
          onUploadImage={uploadInlineImage}
          placeholder="What is this project, who's it for, what does the team need?"
        />
      </Section>

      {/* Tech stack */}
      <Section title="Tech stack">
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
        {techStack.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {techStack.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[13px] text-ink-2"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTechStack((prev) => prev.filter((x) => x !== t))}
                  className="text-ink-3 hover:text-ink"
                  aria-label={`Remove ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </Section>

      {/* Tags */}
      <Section title="Tags">
        <div className="space-y-3">
          {groupedTags.map((g) => (
            <div key={g.category}>
              <span className="text-[12px] font-medium text-ink-3">{g.category}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.items.map((t) => {
                  const active = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setTagIds((prev) =>
                          active ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                        )
                      }
                      className={cn(
                        'inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium transition-colors',
                        active ? 'bg-brand-blue text-white' : 'bg-surface-muted text-ink-2 hover:bg-line',
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
      </Section>

      {/* Recruiting */}
      <Section title="Recruiting for">
        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {collaborationRoles.map((r) => (
            <label key={r.id} className="inline-flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={recruiting.includes(r.name)}
                onCheckedChange={(c) =>
                  setRecruiting((prev) =>
                    c ? [...prev, r.name] : prev.filter((x) => x !== r.name),
                  )
                }
              />
              <span className="text-[14px] text-ink">{r.name}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* Visibility & links */}
      <Section title="Visibility & links">
        <div className="space-y-4">
          <div>
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as ProjectVisibility)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public — visible to all members</SelectItem>
                <SelectItem value="PRIVATE">Private — team only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(['pmTool', 'repository', 'staging', 'designs'] as const).map((key) => (
              <label key={key}>
                <span className="block text-[12px] font-medium text-ink-2">
                  {key === 'pmTool' && 'Project board'}
                  {key === 'repository' && 'Repository'}
                  {key === 'staging' && 'Staging URL'}
                  {key === 'designs' && 'Design files'}
                </span>
                <Input
                  className="mt-1"
                  placeholder="https://"
                  value={links[key]}
                  onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </div>
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={() => save.mutate()} loading={save.isPending} size="lg">
          <Save className="h-4 w-4" strokeWidth={2.25} />
          Save changes
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line pb-8">
      <div className="mb-4">
        <h2 className="font-display text-h3 tracking-[-0.005em] text-ink">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-ink-3">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
