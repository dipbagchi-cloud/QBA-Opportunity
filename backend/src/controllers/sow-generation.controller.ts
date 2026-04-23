import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import OpenAI from 'openai';
import crypto from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ============================================================================
// SOW AI GENERATION ENGINE
// ============================================================================

// Section configuration for generation behavior
const SECTION_CONFIG: Record<string, {
  sourceType: 'static' | 'dynamic' | 'ai' | 'hybrid';
  dataDependencies: string[];
  prompt: string;
}> = {
  cover_page: { sourceType: 'dynamic', dataDependencies: ['opportunity', 'client'], prompt: '' },
  signatures_of_acceptance: { sourceType: 'static', dataDependencies: [], prompt: '' },
  table_of_contents: { sourceType: 'dynamic', dataDependencies: [], prompt: '' },
  document_control: { sourceType: 'dynamic', dataDependencies: ['opportunity', 'document'], prompt: '' },
  purpose_of_document: {
    sourceType: 'ai', dataDependencies: ['opportunity', 'client'],
    prompt: 'Write a formal "Purpose of the Document" section for an SOW. Explain that this document defines the scope, deliverables, timelines and commercial terms for the engagement between QBA (QBAdvisory) and the client. Keep it concise (2-3 paragraphs). Use formal business language.',
  },
  qba_executive_summary: { sourceType: 'static', dataDependencies: [], prompt: '' },
  project_summary: {
    sourceType: 'ai', dataDependencies: ['opportunity', 'client', 'presales'],
    prompt: 'Write a formal "Project Summary" section for an SOW. Summarize the project including the client name, project objectives, high-level scope, engagement model, tentative timeline, and team size. Use formal proposal language. 2-4 paragraphs.',
  },
  business_objective: {
    sourceType: 'ai', dataDependencies: ['opportunity', 'client'],
    prompt: 'Write a formal "Business Objective" section. Describe the business goals and objectives the client aims to achieve through this engagement. If specific objectives are available in the data, highlight them. Otherwise, draft general objectives aligned with the project type and technology. 2-3 paragraphs.',
  },
  scope_of_work: {
    sourceType: 'ai', dataDependencies: ['opportunity', 'presales', 'client'],
    prompt: 'Write a detailed "Scope of Work" section for an SOW. Cover the key activities, deliverables, and work streams. Organize into numbered items or sub-sections. Be specific but do not invent features or capabilities not supported by the data. If data is insufficient, insert [SCOPE ITEM TO BE DEFINED] placeholders. 3-6 paragraphs.',
  },
  deliverables_by_client: {
    sourceType: 'ai', dataDependencies: ['opportunity'],
    prompt: 'Write a "Deliverables by Client" section listing what the client needs to provide for project success. Include items like access to systems, stakeholder availability, data/content, test environments, timely feedback, and approvals. Format as a numbered list. 8-15 items.',
  },
  proposed_solution: {
    sourceType: 'ai', dataDependencies: ['opportunity', 'presales'],
    prompt: 'Write a "Proposed Solution" section describing the technical and functional solution approach. Reference the technology stack and methodology where available. Describe the architecture approach, key components, and integration points. 3-5 paragraphs.',
  },
  delivery_plan_and_timeline: {
    sourceType: 'hybrid', dataDependencies: ['opportunity', 'presales'],
    prompt: 'Write a "Delivery Plan and Timeline" section. Include the overall project duration, key phases (Discovery, Design, Development, Testing, Deployment, Hypercare), and tentative timeline. If specific dates are available, use them. Format phases as a table or structured list with Phase, Duration, and Key Activities.',
  },
  technology_stack: {
    sourceType: 'dynamic', dataDependencies: ['opportunity', 'presales'],
    prompt: '',
  },
  resource_plan: {
    sourceType: 'dynamic', dataDependencies: ['presales'],
    prompt: '',
  },
  commercials: {
    sourceType: 'dynamic', dataDependencies: ['opportunity', 'presales', 'sales'],
    prompt: '',
  },
  milestone_and_payment_terms: {
    sourceType: 'hybrid', dataDependencies: ['opportunity', 'presales'],
    prompt: 'Write a "Milestone and Payment Terms" section. Generate a milestone-based payment schedule aligned with the project phases and timeline. Include milestone name, expected completion, deliverable, and payment percentage. Ensure payment percentages total 100%.',
  },
  out_of_scope: {
    sourceType: 'ai', dataDependencies: ['opportunity', 'presales'],
    prompt: 'Write an "Out of Scope" section listing items explicitly excluded from this engagement. Based on the project type and scope, list 8-12 common exclusions. Format as a numbered list. Include items like third-party license costs, hardware procurement, data migration of legacy systems, ongoing BAU support beyond the hypercare period, etc.',
  },
  project_execution_methodology: {
    sourceType: 'ai', dataDependencies: ['opportunity'],
    prompt: 'Write a "Project Execution Methodology" section describing the development methodology (Agile, Waterfall, Hybrid) to be used. Describe the sprint cadence, ceremonies, reporting structure, and governance model. 2-4 paragraphs.',
  },
  change_request_management: { sourceType: 'static', dataDependencies: [], prompt: '' },
  post_production_support: { sourceType: 'static', dataDependencies: [], prompt: '' },
  assumptions_and_risks: {
    sourceType: 'ai', dataDependencies: ['opportunity', 'presales', 'client'],
    prompt: 'Write an "Assumptions and Risks" section. Part 1: List 10-15 key assumptions (e.g., client availability, scope stability, access to environments, etc.). Part 2: List 5-8 key risks with impact and mitigation. Format assumptions as a numbered list. Format risks as a table with Risk, Impact, Probability, Mitigation.',
  },
  acceptance_criteria: {
    sourceType: 'ai', dataDependencies: ['opportunity'],
    prompt: 'Write an "Acceptance Criteria" section defining how deliverables will be accepted. Include the review process, acceptance timeline, defect resolution process, and formal sign-off requirements. 2-3 paragraphs plus a numbered list of acceptance steps.',
  },
  confidentiality: { sourceType: 'static', dataDependencies: [], prompt: '' },
  other_terms: { sourceType: 'static', dataDependencies: [], prompt: '' },
  annexures: { sourceType: 'dynamic', dataDependencies: ['opportunity', 'presales'], prompt: '' },
};

// System prompt for all AI generations
const SYSTEM_PROMPT = `You are a professional SOW (Statement of Work) writer for QBAdvisory (QBA), a technology consulting firm.

RULES:
1. Write formal, professional business/proposal language
2. NEVER invent or fabricate: commercial values, timelines, resource counts, technology names, client commitments, or legal promises
3. If required data is missing, insert a clear placeholder like [TO BE DEFINED] or [CLIENT TO CONFIRM]
4. NEVER alter approved legal clauses or commercial terms
5. Use third person and passive voice where appropriate for formal documents
6. Do not add disclaimers or notes about being AI-generated
7. Structure content with clear headings, numbered lists, and tables where appropriate
8. Keep language crisp and avoid filler words
9. Reference the client by their actual name, not generic terms
10. All monetary values must exactly match the provided data - do not round or estimate`;

export async function generateFullDraft(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const user = (req as any).user;

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: { sections: true, template: { include: { anchorMappings: true } } },
    });
    if (!doc) return res.status(404).json({ error: 'SOW document not found. Create one first.' });

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: true },
    });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

    // Load static content and clauses
    const staticContent = await prisma.sowStaticContent.findMany({ where: { isActive: true } });
    const clauses = await prisma.sowClause.findMany({ where: { isActive: true } });
    const sectionRules = await prisma.sowSectionRule.findMany({ orderBy: { sortOrder: 'asc' } });

    // Build context data
    const context = buildContextData(opportunity);
    const startTime = Date.now();
    const generatedSections: { sectionKey: string; content: string }[] = [];

    for (const section of doc.sections) {
      // Skip locked sections
      if (section.isLocked) continue;

      const config = SECTION_CONFIG[section.sectionKey];
      const rule = sectionRules.find(r => r.sectionKey === section.sectionKey);

      let content = '';

      if (!config || config.sourceType === 'static') {
        // Use static content
        const staticKey = rule?.staticContentKey || section.sectionKey;
        const staticItem = staticContent.find(s => s.key === staticKey);
        if (staticItem) {
          content = staticItem.content;
        } else {
          // Check clauses
          const clauseKeyList = (rule?.clauseKeys || '').split(',').filter(Boolean);
          const matchingClauses = clauses.filter(c => clauseKeyList.includes(c.clauseKey) || c.defaultInclude);
          if (matchingClauses.length > 0) {
            content = matchingClauses.map(c => `### ${c.title}\n\n${c.text}`).join('\n\n');
          }
        }
      } else if (config.sourceType === 'dynamic') {
        content = generateDynamicContent(section.sectionKey, opportunity, context);
      } else if (config.sourceType === 'ai' || config.sourceType === 'hybrid') {
        content = await generateAIContent(section.sectionKey, config, context, opportunity);
      }

      if (content) {
        generatedSections.push({ sectionKey: section.sectionKey, content });
      }
    }

    // Batch update sections
    for (const gs of generatedSections) {
      await prisma.sowSection.update({
        where: { documentId_sectionKey: { documentId: doc.id, sectionKey: gs.sectionKey } },
        data: {
          generatedContent: gs.content,
          finalContent: gs.content,
          lastGeneratedAt: new Date(),
          isStale: false,
          staleReason: null,
        },
      });
    }

    const latencyMs = Date.now() - startTime;

    // Compute and store source data hash
    const sourceHash = computeSourceHash(opportunity);

    // Update document status
    await prisma.sowDocument.update({
      where: { id: doc.id },
      data: {
        status: 'AI Generated',
        lastGeneratedAt: new Date(),
        generationModel: 'gpt-4o-mini',
        sourceDataHash: sourceHash,
      },
    });

    // Log generation run
    await prisma.sowGenerationRun.create({
      data: {
        documentId: doc.id,
        runType: 'full_draft',
        sourceDataSnapshot: context as any,
        modelUsed: 'gpt-4o-mini',
        status: 'Completed',
        latencyMs,
        createdBy: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SowDocument',
        entityId: doc.id,
        action: 'GENERATE_FULL_DRAFT',
        changes: { sectionsGenerated: generatedSections.length, latencyMs },
        userId: user.id,
      },
    });

    // Re-fetch updated document
    const updated = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: { sections: { orderBy: { sortOrder: 'asc' } }, template: true },
    });

    res.json({ document: updated, generatedCount: generatedSections.length, latencyMs });
  } catch (error: any) {
    console.error('Error generating full draft:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function regenerateSection(req: Request, res: Response) {
  try {
    const { opportunityId, sectionKey } = req.params;
    const user = (req as any).user;

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: { sections: true },
    });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    const section = await prisma.sowSection.findUnique({
      where: { documentId_sectionKey: { documentId: doc.id, sectionKey } },
    });
    if (!section) return res.status(404).json({ error: 'Section not found' });

    if (section.isLocked) {
      return res.status(400).json({ error: 'Section is locked and cannot be regenerated' });
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: true },
    });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

    const context = buildContextData(opportunity);
    const config = SECTION_CONFIG[sectionKey];
    const startTime = Date.now();
    let content = '';

    if (!config || config.sourceType === 'static') {
      const staticItem = await prisma.sowStaticContent.findUnique({ where: { key: sectionKey } });
      content = staticItem?.content || '';
    } else if (config.sourceType === 'dynamic') {
      content = generateDynamicContent(sectionKey, opportunity, context);
    } else {
      content = await generateAIContent(sectionKey, config, context, opportunity);
    }

    const latencyMs = Date.now() - startTime;

    const updated = await prisma.sowSection.update({
      where: { documentId_sectionKey: { documentId: doc.id, sectionKey } },
      data: {
        generatedContent: content,
        finalContent: content,
        lastGeneratedAt: new Date(),
        isStale: false,
        staleReason: null,
        contentVersion: section.contentVersion + 1,
      },
    });

    await prisma.sowGenerationRun.create({
      data: {
        documentId: doc.id,
        runType: 'section',
        sectionKey,
        modelUsed: 'gpt-4o-mini',
        status: 'Completed',
        latencyMs,
        createdBy: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SowSection',
        entityId: updated.id,
        action: 'REGENERATE',
        changes: { sectionKey, latencyMs },
        userId: user.id,
      },
    });

    res.json({ section: updated, latencyMs });
  } catch (error: any) {
    console.error('Error regenerating section:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// AI CONTENT GENERATION
// ============================================================================

async function generateAIContent(
  sectionKey: string,
  config: typeof SECTION_CONFIG[string],
  context: any,
  opportunity: any
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackContent(sectionKey, context);
  }

  try {
    const dataContext = buildDataPrompt(config.dataDependencies, context);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${config.prompt}\n\n--- SOURCE DATA ---\n${dataContext}\n\nGenerate the section content now. Output only the section content, no meta-commentary.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content || generateFallbackContent(sectionKey, context);
  } catch (error) {
    console.error(`AI generation failed for ${sectionKey}:`, error);
    return generateFallbackContent(sectionKey, context);
  }
}

function generateFallbackContent(sectionKey: string, context: any): string {
  // Provide structured fallback when AI is unavailable
  const clientName = context.client?.name || '[CLIENT NAME]';
  const projectTitle = context.opportunity?.title || '[PROJECT TITLE]';
  const technology = context.opportunity?.technology || '[TECHNOLOGY]';
  const duration = context.opportunity?.tentativeDuration || '[DURATION]';
  const durationUnit = context.opportunity?.tentativeDurationUnit || 'months';

  const fallbacks: Record<string, string> = {
    purpose_of_document: `This Statement of Work ("SOW") defines the scope, deliverables, timelines, and commercial terms for the engagement between QBAdvisory ("QBA") and ${clientName} ("Client") for the ${projectTitle} project.\n\nThis document serves as the governing agreement for the delivery of services described herein and should be read in conjunction with the Master Services Agreement (MSA) between the parties, where applicable.\n\nAll terms, conditions, and commitments outlined in this SOW are subject to mutual agreement and formal acceptance by both parties.`,

    project_summary: `QBA proposes to deliver the ${projectTitle} engagement for ${clientName}. The project involves ${technology} implementation spanning approximately ${duration} ${durationUnit}.\n\n[PROJECT SUMMARY TO BE COMPLETED - Additional details about team size, engagement model, and key deliverables should be added based on presales estimation.]`,

    business_objective: `The primary business objective of this engagement is to enable ${clientName} to [BUSINESS OBJECTIVE TO BE DEFINED] through the implementation of ${technology} solutions.\n\nThe key objectives include:\n1. [OBJECTIVE 1 - TO BE DEFINED]\n2. [OBJECTIVE 2 - TO BE DEFINED]\n3. [OBJECTIVE 3 - TO BE DEFINED]`,

    scope_of_work: `The scope of this engagement includes the following work streams:\n\n1. **Discovery & Requirements Analysis**\n   - [SCOPE DETAILS TO BE DEFINED]\n\n2. **Design & Architecture**\n   - [SCOPE DETAILS TO BE DEFINED]\n\n3. **Development & Implementation**\n   - [SCOPE DETAILS TO BE DEFINED]\n\n4. **Testing & Quality Assurance**\n   - [SCOPE DETAILS TO BE DEFINED]\n\n5. **Deployment & Go-Live**\n   - [SCOPE DETAILS TO BE DEFINED]`,

    deliverables_by_client: `The following deliverables and responsibilities are expected from ${clientName}:\n\n1. Timely access to relevant systems, environments, and infrastructure\n2. Availability of key stakeholders for requirement discussions and reviews\n3. Provision of necessary data, content, and business rules\n4. Test environment setup and access credentials\n5. Timely review and feedback on deliverables (within 5 business days)\n6. Formal sign-off on completed milestones\n7. Identification of a single point of contact (SPOC) for project coordination\n8. Provision of VPN/network access for remote team members\n9. Availability of subject matter experts (SMEs) during knowledge transfer\n10. Timely resolution of queries and clarifications`,

    proposed_solution: `QBA proposes to implement the ${projectTitle} solution using ${technology}.\n\n[PROPOSED SOLUTION TO BE DETAILED - Include architecture overview, key components, technology choices, and integration approach based on presales estimation data.]`,

    delivery_plan_and_timeline: `The project is planned for a duration of ${duration} ${durationUnit}.\n\n| Phase | Duration | Key Activities |\n|-------|----------|----------------|\n| Discovery | [TBD] | Requirements gathering, stakeholder interviews |\n| Design | [TBD] | Technical architecture, UI/UX design |\n| Development | [TBD] | Sprint-based development |\n| Testing | [TBD] | QA, UAT, performance testing |\n| Deployment | [TBD] | Production deployment, go-live |\n| Hypercare | [TBD] | Post-go-live support |`,

    out_of_scope: `The following items are explicitly excluded from the scope of this engagement:\n\n1. Third-party software license procurement and costs\n2. Hardware infrastructure procurement\n3. Data migration from legacy systems (unless explicitly stated in scope)\n4. Ongoing BAU (Business As Usual) support beyond the hypercare period\n5. Training for end-users beyond the agreed training sessions\n6. Integration with systems not mentioned in the scope\n7. Performance optimization of existing systems\n8. Regulatory compliance audits\n9. Content creation and copywriting\n10. Changes to scope after formal sign-off (to be handled via Change Request process)`,

    project_execution_methodology: `QBA will follow an Agile development methodology for this engagement, with the following structure:\n\n**Sprint Cadence:** 2-week sprints\n**Key Ceremonies:**\n- Sprint Planning (Day 1 of each sprint)\n- Daily Stand-ups (15 minutes)\n- Sprint Review/Demo (Last day of each sprint)\n- Sprint Retrospective (Post-review)\n\n**Reporting:** Weekly status reports will be shared with project stakeholders covering progress, risks, and upcoming activities.\n\n**Governance:** A Steering Committee meeting will be conducted bi-weekly/monthly with senior stakeholders from both parties.`,

    assumptions_and_risks: `**Assumptions:**\n\n1. The client will provide timely access to required systems and environments\n2. Key stakeholders will be available for scheduled meetings and reviews\n3. Requirements will be finalized and signed-off before development begins\n4. The client will provide feedback within 5 business days of deliverable submission\n5. No significant changes to approved scope during development\n6. Network and VPN access will be provided for remote team members\n7. Testing environments will be provisioned by the client\n8. The client will handle internal change management and training\n9. All third-party dependencies will be resolved before project start\n10. Standard working hours (Monday to Friday) will be observed\n\n**Risks:**\n\n| Risk | Impact | Probability | Mitigation |\n|------|--------|-------------|------------|\n| Scope creep | High | Medium | Change request process, regular scope reviews |\n| Resource unavailability | Medium | Low | Cross-training, backup resources |\n| Delayed client feedback | High | Medium | Escalation matrix, agreed SLAs |\n| Technology constraints | Medium | Low | POC during discovery, architecture reviews |\n| Integration challenges | High | Medium | Early integration testing, API documentation |`,

    acceptance_criteria: `Deliverables under this SOW will be accepted based on the following criteria:\n\n1. Deliverables must meet the requirements documented and signed-off during the respective phase\n2. All critical and high-severity defects must be resolved before acceptance\n3. The client will have 5 business days to review each deliverable\n4. Acceptance will be communicated via formal sign-off (email or document)\n5. If no feedback is received within the review period, the deliverable will be deemed accepted\n6. Disputed items will be escalated to the Steering Committee for resolution`,
  };

  return fallbacks[sectionKey] || `[${sectionKey.toUpperCase().replace(/_/g, ' ')} - CONTENT TO BE GENERATED]`;
}

// ============================================================================
// DYNAMIC CONTENT GENERATION
// ============================================================================

function generateDynamicContent(sectionKey: string, opportunity: any, context: any): string {
  switch (sectionKey) {
    case 'cover_page':
      return buildCoverPage(context);
    case 'document_control':
      return buildDocumentControl(context);
    case 'technology_stack':
      return buildTechnologyStack(context);
    case 'resource_plan':
      return buildResourcePlan(context);
    case 'commercials':
      return buildCommercials(context);
    case 'table_of_contents':
      return '[TABLE OF CONTENTS - Auto-generated in final document]';
    case 'annexures':
      return '[ANNEXURES - To be attached]';
    default:
      return '';
  }
}

function buildCoverPage(context: any): string {
  return `# ${context.opportunity?.title || '[PROJECT TITLE]'}

**Statement of Work**

**Prepared for:** ${context.client?.name || '[CLIENT NAME]'}
**Prepared by:** QBAdvisory (QBA)

**Document Version:** ${context.document?.version || '0.1'}
**Date:** ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}

**Classification:** Confidential`;
}

function buildDocumentControl(context: any): string {
  const today = new Date().toLocaleDateString('en-GB');
  return `| Field | Value |
|-------|-------|
| Document Title | ${context.opportunity?.title || '[PROJECT TITLE]'} - Statement of Work |
| Document Number | ${context.document?.documentNumber || '[DOC NUMBER]'} |
| Version | ${context.document?.version || '0.1'} |
| Status | ${context.document?.status || 'Draft'} |
| Date Created | ${today} |
| Client | ${context.client?.name || '[CLIENT NAME]'} |
| QBA Contact | ${context.opportunity?.salesRepName || '[SALES REP]'} |`;
}

function buildTechnologyStack(context: any): string {
  const techs = context.opportunity?.technology;
  if (!techs) return '[TECHNOLOGY STACK TO BE DEFINED]';

  const techList = typeof techs === 'string' ? techs.split(',').map((t: string) => t.trim()) : [techs];
  let content = 'The following technologies will be utilized in this engagement:\n\n';
  content += '| Category | Technology |\n|----------|------------|\n';
  techList.forEach((tech: string) => {
    content += `| Core Technology | ${tech} |\n`;
  });

  return content;
}

function buildResourcePlan(context: any): string {
  const presales = context.presales;
  if (!presales?.resourceLines || presales.resourceLines.length === 0) {
    return '[RESOURCE PLAN TO BE DEFINED - Presales estimation required]';
  }

  let content = '| Role | Location | Duration | Monthly Effort |\n|------|----------|----------|----------------|\n';
  for (const line of presales.resourceLines) {
    content += `| ${line.role || line.designation || '[Role]'} | ${line.location || 'Offshore'} | ${line.months || '[TBD]'} months | ${line.effortPerMonth || line.effort || '[TBD]'} |\n`;
  }

  return content;
}

function buildCommercials(context: any): string {
  const opp = context.opportunity;
  if (!opp) return '[COMMERCIALS TO BE DEFINED]';

  let content = `| Parameter | Value |\n|-----------|-------|\n`;
  content += `| Engagement Model | ${opp.pricingModel || '[PRICING MODEL]'} |\n`;
  content += `| Project Value | ${opp.currency || 'USD'} ${opp.value || '[VALUE]'} |\n`;
  if (opp.expectedDayRate) content += `| Day Rate | ${opp.currency || 'USD'} ${opp.expectedDayRate} |\n`;
  content += `| Duration | ${opp.tentativeDuration || '[DURATION]'} ${opp.tentativeDurationUnit || 'months'} |\n`;

  if (opp.adjustedEstimatedValue) {
    content += `| Adjusted Value | ${opp.currency || 'USD'} ${opp.adjustedEstimatedValue} |\n`;
  }

  return content;
}

// ============================================================================
// CONTEXT ASSEMBLY
// ============================================================================

function buildContextData(opportunity: any): any {
  return {
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      description: opportunity.description,
      value: opportunity.value?.toString(),
      currency: opportunity.currency,
      technology: opportunity.technology,
      region: opportunity.region,
      practice: opportunity.practice,
      projectType: opportunity.projectType,
      pricingModel: opportunity.pricingModel,
      expectedDayRate: opportunity.expectedDayRate?.toString(),
      tentativeStartDate: opportunity.tentativeStartDate?.toISOString(),
      tentativeDuration: opportunity.tentativeDuration,
      tentativeDurationUnit: opportunity.tentativeDurationUnit,
      tentativeEndDate: opportunity.tentativeEndDate?.toISOString(),
      salesRepName: opportunity.salesRepName,
      managerName: opportunity.managerName,
      currentStage: opportunity.currentStage,
    },
    client: opportunity.client ? {
      name: opportunity.client.name,
      industry: opportunity.client.industry,
      country: opportunity.client.country,
      location: opportunity.client.location,
      domain: opportunity.client.domain,
    } : null,
    presales: opportunity.presalesData || null,
    sales: opportunity.salesData || null,
  };
}

function buildDataPrompt(dependencies: string[], context: any): string {
  const parts: string[] = [];

  if (dependencies.includes('opportunity') && context.opportunity) {
    parts.push(`PROJECT DETAILS:
- Project Title: ${context.opportunity.title || 'N/A'}
- Description: ${context.opportunity.description || 'Not provided'}
- Technology: ${context.opportunity.technology || 'Not specified'}
- Region: ${context.opportunity.region || 'Not specified'}
- Project Type: ${context.opportunity.projectType || 'Not specified'}
- Pricing Model: ${context.opportunity.pricingModel || 'Not specified'}
- Value: ${context.opportunity.currency || 'USD'} ${context.opportunity.value || 'N/A'}
- Day Rate: ${context.opportunity.expectedDayRate || 'N/A'}
- Start Date: ${context.opportunity.tentativeStartDate || 'Not set'}
- Duration: ${context.opportunity.tentativeDuration || 'Not set'} ${context.opportunity.tentativeDurationUnit || ''}
- Sales Rep: ${context.opportunity.salesRepName || 'N/A'}
- Manager: ${context.opportunity.managerName || 'N/A'}`);
  }

  if (dependencies.includes('client') && context.client) {
    parts.push(`CLIENT DETAILS:
- Client Name: ${context.client.name || 'N/A'}
- Industry: ${context.client.industry || 'Not specified'}
- Country: ${context.client.country || 'Not specified'}
- Location: ${context.client.location || 'Not specified'}`);
  }

  if (dependencies.includes('presales') && context.presales) {
    const presales = context.presales;
    const resources = presales.resourceLines || presales.resources || [];
    let presalesText = 'PRESALES/ESTIMATION DATA:\n';
    if (resources.length > 0) {
      presalesText += `Total Resources: ${resources.length}\n`;
      resources.forEach((r: any, i: number) => {
        presalesText += `- Resource ${i + 1}: ${r.role || r.designation || 'N/A'}, Location: ${r.location || 'Offshore'}, Months: ${r.months || 'N/A'}\n`;
      });
    }
    if (presales.gomPercent) presalesText += `GOM%: ${presales.gomPercent}%\n`;
    if (presales.totalCost) presalesText += `Total Cost: ${presales.totalCost}\n`;
    if (presales.totalRevenue) presalesText += `Total Revenue: ${presales.totalRevenue}\n`;
    parts.push(presalesText);
  }

  if (dependencies.includes('sales') && context.sales) {
    parts.push(`SALES/COMMERCIAL DATA:\n${JSON.stringify(context.sales, null, 2)}`);
  }

  return parts.join('\n\n') || 'No data available.';
}

function computeSourceHash(opportunity: any): string {
  const data = {
    title: opportunity.title,
    description: opportunity.description,
    value: opportunity.value?.toString(),
    presalesData: opportunity.presalesData,
    salesData: opportunity.salesData,
    technology: opportunity.technology,
    pricingModel: opportunity.pricingModel,
    expectedDayRate: opportunity.expectedDayRate?.toString(),
    tentativeStartDate: opportunity.tentativeStartDate?.toISOString(),
    tentativeDuration: opportunity.tentativeDuration,
    client: opportunity.client ? { name: opportunity.client.name, country: opportunity.client.country } : null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
