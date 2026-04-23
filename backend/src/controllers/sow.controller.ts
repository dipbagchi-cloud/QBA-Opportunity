import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

// ============================================================================
// SOW DOCUMENT CRUD
// ============================================================================

export async function getSowDocument(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        template: { include: { anchorMappings: true } },
        approvals: { orderBy: { requestedAt: 'desc' } },
        exports: { orderBy: { exportedAt: 'desc' }, take: 5 },
        generationRuns: { orderBy: { createdAt: 'desc' }, take: 10 },
        versions: { orderBy: { createdAt: 'desc' } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!doc) {
      return res.json({ document: null });
    }

    res.json({ document: doc });
  } catch (error: any) {
    console.error('Error fetching SOW document:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function createSowDocument(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const user = (req as any).user;
    const { templateId, documentTitle, documentType, serviceCategory, deliveryModel, methodology } = req.body;

    // Check if document already exists
    const existing = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (existing) {
      return res.status(400).json({ error: 'SOW document already exists for this opportunity' });
    }

    // Get opportunity data for context
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: true },
    });
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    // Generate document number
    const docNumber = await generateDocumentNumber();

    // Get section rules to create initial sections
    const sectionRules = await prisma.sowSectionRule.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    // Create document with initial sections
    const doc = await prisma.sowDocument.create({
      data: {
        opportunityId,
        documentNumber: docNumber,
        documentTitle: documentTitle || `SOW - ${opportunity.title}`,
        templateId,
        documentType,
        serviceCategory,
        deliveryModel,
        methodology,
        createdById: user.id,
        status: 'Not Started',
        version: '0.1',
        versionLabel: 'Initial',
        sections: {
          create: sectionRules.map((rule) => ({
            sectionKey: rule.sectionKey,
            title: rule.title,
            sortOrder: rule.sortOrder,
            sourceType: rule.sourceType,
            isLocked: rule.isLocked,
            templateAnchor: rule.templateAnchor,
          })),
        },
      },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        template: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        entity: 'SowDocument',
        entityId: doc.id,
        action: 'CREATE',
        changes: { opportunityId, documentNumber: docNumber },
        userId: user.id,
      },
    });

    res.status(201).json({ document: doc });
  } catch (error: any) {
    console.error('Error creating SOW document:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function updateSowDocument(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const user = (req as any).user;
    const updates = req.body;

    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) {
      return res.status(404).json({ error: 'SOW document not found' });
    }

    // Only allow updating certain fields
    const allowedFields = [
      'templateId', 'documentTitle', 'dealNotes', 'customAssumptions',
      'specialExclusions', 'documentType', 'serviceCategory', 'deliveryModel',
      'methodology', 'supportModel', 'pricingModelSow', 'jurisdictionVariant',
    ];

    const filteredUpdates: any = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const updated = await prisma.sowDocument.update({
      where: { opportunityId },
      data: filteredUpdates,
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        template: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SowDocument',
        entityId: doc.id,
        action: 'UPDATE',
        changes: filteredUpdates,
        userId: user.id,
      },
    });

    res.json({ document: updated });
  } catch (error: any) {
    console.error('Error updating SOW document:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW SECTIONS
// ============================================================================

export async function updateSowSection(req: Request, res: Response) {
  try {
    const { opportunityId, sectionKey } = req.params;
    const user = (req as any).user;
    const { editedContent, isLocked } = req.body;

    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) {
      return res.status(404).json({ error: 'SOW document not found' });
    }

    const section = await prisma.sowSection.findUnique({
      where: { documentId_sectionKey: { documentId: doc.id, sectionKey } },
    });
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    if (section.isLocked && isLocked !== false) {
      return res.status(400).json({ error: 'Section is locked and cannot be edited' });
    }

    const updateData: any = {
      lastEditedBy: user.id,
      lastEditedAt: new Date(),
      contentVersion: section.contentVersion + 1,
    };

    if (editedContent !== undefined) {
      updateData.editedContent = editedContent;
      updateData.finalContent = editedContent; // User edit becomes final
      updateData.isStale = false;
      updateData.staleReason = null;
    }

    if (isLocked !== undefined) {
      updateData.isLocked = isLocked;
    }

    const updated = await prisma.sowSection.update({
      where: { documentId_sectionKey: { documentId: doc.id, sectionKey } },
      data: updateData,
    });

    // Update document status if needed
    if (doc.status === 'Not Started' || doc.status === 'AI Generated') {
      await prisma.sowDocument.update({
        where: { id: doc.id },
        data: { status: 'Drafting' },
      });
    }

    await prisma.auditLog.create({
      data: {
        entity: 'SowSection',
        entityId: updated.id,
        action: 'EDIT',
        changes: { sectionKey, editedContent: editedContent ? '[content updated]' : undefined, isLocked },
        userId: user.id,
      },
    });

    res.json({ section: updated });
  } catch (error: any) {
    console.error('Error updating SOW section:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function lockSowSection(req: Request, res: Response) {
  try {
    const { opportunityId, sectionKey } = req.params;
    const user = (req as any).user;
    const { locked } = req.body;

    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    const updated = await prisma.sowSection.update({
      where: { documentId_sectionKey: { documentId: doc.id, sectionKey } },
      data: { isLocked: locked },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SowSection',
        entityId: updated.id,
        action: locked ? 'LOCK' : 'UNLOCK',
        changes: { sectionKey, locked },
        userId: user.id,
      },
    });

    res.json({ section: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// READINESS ENGINE
// ============================================================================

export async function getReadiness(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: true, attachments: true },
    });
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: { sections: true, template: { include: { anchorMappings: true } } },
    });

    const readiness = computeReadiness(opportunity, doc);

    // Save readiness to document if exists
    if (doc) {
      await prisma.sowDocument.update({
        where: { id: doc.id },
        data: { readinessScore: readiness.score, readinessData: readiness as any },
      });
    }

    res.json({ readiness });
  } catch (error: any) {
    console.error('Error computing readiness:', error);
    res.status(500).json({ error: error.message });
  }
}

function computeReadiness(opportunity: any, doc: any) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];
  let totalPoints = 0;
  let earnedPoints = 0;

  // --- Opportunity completeness (25 points) ---
  totalPoints += 25;
  const oppFields = ['title', 'description', 'value', 'currency'];
  const oppPresent = oppFields.filter((f) => opportunity[f]);
  earnedPoints += Math.round((oppPresent.length / oppFields.length) * 15);
  if (!opportunity.title) blockers.push('Opportunity title is missing');
  if (!opportunity.description) warnings.push('Opportunity description is empty');
  if (!opportunity.value || Number(opportunity.value) === 0) blockers.push('Opportunity value is missing');

  // Client info
  if (opportunity.client?.name) earnedPoints += 5;
  else blockers.push('Client name is missing');
  if (opportunity.client?.country) earnedPoints += 3;
  else missingData.push('Client country');
  if (opportunity.client?.location) earnedPoints += 2;
  else missingData.push('Client location');

  // --- Presales completeness (25 points) ---
  totalPoints += 25;
  const presales = opportunity.presalesData;
  if (presales) {
    const resourceLines = presales.resourceLines || presales.resources || [];
    if (resourceLines.length > 0) earnedPoints += 15;
    else warnings.push('No resource lines in estimation');

    if (presales.gomResult || presales.gomPercent) earnedPoints += 5;
    else missingData.push('GOM calculation');

    if (opportunity.gomApproved) earnedPoints += 5;
    else warnings.push('GOM not yet approved');
  } else {
    blockers.push('No presales/estimation data available');
  }

  // --- Commercial completeness (25 points) ---
  totalPoints += 25;
  if (opportunity.pricingModel) { earnedPoints += 5; }
  else missingData.push('Pricing model');
  if (opportunity.expectedDayRate && Number(opportunity.expectedDayRate) > 0) { earnedPoints += 5; }
  else missingData.push('Expected day rate');
  if (opportunity.tentativeStartDate) { earnedPoints += 5; }
  else missingData.push('Tentative start date');
  if (opportunity.tentativeDuration) { earnedPoints += 5; }
  else missingData.push('Tentative duration');
  if (opportunity.technology) { earnedPoints += 3; }
  else missingData.push('Technology stack');
  if (opportunity.region) { earnedPoints += 2; }
  else missingData.push('Region/geography');

  // --- SOW-specific completeness (25 points) ---
  totalPoints += 25;
  if (doc) {
    earnedPoints += 5; // Document exists
    if (doc.templateId) earnedPoints += 5;
    else warnings.push('No template selected');
    if (doc.documentType) earnedPoints += 3;
    if (doc.deliveryModel) earnedPoints += 3;
    if (doc.methodology) earnedPoints += 2;

    // Check sections generated
    const sections = doc.sections || [];
    const withContent = sections.filter((s: any) => s.generatedContent || s.editedContent || s.finalContent);
    if (sections.length > 0) {
      const sectionPct = withContent.length / sections.length;
      earnedPoints += Math.round(sectionPct * 7);
    }
  } else {
    missingData.push('SOW document not created');
  }

  const score = Math.round((earnedPoints / totalPoints) * 100);

  // Stale content check
  const staleWarnings: string[] = [];
  if (doc?.sections) {
    for (const section of doc.sections) {
      if (section.isStale) {
        staleWarnings.push(`Section "${section.title}" is stale: ${section.staleReason || 'source data changed'}`);
      }
    }
  }

  return {
    score,
    totalPoints,
    earnedPoints,
    blockers,
    warnings,
    missingData,
    staleWarnings,
    breakdown: {
      opportunity: Math.round((oppPresent.length / oppFields.length) * 100),
      presales: presales ? 70 : 0,
      commercial: Math.round(((opportunity.pricingModel ? 1 : 0) + (opportunity.expectedDayRate ? 1 : 0) + (opportunity.tentativeStartDate ? 1 : 0)) / 3 * 100),
      sowSpecific: doc ? Math.round((earnedPoints - (totalPoints - 25)) / 25 * 100) : 0,
    },
  };
}

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

export async function createSowVersion(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const user = (req as any).user;
    const { version, versionLabel, changeNotes } = req.body;

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: { sections: true },
    });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    // Snapshot current sections
    const sectionsSnapshot = doc.sections.map((s) => ({
      sectionKey: s.sectionKey,
      title: s.title,
      finalContent: s.finalContent || s.editedContent || s.generatedContent,
      sourceType: s.sourceType,
    }));

    // Create version record
    const ver = await prisma.sowDocumentVersion.create({
      data: {
        documentId: doc.id,
        version: version || doc.version,
        versionLabel: versionLabel || doc.versionLabel,
        sectionsSnapshot: sectionsSnapshot as any,
        templateVersion: doc.templateId || undefined,
        changeNotes,
        createdBy: user.id,
      },
    });

    // Update document version
    if (version) {
      await prisma.sowDocument.update({
        where: { id: doc.id },
        data: { version, versionLabel },
      });
    }

    await prisma.auditLog.create({
      data: {
        entity: 'SowDocument',
        entityId: doc.id,
        action: 'VERSION_CREATE',
        changes: { version, versionLabel, changeNotes },
        userId: user.id,
      },
    });

    res.status(201).json({ version: ver });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function listSowVersions(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    const versions = await prisma.sowDocumentVersion.findMany({
      where: { documentId: doc.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ versions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW APPROVAL WORKFLOW
// ============================================================================

export async function submitForReview(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const user = (req as any).user;
    const { comments } = req.body;

    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    // Get configured approval steps
    const approvalSteps = await prisma.sowApprovalConfig.findMany({
      where: { isActive: true },
      orderBy: { stepOrder: 'asc' },
    });

    // Create approval for first required step
    const firstStep = approvalSteps.find((s) => s.isRequired) || approvalSteps[0];
    if (firstStep) {
      await prisma.sowApproval.create({
        data: {
          documentId: doc.id,
          type: firstStep.stepType,
          status: 'Pending',
          version: doc.version,
          requesterId: user.id,
          comments,
        },
      });
    }

    await prisma.sowDocument.update({
      where: { id: doc.id },
      data: { status: 'In Review' },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SowDocument',
        entityId: doc.id,
        action: 'SUBMIT_FOR_REVIEW',
        changes: { version: doc.version, comments },
        userId: user.id,
      },
    });

    res.json({ success: true, status: 'In Review' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function reviewSowApproval(req: Request, res: Response) {
  try {
    const { opportunityId, approvalId } = req.params;
    const user = (req as any).user;
    const { action, comments } = req.body; // action: "approve" | "reject"

    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    const approval = await prisma.sowApproval.update({
      where: { id: approvalId },
      data: {
        status: action === 'approve' ? 'Approved' : 'Rejected',
        comments,
        reviewerId: user.id,
        reviewedAt: new Date(),
      },
    });

    // Check if all required approvals are complete
    if (action === 'approve') {
      const pendingApprovals = await prisma.sowApproval.count({
        where: { documentId: doc.id, status: 'Pending' },
      });

      if (pendingApprovals === 0) {
        // Check if there are more approval steps to create
        const approvalSteps = await prisma.sowApprovalConfig.findMany({
          where: { isActive: true },
          orderBy: { stepOrder: 'asc' },
        });

        const existingTypes = await prisma.sowApproval.findMany({
          where: { documentId: doc.id },
          select: { type: true },
        });
        const existingTypeSet = new Set(existingTypes.map((a) => a.type));
        const nextStep = approvalSteps.find((s) => s.isRequired && !existingTypeSet.has(s.stepType));

        if (nextStep) {
          await prisma.sowApproval.create({
            data: {
              documentId: doc.id,
              type: nextStep.stepType,
              status: 'Pending',
              version: doc.version,
              requesterId: user.id,
            },
          });
        } else {
          // All approvals complete
          await prisma.sowDocument.update({
            where: { id: doc.id },
            data: { status: 'Approved Internally' },
          });
        }
      }
    } else {
      // Rejected
      await prisma.sowDocument.update({
        where: { id: doc.id },
        data: { status: 'Revision Requested' },
      });
    }

    await prisma.auditLog.create({
      data: {
        entity: 'SowApproval',
        entityId: approval.id,
        action: action === 'approve' ? 'APPROVE' : 'REJECT',
        changes: { type: approval.type, comments },
        userId: user.id,
      },
    });

    res.json({ approval });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateSowStatus(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const user = (req as any).user;
    const { status } = req.body;

    const validStatuses = [
      'Not Started', 'Drafting', 'AI Generated', 'In Review', 'Requires Inputs',
      'Approved Internally', 'Shared with Client', 'Revision Requested', 'Finalized', 'Signed / Archived',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    const updated = await prisma.sowDocument.update({
      where: { id: doc.id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SowDocument',
        entityId: doc.id,
        action: 'STATUS_CHANGE',
        changes: { from: doc.status, to: status },
        userId: user.id,
      },
    });

    res.json({ document: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// STALE DETECTION
// ============================================================================

export async function checkStaleState(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: true },
    });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: { sections: true },
    });
    if (!doc) return res.json({ stale: false, sections: [] });

    // Compute current source data hash
    const currentHash = computeSourceHash(opportunity);
    const isStale = doc.sourceDataHash !== null && doc.sourceDataHash !== currentHash;

    const staleSections: { sectionKey: string; reason: string }[] = [];

    if (isStale && doc.sourceDataHash) {
      // Mark sections that depend on changed data
      const presalesChanged = JSON.stringify(opportunity.presalesData) !== doc.sourceDataHash;
      const commercialsChanged = opportunity.value?.toString() !== doc.sourceDataHash;

      const presalesSections = ['resource_plan', 'delivery_plan_and_timeline', 'technology_stack', 'proposed_solution'];
      const commercialsSections = ['commercials', 'milestone_and_payment_terms'];
      const scopeSections = ['scope_of_work', 'business_objective', 'project_summary'];

      for (const section of doc.sections) {
        if (presalesSections.includes(section.sectionKey)) {
          staleSections.push({ sectionKey: section.sectionKey, reason: 'Presales/estimation data changed' });
        }
        if (commercialsSections.includes(section.sectionKey)) {
          staleSections.push({ sectionKey: section.sectionKey, reason: 'Commercial data changed' });
        }
        if (scopeSections.includes(section.sectionKey) && isStale) {
          staleSections.push({ sectionKey: section.sectionKey, reason: 'Opportunity data changed' });
        }
      }

      // Update stale flags on sections
      for (const stale of staleSections) {
        await prisma.sowSection.update({
          where: { documentId_sectionKey: { documentId: doc.id, sectionKey: stale.sectionKey } },
          data: { isStale: true, staleReason: stale.reason },
        });
      }
    }

    res.json({ stale: isStale, currentHash, storedHash: doc.sourceDataHash, staleSections });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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

// ============================================================================
// HELPERS
// ============================================================================

async function generateDocumentNumber(): Promise<string> {
  // Get or create numbering config
  let config = await prisma.sowNumberingConfig.findFirst();
  if (!config) {
    config = await prisma.sowNumberingConfig.create({
      data: { prefix: 'SOW', separator: '-', includeYear: true, sequenceLength: 4, currentSequence: 0 },
    });
  }

  const nextSeq = config.currentSequence + 1;
  await prisma.sowNumberingConfig.update({
    where: { id: config.id },
    data: { currentSequence: nextSeq },
  });

  const year = new Date().getFullYear();
  const seqStr = String(nextSeq).padStart(config.sequenceLength, '0');
  return `${config.prefix}${config.separator}${config.includeYear ? year + config.separator : ''}${seqStr}`;
}
