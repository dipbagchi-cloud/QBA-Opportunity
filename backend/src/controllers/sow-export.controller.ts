import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'uploads', 'sow-exports');

// Ensure export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// Helper: resolve a stored path (relative or legacy absolute) to absolute
function resolveStoredPath(storedPath: string): string {
  return path.isAbsolute(storedPath) ? storedPath : path.join(PROJECT_ROOT, storedPath);
}

// ============================================================================
// DOCX EXPORT
// ============================================================================

export async function exportDocx(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const user = (req as any).user;

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        template: { include: { anchorMappings: true } },
      },
    });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: true },
    });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

    let outputPath: string;
    let outputFileName: string;

    const templateAbsPath = doc.template ? resolveStoredPath(doc.template.templateFilePath) : null;
    if (doc.template && templateAbsPath && fs.existsSync(templateAbsPath)) {
      // Template-based generation using docxtemplater
      outputFileName = buildExportFilename(doc, opportunity, 'docx');
      outputPath = path.join(EXPORT_DIR, outputFileName);
      await generateFromTemplate(doc, opportunity, outputPath, templateAbsPath);
    } else {
      // Fallback: Generate a simple DOCX without template
      outputFileName = buildExportFilename(doc, opportunity, 'docx');
      outputPath = path.join(EXPORT_DIR, outputFileName);
      await generateSimpleDocx(doc, opportunity, outputPath);
    }

    // Record export — store relative path for portability
    const fileStats = fs.statSync(outputPath);
    const relativeExportPath = path.relative(PROJECT_ROOT, outputPath);
    await prisma.sowExport.create({
      data: {
        documentId: doc.id,
        format: 'docx',
        filePath: relativeExportPath,
        fileName: outputFileName,
        fileSize: fileStats.size,
        version: doc.version,
        templateVersion: doc.template?.version,
        exportedBy: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SowDocument',
        entityId: doc.id,
        action: 'EXPORT_DOCX',
        changes: { fileName: outputFileName, version: doc.version },
        userId: user.id,
      },
    });

    res.download(outputPath, outputFileName);
  } catch (error: any) {
    console.error('Error exporting DOCX:', error);
    res.status(500).json({ error: error.message });
  }
}

async function generateFromTemplate(doc: any, opportunity: any, outputPath: string, templateAbsPath?: string): Promise<void> {
  const templatePath = templateAbsPath || resolveStoredPath(doc.template.templateFilePath);
  const templateContent = fs.readFileSync(templatePath);
  const zip = new PizZip(templateContent);

  const docx = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  // Build data for token placeholders
  const tokenData: Record<string, string> = {
    DOCUMENT_TITLE: doc.documentTitle || opportunity.title || '',
    CLIENT_NAME: opportunity.client?.name || '',
    CLIENT_ADDRESS_BLOCK: [
      opportunity.client?.name,
      opportunity.client?.location,
      opportunity.client?.country,
    ].filter(Boolean).join('\n'),
    PROJECT_TITLE: opportunity.title || '',
    DOCUMENT_VERSION: doc.version || '0.1',
    DATE: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    DOCUMENT_NUMBER: doc.documentNumber || '',
    SALES_REP: opportunity.salesRepName || '',
    MANAGER: opportunity.managerName || '',
    REGION: opportunity.region || '',
    TECHNOLOGY: opportunity.technology || '',
    PRICING_MODEL: opportunity.pricingModel || '',
    PROJECT_VALUE: `${opportunity.currency || 'USD'} ${opportunity.value || ''}`,
    DURATION: `${opportunity.tentativeDuration || ''} ${opportunity.tentativeDurationUnit || ''}`.trim(),
    START_DATE: opportunity.tentativeStartDate
      ? new Date(opportunity.tentativeStartDate).toLocaleDateString('en-GB')
      : '',
    END_DATE: opportunity.tentativeEndDate
      ? new Date(opportunity.tentativeEndDate).toLocaleDateString('en-GB')
      : '',
  };

  // Map section content to section anchors
  for (const section of doc.sections) {
    const content = section.finalContent || section.editedContent || section.generatedContent || '';
    const anchorKey = `SECTION_${section.sectionKey.toUpperCase()}`;
    tokenData[anchorKey] = content;
  }

  // Build table data
  const presales = opportunity.presalesData;
  const resourceLines = presales?.resourceLines || presales?.resources || [];
  tokenData['COMMERCIALS_TABLE'] = buildCommercialsText(opportunity);
  tokenData['MILESTONE_TABLE'] = '[Milestone table - see Delivery Plan section]';
  tokenData['ANNEXURES'] = '';

  // Also add the raw section anchors with [[SECTION:...]] format mapping
  for (const anchor of (doc.template.anchorMappings || [])) {
    if (anchor.sectionKey) {
      const section = doc.sections.find((s: any) => s.sectionKey === anchor.sectionKey);
      if (section) {
        const content = section.finalContent || section.editedContent || section.generatedContent;
        if (content) {
          // Map anchor to cleaned key for docxtemplater
          const cleanKey = anchor.anchorKey.replace(/[{}\[\]:]/g, '').trim();
          tokenData[cleanKey] = content;
        }
      }
    }
  }

  try {
    docx.render(tokenData);
  } catch (error: any) {
    console.error('Template render error:', error);
    // If template has unmapped placeholders, they'll remain as-is
    // Re-render with nullFallback
    const docx2 = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
    });
    docx2.render(tokenData);
    const buf = docx2.getZip().generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buf);
    return;
  }

  const buf = docx.getZip().generate({ type: 'nodebuffer' });
  fs.writeFileSync(outputPath, buf);
}

async function generateSimpleDocx(doc: any, opportunity: any, outputPath: string): Promise<void> {
  // Build a minimal DOCX using docxtemplater with an inline template
  // This creates a basic document structure from scratch
  const content = buildPlainTextDocument(doc, opportunity);

  // For simple DOCX generation without a template, we'll create a minimal Office XML
  const xmlContent = buildMinimalDocx(content);
  const zip = new PizZip();

  // Minimal DOCX structure
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
  zip.file('word/document.xml', xmlContent);

  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(outputPath, buf);
}

function buildMinimalDocx(textContent: string): string {
  // Convert markdown-like content to Word XML paragraphs
  const lines = textContent.split('\n');
  const paragraphs = lines.map(line => {
    let style = 'Normal';
    let text = line;

    if (line.startsWith('# ')) {
      style = 'Heading1';
      text = line.substring(2);
    } else if (line.startsWith('## ')) {
      style = 'Heading2';
      text = line.substring(3);
    } else if (line.startsWith('### ')) {
      style = 'Heading3';
      text = line.substring(4);
    }

    // Escape XML characters
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  mc:Ignorable="w14 wp14">
  <w:body>${paragraphs}</w:body>
</w:document>`;
}

function buildPlainTextDocument(doc: any, opportunity: any): string {
  const lines: string[] = [];

  lines.push(`# ${doc.documentTitle || opportunity.title || 'Statement of Work'}`);
  lines.push('');
  lines.push(`**Document Number:** ${doc.documentNumber || 'N/A'}`);
  lines.push(`**Version:** ${doc.version}`);
  lines.push(`**Date:** ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`);
  lines.push(`**Client:** ${opportunity.client?.name || 'N/A'}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of doc.sections) {
    const content = section.finalContent || section.editedContent || section.generatedContent;
    if (content) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(content);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildCommercialsText(opportunity: any): string {
  const lines = [
    `Engagement Model: ${opportunity.pricingModel || '[TBD]'}`,
    `Project Value: ${opportunity.currency || 'USD'} ${opportunity.value || '[TBD]'}`,
    `Duration: ${opportunity.tentativeDuration || '[TBD]'} ${opportunity.tentativeDurationUnit || ''}`,
  ];
  if (opportunity.expectedDayRate) {
    lines.push(`Day Rate: ${opportunity.currency || 'USD'} ${opportunity.expectedDayRate}`);
  }
  return lines.join('\n');
}

function buildExportFilename(doc: any, opportunity: any, ext: string): string {
  const clientName = (opportunity.client?.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  const projectName = (opportunity.title || 'Project').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const version = (doc.version || '0.1').replace(/\./g, '_');
  const timestamp = Date.now();
  return `${doc.documentNumber || 'SOW'}_${clientName}_${projectName}_v${version}_${timestamp}.${ext}`;
}

// ============================================================================
// HTML PREVIEW
// ============================================================================

export async function previewHtml(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;

    const doc = await prisma.sowDocument.findUnique({
      where: { opportunityId },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!doc) return res.status(404).json({ error: 'SOW document not found' });

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { client: true },
    });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

    // Build HTML preview
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${doc.documentTitle || opportunity.title} - SOW</title>
<style>
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; }
  h1 { color: #1a365d; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
  h2 { color: #2563eb; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
  h3 { color: #374151; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  .header { text-align: center; margin-bottom: 40px; }
  .meta { color: #6b7280; font-size: 14px; }
  .section { margin-bottom: 30px; }
  .page-break { page-break-before: always; }
  @media print { body { max-width: none; padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>${doc.documentTitle || opportunity.title}</h1>
  <p class="meta"><strong>Statement of Work</strong></p>
  <p class="meta">Document: ${doc.documentNumber || 'N/A'} | Version: ${doc.version} | ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  <p class="meta">Client: ${opportunity.client?.name || 'N/A'}</p>
</div>
`;

    for (const section of doc.sections) {
      const content = section.finalContent || section.editedContent || section.generatedContent;
      if (content) {
        // Convert markdown-like content to HTML
        const htmlContent = markdownToHtml(content);
        html += `<div class="section">
  <h2>${section.title}</h2>
  ${htmlContent}
</div>\n`;
      }
    }

    html += '</body></html>';

    res.json({ html, document: doc });
  } catch (error: any) {
    console.error('Error generating HTML preview:', error);
    res.status(500).json({ error: error.message });
  }
}

function markdownToHtml(text: string): string {
  if (!text) return '';

  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Tables (simple support)
    .replace(/\|(.+)\|\n\|[-|]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
      const headerCells = header.split('|').map((c: string) => c.trim()).filter(Boolean);
      const headerHtml = headerCells.map((c: string) => `<th>${c}</th>`).join('');
      const rowLines = rows.trim().split('\n');
      const rowsHtml = rowLines.map((row: string) => {
        const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
        return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`;
      }).join('');
      return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
    })
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Numbered lists (simple)
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines to <br>
    .replace(/\n/g, '<br>');

  // Wrap loose <li> in <ol>
  html = html.replace(/(<li>.+?<\/li>(?:<br>)?)+/g, '<ol>$&</ol>');
  // Clean up <br> inside <ol>
  html = html.replace(/<ol>[\s\S]*?<\/ol>/g, (m) => m.replace(/<br>/g, ''));

  return `<p>${html}</p>`;
}

// ============================================================================
// EXPORT LIST & DOWNLOAD
// ============================================================================

export async function listExports(req: Request, res: Response) {
  try {
    const { opportunityId } = req.params;
    const doc = await prisma.sowDocument.findUnique({ where: { opportunityId } });
    if (!doc) return res.json({ exports: [] });

    const exports = await prisma.sowExport.findMany({
      where: { documentId: doc.id },
      orderBy: { exportedAt: 'desc' },
    });
    res.json({ exports });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function downloadExport(req: Request, res: Response) {
  try {
    const { exportId } = req.params;
    const exportRecord = await prisma.sowExport.findUnique({ where: { id: exportId } });
    if (!exportRecord) return res.status(404).json({ error: 'Export not found' });

    const absPath = resolveStoredPath(exportRecord.filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Export file not found on disk' });
    }

    res.download(absPath, exportRecord.fileName);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
