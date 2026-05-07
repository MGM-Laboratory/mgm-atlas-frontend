'use client';

import * as React from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const lowlight = createLowlight(common);

interface Props {
  value?: object | null;
  onChange?: (json: object) => void;
  placeholder?: string;
  editable?: boolean;
  /** Provide an upload handler to enable the image button. */
  onUploadImage?: (file: File) => Promise<{ url: string }>;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  editable = true,
  onUploadImage,
  className,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({
        openOnClick: !editable,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: value ?? undefined,
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    editorProps: {
      attributes: {
        class: cn(
          'tiptap min-h-[180px] w-full text-[15px] leading-relaxed text-ink focus:outline-none',
          editable ? '' : 'pointer-events-auto',
        ),
      },
    },
    immediatelyRender: false,
  });

  // Sync external value changes (e.g. when switching projects).
  React.useEffect(() => {
    if (!editor) return;
    if (!value) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(value);
    if (current !== next) editor.commands.setContent(value as never, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className="skeleton h-[180px] rounded" />;

  return (
    <div
      className={cn(
        editable
          ? 'rounded border border-line bg-white focus-within:border-brand-blue focus-within:shadow-[0_0_0_3px_rgba(58,109,197,0.15)]'
          : '',
        className,
      )}
    >
      {editable ? <Toolbar editor={editor} onUploadImage={onUploadImage} /> : null}
      <div className={cn(editable ? 'px-4 py-3' : '')}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  onUploadImage,
}: {
  editor: Editor;
  onUploadImage?: (file: File) => Promise<{ url: string }>;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;
    try {
      const { url } = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line p-1.5">
      <ToolbarBtn label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>

      <ToolbarSep />

      <ToolbarBtn
        label="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn
        label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn
        label="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>

      <ToolbarSep />

      <ToolbarBtn label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>

      <ToolbarSep />

      <ToolbarBtn
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      <ToolbarBtn
        label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>

      <ToolbarSep />

      <ToolbarBtn label="Link" active={editor.isActive('link')} onClick={setLink}>
        <LinkIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </ToolbarBtn>
      {onUploadImage ? (
        <>
          <ToolbarBtn label="Insert image" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </ToolbarBtn>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickImage}
          />
        </>
      ) : null}
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid h-8 w-8 place-items-center rounded transition-colors',
        active ? 'bg-brand-blue-50 text-brand-blue' : 'text-ink-2 hover:bg-surface-muted hover:text-ink',
        'disabled:opacity-40 disabled:pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}
