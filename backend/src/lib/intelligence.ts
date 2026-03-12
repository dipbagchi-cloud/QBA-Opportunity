
// Epic 4: Communication Intelligence
export function analyzeSentiment(text: string): { score: number, label: 'Positive' | 'Neutral' | 'Negative', action: string } {
    const lowerText = text.toLowerCase();

    // Simple Keyword-based Sentiment (Mocking complex NLP)
    const negativeKeywords = ['angry', 'disappointed', 'cancel', 'refund', 'bad', 'poor', 'slow', 'frustrated'];
    const positiveKeywords = ['great', 'love', 'happy', 'excellent', 'thanks', 'excited', 'good'];

    let score = 0;
    negativeKeywords.forEach(word => { if (lowerText.includes(word)) score -= 0.2; });
    positiveKeywords.forEach(word => { if (lowerText.includes(word)) score += 0.2; });

    // Clamp score -1 to 1
    score = Math.max(-1, Math.min(1, score));

    let label: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
    let action = "Continue automation";

    if (score < -0.3) {
        label = 'Negative';
        action = "PAUSE_AUTOMATION"; // Epic 4 Rule: Pause if negative
    } else if (score > 0.3) {
        label = 'Positive';
        action = "ACCELERATE_SEQUENCE";
    }

    return { score, label, action };
}

// Epic 8: Forecasting & Insights
export function calculateWeightedForecast(opportunities: any[]): {
    totalValue: number,
    weightedValue: number,
    insight: string
} {
    let totalValue = 0;
    let weightedValue = 0;
    let highProbCount = 0;

    opportunities.forEach(opp => {
        const value = Number(opp.value) || 0;
        const prob = opp.probability || 0;

        totalValue += value;
        weightedValue += value * (prob / 100);

        if (prob > 70) highProbCount++;
    });

    return {
        totalValue,
        weightedValue,
        insight: `Forecast is ${(weightedValue / totalValue * 100).toFixed(1)}% of pipeline. ${highProbCount} deals are contributing significantly.`
    };
}

// Epic 9: Agent Framework - State Machine
export type AgentState = 'IDLE' | 'REASONING' | 'PROPOSING' | 'EXECUTING' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED';

export class AgentTask {
    id: string;
    state: AgentState;
    riskLevel: 'Low' | 'Medium' | 'High';

    constructor(id: string, risk: 'Low' | 'Medium' | 'High') {
        this.id = id;
        this.state = 'IDLE';
        this.riskLevel = risk;
    }

    transition(newState: AgentState, userApproved: boolean = false): AgentState {
        // Epic 9 Governance Check
        if (newState === 'EXECUTING' && this.riskLevel === 'High' && !userApproved) {
            console.log(`[Governance] Blocked High Risk Action on Task ${this.id}. Requesting Approval.`);
            this.state = 'AWAITING_APPROVAL';
            return 'AWAITING_APPROVAL';
        }

        this.state = newState;
        return newState;
    }
}
