import { Request, Response } from 'express';
import { AgentTask, analyzeSentiment } from '../lib/intelligence';

// Epic 9 & 10: Automation Engine & Agent Governance
// POST /api/agents/task
export async function executeAgentTask(req: Request, res: Response) {
    try {
        const body = req.body;
        const { actionType, context, userId } = body;

        // 1. Initialize Agent
        let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
        if (actionType === 'DELETE_DATA' || actionType === 'SEND_CONTRACT') riskLevel = 'High';
        if (actionType === 'SEND_EMAIL') riskLevel = 'Medium';

        const agent = new AgentTask(`task-${Date.now()}`, riskLevel);

        // 2. State: Reasoning
        agent.transition('REASONING');

        // 3. Trigger Logic (Epic 10 Hybrid)
        if (actionType === 'ANALYZE_EMAIL') {
            const sentiment = analyzeSentiment(context.emailBody || "");
            if (sentiment.action === 'PAUSE_AUTOMATION') {
                return res.json({
                    agentId: agent.id,
                    status: 'PAUSED',
                    reason: 'Negative sentiment detected. Human intervention required.'
                });
            }
        }

        // 4. State: Proposing
        agent.transition('PROPOSING');

        // 5. State: Executing (Governance Check happens here)
        const isApproved = body.userApproved === true;
        const nextState = agent.transition('EXECUTING', isApproved);

        if (nextState === 'AWAITING_APPROVAL') {
            return res.json({
                agentId: agent.id,
                status: 'AWAITING_APPROVAL',
                riskLevel: riskLevel,
                message: 'High risk action blocked. Please approve.'
            });
        }

        // 6. Execute Mock Action
        agent.transition('COMPLETED');

        res.json({
            agentId: agent.id,
            status: 'COMPLETED',
            result: 'Action executed successfully.'
        });

    } catch (error) {
        res.status(500).json({ error: 'Agent Error' });
    }
}

// POST /api/agent/run - SSE streaming agent simulation
export async function runAgent(req: Request, res: Response) {
    const { agentId, task } = req.body;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const sendEvent = (step: string, detail: string, status: 'thinking' | 'action' | 'success') => {
        const data = JSON.stringify({ step, detail, status });
        res.write(`data: ${data}\n\n`);
    };

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
        res.end();
    }
}
