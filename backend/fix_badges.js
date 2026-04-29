const fs = require('fs');
const path = 'd:/Opportunity/Jaydeep_work/agentic-crm/app/dashboard/opportunities/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const badgeHelpers = `
    const getBadgeText = () => {
        if (isStalled) return 'On Hold';
        if (isLost) return currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost';
        if (detailedStatus === 'Sent for Re-estimate') return 'Sent for Re-estimate';
        if (detailedStatus === 'Estimation Submitted') return 'Estimation Submitted';
        if (opportunityStage === 3) return 'SOW Approved';
        if (opportunityStage >= 2) return currentStageName === 'Negotiation' ? 'Under Negotiation' : 'Proposal Submitted';
        return 'Estimation in Progress';
    };

    const getBadgeClass = () => {
        if (isStalled) return 'bg-amber-100 text-amber-800 border-amber-300';
        if (isLost) return 'bg-red-50 text-red-700 border-red-200';
        if (detailedStatus === 'Sent for Re-estimate') return 'bg-rose-50 text-rose-700 border-rose-200';
        if (detailedStatus === 'Estimation Submitted') return 'bg-blue-50 text-blue-700 border-blue-200';
        if (opportunityStage === 3) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (opportunityStage >= 2) return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    };
    
    // Helper for currency symbol
`;

content = content.replace('    // Helper for currency symbol', badgeHelpers);

content = content.replace(
    /\{\s*isLost \? \(currentStageName === 'Proposal Lost' \? 'Proposal Lost' : 'Closed Lost'\) : opportunityStage === 3 \? 'SOW Approved' : opportunityStage >= 2 \? \(currentStageName === 'Negotiation' \? 'Under Negotiation' : 'Proposal Submitted'\) : 'Estimation in Progress'\s*\}/g,
    '{getBadgeText()}'
);

content = content.replace(
    /\{\s*isLost \? \(currentStageName === 'Proposal Lost' \? 'Proposal Lost' : 'Closed Lost'\) : opportunityStage >= 2 \? \(currentStageName \|\| 'Sales'\) : 'Estimation in Progress'\s*\}/g,
    '{getBadgeText()}'
);

content = content.replace(
    /className=\{\`px-3 py-1 rounded-full text-xs font-bold border \$\{isLost \? 'bg-red-50 text-red-700 border-red-200' : opportunityStage === 3 \? 'bg-emerald-50 text-emerald-700 border-emerald-200' : opportunityStage >= 2 \? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-600 border-cyan-100'\}\`\}/g,
    'className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}'
);

content = content.replace(
    /className=\{\`px-3 py-1 rounded-full text-xs font-bold border \$\{isLost \? 'bg-red-50 text-red-700 border-red-200' : opportunityStage >= 2 \? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-600 border-cyan-100'\}\`\}/g,
    'className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}'
);

content = content.replace(
    /<span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-600 text-xs font-bold border border-cyan-100">\s*Estimation in Progress\s*<\/span>/g,
    '<span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}>{getBadgeText()}</span>'
);

content = content.replace(
    /<span className="px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold border border-blue-200">\s*Estimation in Progress\s*<\/span>/g,
    '<span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}>{getBadgeText()}</span>'
);

fs.writeFileSync(path, content);
console.log('Done replacing badges');
