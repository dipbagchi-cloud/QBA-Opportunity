import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ============================================================================
// SOW TEMPLATE MANAGEMENT
// ============================================================================

const TEMPLATE_UPLOAD_DIR = path.join(__dirname, '../../uploads/sow-templates');

// Ensure upload directory exists
if (!fs.existsSync(TEMPLATE_UPLOAD_DIR)) {
  fs.mkdirSync(TEMPLATE_UPLOAD_DIR, { recursive: true });
}

export const sowTemplateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMPLATE_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'template-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx and .doc files are allowed'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

export async function listSowTemplates(req: Request, res: Response) {
  try {
    const templates = await prisma.sowTemplate.findMany({
      include: { anchorMappings: true, _count: { select: { documents: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createSowTemplate(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Template file is required' });

    const { name, code, description, version, businessUnit, serviceLine, geography,
            projectType, legalEntity, isDefault } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Check code uniqueness
    const existing = await prisma.sowTemplate.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ error: 'Template code already exists' });
    }

    const template = await prisma.sowTemplate.create({
      data: {
        name,
        code,
        description,
        version: version || '1.0',
        businessUnit,
        serviceLine,
        geography,
        projectType,
        legalEntity,
        isDefault: isDefault === 'true' || isDefault === true,
        templateFilePath: file.path,
        templateFileName: file.originalname,
        templateFileSize: file.size,
        approvalStatus: 'Draft',
        createdBy: user.id,
      },
    });

    // If default, unset other defaults
    if (template.isDefault) {
      await prisma.sowTemplate.updateMany({
        where: { id: { not: template.id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    await prisma.auditLog.create({
      data: {
        entity: 'SowTemplate',
        entityId: template.id,
        action: 'CREATE',
        changes: { name, code },
        userId: user.id,
      },
    });

    res.status(201).json({ template });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateSowTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const file = req.file;
    const updates: any = {};

    const allowedFields = ['name', 'description', 'version', 'isActive', 'isDefault',
      'businessUnit', 'serviceLine', 'geography', 'projectType', 'legalEntity', 'approvalStatus'];

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        if (key === 'isActive' || key === 'isDefault') {
          updates[key] = req.body[key] === 'true' || req.body[key] === true;
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    if (file) {
      // Store old version
      const oldTemplate = await prisma.sowTemplate.findUnique({ where: { id } });
      if (oldTemplate) {
        await prisma.sowTemplateVersion.create({
          data: {
            templateId: id,
            version: oldTemplate.version,
            templateFilePath: oldTemplate.templateFilePath,
            templateFileName: oldTemplate.templateFileName,
            templateFileSize: oldTemplate.templateFileSize,
            changeNotes: req.body.changeNotes || 'Template file updated',
            createdBy: user.id,
          },
        });
      }

      updates.templateFilePath = file.path;
      updates.templateFileName = file.originalname;
      updates.templateFileSize = file.size;
    }

    if (updates.approvalStatus === 'Approved') {
      updates.approvedBy = user.id;
      updates.approvedAt = new Date();
    }

    const template = await prisma.sowTemplate.update({
      where: { id },
      data: updates,
    });

    if (template.isDefault) {
      await prisma.sowTemplate.updateMany({
        where: { id: { not: template.id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    await prisma.auditLog.create({
      data: {
        entity: 'SowTemplate',
        entityId: id,
        action: 'UPDATE',
        changes: updates,
        userId: user.id,
      },
    });

    res.json({ template });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteSowTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Check if in use
    const inUse = await prisma.sowDocument.count({ where: { templateId: id } });
    if (inUse > 0) {
      return res.status(400).json({ error: `Template is in use by ${inUse} documents. Deactivate instead.` });
    }

    await prisma.sowTemplate.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        entity: 'SowTemplate',
        entityId: id,
        action: 'DELETE',
        userId: user.id,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function downloadSowTemplate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const template = await prisma.sowTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    if (!fs.existsSync(template.templateFilePath)) {
      return res.status(404).json({ error: 'Template file not found on disk' });
    }

    res.download(template.templateFilePath, template.templateFileName);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// TEMPLATE ANCHOR MAPPINGS
// ============================================================================

export async function listTemplateAnchors(req: Request, res: Response) {
  try {
    const { templateId } = req.params;
    const anchors = await prisma.sowTemplateAnchor.findMany({
      where: { templateId },
      orderBy: { anchorKey: 'asc' },
    });
    res.json({ anchors });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function upsertTemplateAnchors(req: Request, res: Response) {
  try {
    const { templateId } = req.params;
    const user = (req as any).user;
    const { anchors } = req.body; // Array of anchor objects

    if (!Array.isArray(anchors)) {
      return res.status(400).json({ error: 'anchors must be an array' });
    }

    // Delete existing and recreate
    await prisma.sowTemplateAnchor.deleteMany({ where: { templateId } });

    const created = await Promise.all(
      anchors.map((anchor: any) =>
        prisma.sowTemplateAnchor.create({
          data: {
            templateId,
            anchorKey: anchor.anchorKey,
            anchorType: anchor.anchorType || 'token',
            sectionKey: anchor.sectionKey,
            description: anchor.description,
            isRequired: anchor.isRequired || false,
            fallbackText: anchor.fallbackText,
          },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        entity: 'SowTemplateAnchor',
        entityId: templateId,
        action: 'UPSERT_ANCHORS',
        changes: { count: created.length },
        userId: user.id,
      },
    });

    res.json({ anchors: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW METADATA CATEGORIES & VALUES
// ============================================================================

export async function listMetadataCategories(req: Request, res: Response) {
  try {
    const categories = await prisma.sowMetadataCategory.findMany({
      include: { values: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createMetadataCategory(req: Request, res: Response) {
  try {
    const { key, name, description, sortOrder } = req.body;
    if (!key || !name) return res.status(400).json({ error: 'key and name are required' });

    const category = await prisma.sowMetadataCategory.create({
      data: { key, name, description, sortOrder: sortOrder || 0 },
    });
    res.status(201).json({ category });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateMetadataCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, isActive, sortOrder } = req.body;

    const category = await prisma.sowMetadataCategory.update({
      where: { id },
      data: { name, description, isActive, sortOrder },
    });
    res.json({ category });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteMetadataCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.sowMetadataCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createMetadataValue(req: Request, res: Response) {
  try {
    const { categoryId } = req.params;
    const { value, label, description, isDefault, sortOrder, metadata } = req.body;
    if (!value || !label) return res.status(400).json({ error: 'value and label are required' });

    const metaValue = await prisma.sowMetadataValue.create({
      data: { categoryId, value, label, description, isDefault, sortOrder: sortOrder || 0, metadata },
    });
    res.status(201).json({ value: metaValue });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateMetadataValue(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { label, description, isActive, isDefault, sortOrder, metadata } = req.body;

    const metaValue = await prisma.sowMetadataValue.update({
      where: { id },
      data: { label, description, isActive, isDefault, sortOrder, metadata },
    });
    res.json({ value: metaValue });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteMetadataValue(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.sowMetadataValue.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW STATIC CONTENT LIBRARY
// ============================================================================

export async function listStaticContent(req: Request, res: Response) {
  try {
    const content = await prisma.sowStaticContent.findMany({ orderBy: { title: 'asc' } });
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createStaticContent(req: Request, res: Response) {
  try {
    const { key, title, content, category, version, businessUnit, serviceLine, legalEntity } = req.body;
    if (!key || !title || !content) return res.status(400).json({ error: 'key, title, and content are required' });

    const user = (req as any).user;
    const item = await prisma.sowStaticContent.create({
      data: { key, title, content, category, version, businessUnit, serviceLine, legalEntity, createdBy: user.id },
    });
    res.status(201).json({ content: item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateStaticContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { title, content, category, version, isActive, businessUnit, serviceLine, legalEntity } = req.body;

    const item = await prisma.sowStaticContent.update({
      where: { id },
      data: { title, content, category, version, isActive, businessUnit, serviceLine, legalEntity },
    });
    res.json({ content: item });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteStaticContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.sowStaticContent.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW CLAUSE LIBRARY
// ============================================================================

export async function listClauses(req: Request, res: Response) {
  try {
    const clauses = await prisma.sowClause.findMany({ orderBy: [{ category: 'asc' }, { title: 'asc' }] });
    res.json({ clauses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createClause(req: Request, res: Response) {
  try {
    const { category, clauseKey, title, text, version, isMandatory,
            industry, serviceLine, geography, jurisdiction, legalEntity,
            tags, defaultInclude } = req.body;

    if (!category || !clauseKey || !title || !text) {
      return res.status(400).json({ error: 'category, clauseKey, title, and text are required' });
    }

    const user = (req as any).user;
    const clause = await prisma.sowClause.create({
      data: {
        category, clauseKey, title, text, version, isMandatory,
        industry, serviceLine, geography, jurisdiction, legalEntity,
        tags, defaultInclude, createdBy: user.id,
      },
    });
    res.status(201).json({ clause });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateClause(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { title, text, version, isActive, isMandatory,
            industry, serviceLine, geography, jurisdiction, legalEntity,
            tags, defaultInclude } = req.body;

    const clause = await prisma.sowClause.update({
      where: { id },
      data: {
        title, text, version, isActive, isMandatory,
        industry, serviceLine, geography, jurisdiction, legalEntity,
        tags, defaultInclude,
      },
    });
    res.json({ clause });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteClause(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.sowClause.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW SECTION RULES
// ============================================================================

export async function listSectionRules(req: Request, res: Response) {
  try {
    const rules = await prisma.sowSectionRule.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ rules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createSectionRule(req: Request, res: Response) {
  try {
    const { sectionKey, title, sortOrder, isRequired, sourceType, isEditable, isLocked,
            allowRegeneration, requiresApproval, dataSources, staticContentKey,
            clauseKeys, fallbackBehavior, templateAnchor, description } = req.body;

    if (!sectionKey || !title) return res.status(400).json({ error: 'sectionKey and title are required' });

    const rule = await prisma.sowSectionRule.create({
      data: {
        sectionKey, title, sortOrder: sortOrder || 0, isRequired, sourceType,
        isEditable, isLocked, allowRegeneration, requiresApproval,
        dataSources, staticContentKey, clauseKeys, fallbackBehavior, templateAnchor, description,
      },
    });
    res.status(201).json({ rule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateSectionRule(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;

    const rule = await prisma.sowSectionRule.update({ where: { id }, data: updates });
    res.json({ rule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteSectionRule(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.sowSectionRule.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW APPROVAL CONFIGURATION
// ============================================================================

export async function listApprovalConfig(req: Request, res: Response) {
  try {
    const config = await prisma.sowApprovalConfig.findMany({ orderBy: { stepOrder: 'asc' } });
    res.json({ config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function upsertApprovalConfig(req: Request, res: Response) {
  try {
    const { steps } = req.body; // Array of step configs
    if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps must be an array' });

    // Delete existing and recreate
    await prisma.sowApprovalConfig.deleteMany({});

    const created = await Promise.all(
      steps.map((step: any, index: number) =>
        prisma.sowApprovalConfig.create({
          data: {
            stepOrder: index + 1,
            stepType: step.stepType,
            stepLabel: step.stepLabel,
            isRequired: step.isRequired !== false,
            reviewerRoles: step.reviewerRoles || [],
            escalationHours: step.escalationHours,
            isActive: step.isActive !== false,
          },
        })
      )
    );

    res.json({ config: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// SOW NUMBERING CONFIG
// ============================================================================

export async function getNumberingConfig(req: Request, res: Response) {
  try {
    let config = await prisma.sowNumberingConfig.findFirst();
    if (!config) {
      config = await prisma.sowNumberingConfig.create({
        data: { prefix: 'SOW', separator: '-', includeYear: true, sequenceLength: 4, currentSequence: 0 },
      });
    }
    res.json({ config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateNumberingConfig(req: Request, res: Response) {
  try {
    const { prefix, separator, includeYear, sequenceLength, filenamePattern,
            draftVersionPrefix, approvedVersionStart } = req.body;

    let config = await prisma.sowNumberingConfig.findFirst();
    if (!config) {
      config = await prisma.sowNumberingConfig.create({
        data: { prefix: 'SOW', separator: '-', includeYear: true, sequenceLength: 4, currentSequence: 0 },
      });
    }

    const updated = await prisma.sowNumberingConfig.update({
      where: { id: config.id },
      data: {
        prefix: prefix ?? config.prefix,
        separator: separator ?? config.separator,
        includeYear: includeYear ?? config.includeYear,
        sequenceLength: sequenceLength ?? config.sequenceLength,
        filenamePattern: filenamePattern ?? config.filenamePattern,
        draftVersionPrefix: draftVersionPrefix ?? config.draftVersionPrefix,
        approvedVersionStart: approvedVersionStart ?? config.approvedVersionStart,
      },
    });

    res.json({ config: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
