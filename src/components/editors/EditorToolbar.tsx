import React from 'react';
import { Editor } from '@tiptap/react';
import {
    Bold, Italic, Underline, Strikethrough, Highlighter,
    List, ListOrdered,
    Heading1, Heading2,
    Quote, Code, Minus,
    AlignLeft, AlignCenter, AlignRight,
    Redo, Undo
} from 'lucide-react';
import { clsx } from 'clsx';

interface EditorToolbarProps {
    editor: Editor | null;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
    if (!editor) {
        return null;
    }

    const ToggleButton = ({
        isActive,
        onClick,
        icon: Icon,
        title
    }: {
        isActive: boolean;
        onClick: () => void;
        icon: React.ElementType;
        title: string;
    }) => (
        <button
            onClick={onClick}
            className={clsx(
                "p-1.5 rounded transition-colors text-zinc-500 hover:text-purple-600 hover:bg-zinc-100",
                isActive && "bg-purple-100 text-purple-600"
            )}
            title={title}
        >
            <Icon size={16} />
        </button>
    );

    return (
        <div className="flex items-center gap-1 bg-transparent px-2 py-1.5 flex-wrap">
            <ToggleButton
                isActive={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
                icon={Bold}
                title="Bold"
            />
            <ToggleButton
                isActive={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                icon={Italic}
                title="Italic"
            />
            <ToggleButton
                isActive={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                icon={Underline}
                title="Underline"
            />
            <ToggleButton
                isActive={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                icon={Strikethrough}
                title="Strikethrough"
            />
            <ToggleButton
                isActive={editor.isActive('highlight')}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                icon={Highlighter}
                title="Highlight"
            />

            <div className="w-px h-4 bg-zinc-200 mx-1" />

            <ToggleButton
                isActive={editor.isActive({ textAlign: 'left' })}
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                icon={AlignLeft}
                title="Align Left"
            />
            <ToggleButton
                isActive={editor.isActive({ textAlign: 'center' })}
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                icon={AlignCenter}
                title="Align Center"
            />
            <ToggleButton
                isActive={editor.isActive({ textAlign: 'right' })}
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                icon={AlignRight}
                title="Align Right"
            />

            <div className="w-px h-4 bg-zinc-200 mx-1" />

            <ToggleButton
                isActive={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                icon={Heading1}
                title="Heading 1"
            />
            <ToggleButton
                isActive={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                icon={Heading2}
                title="Heading 2"
            />

            <div className="w-px h-4 bg-zinc-200 mx-1" />

            <ToggleButton
                isActive={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                icon={List}
                title="Bullet List"
            />
            <ToggleButton
                isActive={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                icon={ListOrdered}
                title="Ordered List"
            />

            <div className="w-px h-4 bg-zinc-200 mx-1" />

            <ToggleButton
                isActive={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                icon={Quote}
                title="Blockquote"
            />
            <ToggleButton
                isActive={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                icon={Code}
                title="Code Block"
            />
            <ToggleButton
                isActive={false}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                icon={Minus}
                title="Horizontal Rule"
            />

            <div className="flex-1" />

            <ToggleButton
                isActive={false}
                onClick={() => editor.chain().focus().undo().run()}
                icon={Undo}
                title="Undo"
            />
            <ToggleButton
                isActive={false}
                onClick={() => editor.chain().focus().redo().run()}
                icon={Redo}
                title="Redo"
            />
        </div>
    );
};
