"use client";

import { cn } from "@structo/ui/lib/utils";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// StarterKit v3 already bundles Bold, Italic, Underline, Link, headings and
// lists, so we only add Placeholder on top.
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Write your content…",
}: RichTextEditorProps) {
  const editor = useEditor({
    // Required for the Next.js App Router / React 19 so the editor does not
    // render on the server and cause a hydration mismatch.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "tiptap focus:outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      // TipTap emits "<p></p>" for an empty document; normalise to "".
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Keep the editor in sync when the value changes from outside (e.g. when the
  // entry finishes loading) without clobbering in-progress edits.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || "";
    const current = editor.getHTML();
    const normalisedCurrent = current === "<p></p>" ? "" : current;
    if (incoming !== normalisedCurrent) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div className="h-32 rounded-md border border-input bg-background" />
    );
  }

  const toolbarButton = (
    active: boolean,
    onClick: () => void,
    label: string,
    Icon: typeof Bold,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
        disabled && "opacity-50",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  return (
    <div className="rounded-md border border-input bg-background">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
          {toolbarButton(
            editor.isActive("bold"),
            () => editor.chain().focus().toggleBold().run(),
            "Bold",
            Bold,
          )}
          {toolbarButton(
            editor.isActive("italic"),
            () => editor.chain().focus().toggleItalic().run(),
            "Italic",
            Italic,
          )}
          {toolbarButton(
            editor.isActive("underline"),
            () => editor.chain().focus().toggleUnderline().run(),
            "Underline",
            UnderlineIcon,
          )}
          <span className="mx-1 h-5 w-px bg-border" />
          {toolbarButton(
            editor.isActive("heading", { level: 2 }),
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            "Heading 2",
            Heading2,
          )}
          {toolbarButton(
            editor.isActive("heading", { level: 3 }),
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            "Heading 3",
            Heading3,
          )}
          <span className="mx-1 h-5 w-px bg-border" />
          {toolbarButton(
            editor.isActive("bulletList"),
            () => editor.chain().focus().toggleBulletList().run(),
            "Bullet list",
            List,
          )}
          {toolbarButton(
            editor.isActive("orderedList"),
            () => editor.chain().focus().toggleOrderedList().run(),
            "Numbered list",
            ListOrdered,
          )}
          <span className="mx-1 h-5 w-px bg-border" />
          {toolbarButton(editor.isActive("link"), setLink, "Link", LinkIcon)}
        </div>
      )}
      <EditorContent editor={editor} className="px-3 py-2" />
    </div>
  );
}
