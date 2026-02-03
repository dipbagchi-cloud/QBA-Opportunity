import { NextRequest, NextResponse } from "next/server";

// This simulates the behavior of the OpenAI API for the demo
// In a production environment with an API Key, this would be replaced by actual LLM calls
export async function POST(req: NextRequest) {
    const { agentId, task } = await req.json();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (step: string, detail: string, status: 'thinking' | 'action' | 'success') => {
                const data = JSON.stringify({ step, detail, status });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            // Simulation Delays
            const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            try {
                // Step 1: Initialize
                sendEvent("Wake Up", `Initializing Agent ${agentId}...`, "thinking");
                await wait(1000);

                // Step 2: Observation (Mocking based on Agent Type)
                if (agentId === 2) { // Researcher
                    sendEvent("Observation", `Reading input: "${task}"`, "thinking");
                    await wait(1500);

                    sendEvent("Thought", "Identifying key entities. Found company 'Acme Corp' and individual 'John Doe'.", "thinking");
                    await wait(1500);

                    sendEvent("Action", "Executing Tool: Search Web (Tavily API)", "action");
                    await wait(2000);

                    sendEvent("Observation", "Found 14,200 results. Parsing top 3 sources...", "thinking");
                    await wait(1500);

                    sendEvent("Thought", "Acme Corp raised $50M Series B last week. CTO is hiring for DevOps.", "thinking");
                    await wait(1500);

                    sendEvent("Action", "Executing Tool: LinkedIn Profile Scraper", "action");
                    await wait(2000);

                    sendEvent("Success", "Research complete. Profile enriched with 12 new data points.", "success");
                } else if (agentId === 1) { // Outreach
                    sendEvent("Observation", "Analyzing prospect profile and recent news...", "thinking");
                    await wait(1500);

                    sendEvent("Thought", "Lead recently mentioned 'Cloud Costs' on LinkedIn. Using 'Value-Add' template.", "thinking");
                    await wait(1500);

                    sendEvent("Action", "Drafting personalized email...", "action");
                    await wait(2000);

                    sendEvent("Success", "Email drafted and saved to outbox.", "success");
                } else {
                    sendEvent("Error", "Agent type not recognized for demo.", "thinking");
                }
            } catch (error) {
                console.error(error);
            } finally {
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
