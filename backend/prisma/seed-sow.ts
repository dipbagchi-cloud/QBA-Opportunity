import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SECTION_RULES = [
  { sectionKey: 'cover_page', title: 'Cover Page / Title', sortOrder: 1, sourceType: 'dynamic', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: false, templateAnchor: '{{COVER_PAGE}}' },
  { sectionKey: 'signatures_of_acceptance', title: 'Signatures of Acceptance', sortOrder: 2, sourceType: 'static', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: false, templateAnchor: '{{SIGNATURES}}' },
  { sectionKey: 'table_of_contents', title: 'Table of Contents', sortOrder: 3, sourceType: 'dynamic', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: false, templateAnchor: '{{TOC}}' },
  { sectionKey: 'document_control', title: 'Document Control', sortOrder: 4, sourceType: 'dynamic', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:DOCUMENT_CONTROL]]' },
  { sectionKey: 'purpose_of_document', title: 'Purpose of the Document', sortOrder: 5, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:PURPOSE_OF_DOCUMENT]]' },
  { sectionKey: 'qba_executive_summary', title: 'QBA Executive Summary', sortOrder: 6, sourceType: 'static', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: false, staticContentKey: 'qba_executive_summary', templateAnchor: '[[SECTION:QBA_EXECUTIVE_SUMMARY]]' },
  { sectionKey: 'project_summary', title: 'Project Summary', sortOrder: 7, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:PROJECT_SUMMARY]]' },
  { sectionKey: 'business_objective', title: 'Business Objective', sortOrder: 8, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:BUSINESS_OBJECTIVE]]' },
  { sectionKey: 'scope_of_work', title: 'Scope Of Work', sortOrder: 9, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, requiresApproval: true, templateAnchor: '[[SECTION:SCOPE_OF_WORK]]' },
  { sectionKey: 'deliverables_by_client', title: 'Deliverables by Client', sortOrder: 10, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:DELIVERABLES_BY_CLIENT]]' },
  { sectionKey: 'proposed_solution', title: 'Proposed Solution', sortOrder: 11, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:PROPOSED_SOLUTION]]' },
  { sectionKey: 'delivery_plan_and_timeline', title: 'Delivery Plan and Timeline', sortOrder: 12, sourceType: 'hybrid', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:DELIVERY_PLAN_AND_TIMELINE]]' },
  { sectionKey: 'technology_stack', title: 'Technology Stack', sortOrder: 13, sourceType: 'dynamic', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:TECHNOLOGY_STACK]]' },
  { sectionKey: 'resource_plan', title: 'Resource Plan', sortOrder: 14, sourceType: 'dynamic', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:RESOURCE_PLAN]]' },
  { sectionKey: 'commercials', title: 'Commercials', sortOrder: 15, sourceType: 'dynamic', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: true, requiresApproval: true, templateAnchor: '{{COMMERCIALS_TABLE}}' },
  { sectionKey: 'milestone_and_payment_terms', title: 'Milestone and Payment Terms', sortOrder: 16, sourceType: 'hybrid', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '{{MILESTONE_TABLE}}' },
  { sectionKey: 'out_of_scope', title: 'Out Of Scope', sortOrder: 17, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:OUT_OF_SCOPE]]' },
  { sectionKey: 'project_execution_methodology', title: 'Project Execution Methodology', sortOrder: 18, sourceType: 'ai', isRequired: false, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:PROJECT_EXECUTION_METHODOLOGY]]' },
  { sectionKey: 'change_request_management', title: 'Change Request Management', sortOrder: 19, sourceType: 'static', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: false, staticContentKey: 'change_request_management', templateAnchor: '[[SECTION:CHANGE_REQUEST_MANAGEMENT]]' },
  { sectionKey: 'post_production_support', title: 'Post-Production Support', sortOrder: 20, sourceType: 'static', isRequired: false, isEditable: true, isLocked: false, allowRegeneration: false, staticContentKey: 'post_production_support', templateAnchor: '[[SECTION:POST_PRODUCTION_SUPPORT]]' },
  { sectionKey: 'assumptions_and_risks', title: 'Assumptions and Risks', sortOrder: 21, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:ASSUMPTIONS_AND_RISKS]]' },
  { sectionKey: 'acceptance_criteria', title: 'Acceptance Criteria', sortOrder: 22, sourceType: 'ai', isRequired: true, isEditable: true, isLocked: false, allowRegeneration: true, templateAnchor: '[[SECTION:ACCEPTANCE_CRITERIA]]' },
  { sectionKey: 'confidentiality', title: 'Confidentiality', sortOrder: 23, sourceType: 'static', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: false, staticContentKey: 'confidentiality', templateAnchor: '[[SECTION:CONFIDENTIALITY]]' },
  { sectionKey: 'other_terms', title: 'Other Terms', sortOrder: 24, sourceType: 'static', isRequired: true, isEditable: false, isLocked: true, allowRegeneration: false, staticContentKey: 'other_terms', templateAnchor: '[[SECTION:OTHER_TERMS]]' },
  { sectionKey: 'annexures', title: 'Annexures', sortOrder: 25, sourceType: 'dynamic', isRequired: false, isEditable: true, isLocked: false, allowRegeneration: false, templateAnchor: '{{ANNEXURES}}' },
];

const DEFAULT_METADATA_CATEGORIES = [
  { key: 'document_types', name: 'Document Types' },
  { key: 'service_categories', name: 'Service Categories' },
  { key: 'project_types', name: 'Project Types' },
  { key: 'delivery_models', name: 'Delivery Models' },
  { key: 'methodologies', name: 'Methodologies' },
  { key: 'support_models', name: 'Support Models' },
  { key: 'pricing_models', name: 'Pricing / Commercial Models' },
  { key: 'milestone_types', name: 'Milestone Types' },
  { key: 'payment_term_types', name: 'Payment Term Types' },
  { key: 'risk_categories', name: 'Risk Categories' },
  { key: 'assumption_categories', name: 'Assumption Categories' },
  { key: 'exclusion_categories', name: 'Exclusion Categories' },
  { key: 'clause_tags', name: 'Clause Tags' },
  { key: 'annexure_types', name: 'Annexure Types' },
  { key: 'signatory_roles', name: 'Signatory Roles' },
  { key: 'reviewer_types', name: 'Reviewer Types' },
];

const DEFAULT_APPROVAL_STEPS = [
  { stepOrder: 1, stepType: 'presales_review', stepLabel: 'Presales / Delivery Review', isRequired: true, reviewerRoles: ['Presales', 'Manager'] },
  { stepOrder: 2, stepType: 'sales_review', stepLabel: 'Sales Review', isRequired: true, reviewerRoles: ['Sales', 'Manager'] },
  { stepOrder: 3, stepType: 'manager_approval', stepLabel: 'Manager Approval', isRequired: true, reviewerRoles: ['Manager', 'Admin'] },
  { stepOrder: 4, stepType: 'finance_review', stepLabel: 'Finance Review', isRequired: false, reviewerRoles: ['Admin'] },
  { stepOrder: 5, stepType: 'legal_review', stepLabel: 'Legal Review', isRequired: false, reviewerRoles: ['Admin'] },
];

async function seedSowData() {
  console.log('Seeding SOW default data...');

  // Seed section rules
  for (const rule of DEFAULT_SECTION_RULES) {
    await prisma.sowSectionRule.upsert({
      where: { sectionKey: rule.sectionKey },
      update: rule,
      create: rule,
    });
  }
  console.log(`  ✓ Seeded ${DEFAULT_SECTION_RULES.length} section rules`);

  // Seed metadata categories
  for (const cat of DEFAULT_METADATA_CATEGORIES) {
    await prisma.sowMetadataCategory.upsert({
      where: { key: cat.key },
      update: { name: cat.name },
      create: { key: cat.key, name: cat.name, sortOrder: DEFAULT_METADATA_CATEGORIES.indexOf(cat) },
    });
  }
  console.log(`  ✓ Seeded ${DEFAULT_METADATA_CATEGORIES.length} metadata categories`);

  // Seed approval config
  for (const step of DEFAULT_APPROVAL_STEPS) {
    await prisma.sowApprovalConfig.upsert({
      where: { stepType: step.stepType },
      update: step,
      create: step,
    });
  }
  console.log(`  ✓ Seeded ${DEFAULT_APPROVAL_STEPS.length} approval steps`);

  // Seed numbering config if not exists
  const existing = await prisma.sowNumberingConfig.findFirst();
  if (!existing) {
    await prisma.sowNumberingConfig.create({
      data: { prefix: 'SOW', separator: '-', includeYear: true, sequenceLength: 4, currentSequence: 0 },
    });
    console.log('  ✓ Created default numbering config');
  }

  console.log('SOW seed complete!');
}

seedSowData()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
