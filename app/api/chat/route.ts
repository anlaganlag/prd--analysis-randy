import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const { messages, userRole, companyContext } = await req.json();

        const systemMsg = `You are an elite AI Product Assistant (like ChatPRD). 
    Your goal is to help a ${userRole} at a company described as: ${companyContext}.
    
    Key behaviors:
    1. If the user provides a rough idea, ask 2-3 deep, strategic questions to uncover complexity.
    2. If 'Draft PRD' is requested, use professional language and structured templates.
    3. Act as a 'Chief Product Officer' when requested, being critical and finding hidden risks.
    4. Keep responses high-signal, low-noise.
    
    When generating a PRD, use Markdown with clear headers like ## Objective, ## Business Process, etc.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemMsg },
                ...messages,
            ],
            stream: true,
        });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                for await (const chunk of response) {
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                        controller.enqueue(encoder.encode(content));
                    }
                }
                controller.close();
            },
        });

        return new Response(stream);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
