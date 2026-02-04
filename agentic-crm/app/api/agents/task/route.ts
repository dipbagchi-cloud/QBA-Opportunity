import { NextResponse } from 'next/server';
import { AgentTask, analyzeSentiment } from '@/lib/intelligence';

// Epic 9 & 10: Automation Engine & Agent Governance
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { actionType, context, userId } = body;

        // 1. Initialize Agent
        // Risk assessment logic (Epic 9)
        let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
        if (actionType === 'DELETE_DATA' || actionType === 'SEND_CONTRACT') riskLevel = 'High';
        if (actionType === 'SEND_EMAIL') riskLevel = 'Medium';

        const agent = new AgentTask(`task-${Date.now()}`, riskLevel);

        // 2. State: Reasoning
        agent.transition('REASONING');

        // 3. Trigger Logic (Epic 10 Hybrid)
        if (actionType === 'ANALYZE_EMAIL') {
            // Use Epic 4 Logic
            const sentiment = analyzeSentiment(context.emailBody || "");
            if (sentiment.action === 'PAUSE_AUTOMATION') {
                return NextResponse.json({
                    agentId: agent.id,
                    status: 'PAUSED',
                    reason: 'Negative sentiment detected. Human intervention required.'
                });
            }
        }

        // 4. State: Proposing
        agent.transition('PROPOSING');

        // 5. State: Executing (Governance Check happens here)
        // Simulate User Approval if passed in body
        const isApproved = body.userApproved === true;
        const nextState = agent.transition('EXECUTING', isApproved);

        if (nextState === 'AWAITING_APPROVAL') {
            return NextResponse.json({
                agentId: agent.id,
                status: 'AWAITING_APPROVAL',
                riskLevel: riskLevel,
                message: 'High risk action blocked. Please approve.'
            });
        }

        // 6. Execute Mock Action
        // ... perform action ...

        agent.transition('COMPLETED');

        return NextResponse.json({
            agentId: agent.id,
            status: 'COMPLETED',
            result: 'Action executed successfully.'
        });

    } catch (error) {
        return NextResponse.json({ error: 'Agent Error' }, { status: 500 });
    }
}
