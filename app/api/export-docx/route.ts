import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { content, title } = await req.json();

        const doc = new Document({
            sections: [{
                children: content.split('\n').map((line: string) => {
                    if (line.startsWith('# ')) {
                        return new Paragraph({ text: line.replace('# ', ''), heading: HeadingLevel.TITLE });
                    }
                    if (line.startsWith('## ')) {
                        return new Paragraph({ text: line.replace('## ', ''), heading: HeadingLevel.HEADING_1 });
                    }
                    if (line.startsWith('### ')) {
                        return new Paragraph({ text: line.replace('### ', ''), heading: HeadingLevel.HEADING_2 });
                    }
                    return new Paragraph({ text: line });
                }),
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        const uint8Array = new Uint8Array(buffer);

        return new Response(uint8Array, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${title || 'PRD'}.docx"`,
            },
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
