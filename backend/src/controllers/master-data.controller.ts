import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { seedCurrenciesForRegion } from './currency.controller';

// Helper: write audit log for admin master data changes
async function auditMasterData(entity: string, entityId: string, action: string, userId: string, changes: any) {
    await prisma.auditLog.create({
        data: { entity, entityId, action, userId, changes },
    });
}

// ── Clients ──
export async function listClients(req: Request, res: Response) {
    const clients = await prisma.client.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, domain: true, industry: true, country: true, isActive: true },
    });
    res.json(clients);
}

export async function listAllClients(req: Request, res: Response) {
    const clients = await prisma.client.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, domain: true, industry: true, country: true, isActive: true, createdAt: true },
    });
    res.json(clients);
}

export async function createClient(req: Request, res: Response) {
    const { name, domain, industry, country } = req.body;
    if (!name) { res.status(400).json({ error: 'Client name is required.' }); return; }
    const existing = await prisma.client.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Client "${name}" already exists.` }); return; }
    const client = await prisma.client.create({ data: { name, domain, industry, country } });
    await auditMasterData('Client', client.id, 'CREATE', req.user!.userId, `Created client: ${name}`);
    res.status(201).json(client);
}

export async function updateClient(req: Request, res: Response) {
    const { id } = req.params;
    const { name, domain, industry, country, isActive } = req.body;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Client not found.' }); return; }

    // If only toggling isActive, do a simple update
    if (isActive !== undefined && !name && !domain && !industry && !country) {
        const client = await prisma.client.update({ where: { id }, data: { isActive } });
        await auditMasterData('Client', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} client: ${existing.name}`);
        res.json(client);
        return;
    }

    // Soft-version: deactivate old, create new
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    const newClient = await prisma.client.create({
        data: {
            name: name ?? existing.name,
            domain: domain ?? existing.domain,
            industry: industry ?? existing.industry,
            country: country ?? existing.country,
        },
    });
    const changes: string[] = [];
    if (name && name !== existing.name) changes.push(`Name: "${existing.name}" → "${name}"`);
    if (domain !== undefined && domain !== existing.domain) changes.push(`Domain updated`);
    if (industry !== undefined && industry !== existing.industry) changes.push(`Industry updated`);
    if (country !== undefined && country !== existing.country) changes.push(`Country updated`);
    await auditMasterData('Client', newClient.id, 'UPDATE', req.user!.userId, `Updated client (versioned): ${changes.join('; ') || 'No field changes'}`);
    res.json(newClient);
}

export async function deleteClient(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Client not found.' }); return; }
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('Client', id, 'DELETE', req.user!.userId, `Deactivated client: ${existing.name}`);
    res.json({ message: 'Client deactivated.' });
}

// ── Regions ──
export async function listRegions(req: Request, res: Response) {
    const regions = await prisma.region.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(regions);
}

export async function listAllRegions(req: Request, res: Response) {
    const regions = await prisma.region.findMany({ orderBy: { name: 'asc' } });
    res.json(regions);
}

export async function createRegion(req: Request, res: Response) {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Region name is required.' }); return; }
    const existing = await prisma.region.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Region "${name}" already exists.` }); return; }
    const region = await prisma.region.create({ data: { name } });
    await seedCurrenciesForRegion(name).catch(() => { /* non-critical */ });
    await auditMasterData('Region', region.id, 'CREATE', req.user!.userId, `Created region: ${name}`);
    res.status(201).json(region);
}

export async function updateRegion(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.region.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Region not found.' }); return; }

    // If only toggling isActive, do a simple update
    if (isActive !== undefined && !name) {
        const region = await prisma.region.update({ where: { id }, data: { isActive } });
        await auditMasterData('Region', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} region: ${existing.name}`);
        res.json(region);
        return;
    }

    // Soft-version: deactivate old, create new
    await prisma.region.update({ where: { id }, data: { isActive: false } });
    const newRegion = await prisma.region.create({ data: { name: name ?? existing.name } });
    await auditMasterData('Region', newRegion.id, 'UPDATE', req.user!.userId, `Updated region (versioned): "${existing.name}" → "${name ?? existing.name}"`);
    res.json(newRegion);
}

export async function deleteRegion(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.region.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Region not found.' }); return; }
    await prisma.region.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('Region', id, 'DELETE', req.user!.userId, `Deactivated region: ${existing.name}`);
    res.json({ message: 'Region deactivated.' });
}

// ── Technologies ──
export async function listTechnologies(req: Request, res: Response) {
    const techs = await prisma.technology.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(techs);
}

export async function listAllTechnologies(req: Request, res: Response) {
    const techs = await prisma.technology.findMany({ orderBy: { name: 'asc' } });
    res.json(techs);
}

export async function createTechnology(req: Request, res: Response) {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Technology name is required.' }); return; }
    const existing = await prisma.technology.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Technology "${name}" already exists.` }); return; }
    const tech = await prisma.technology.create({ data: { name } });
    await auditMasterData('Technology', tech.id, 'CREATE', req.user!.userId, `Created technology: ${name}`);
    res.status(201).json(tech);
}

export async function updateTechnology(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.technology.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Technology not found.' }); return; }

    if (isActive !== undefined && !name) {
        const tech = await prisma.technology.update({ where: { id }, data: { isActive } });
        await auditMasterData('Technology', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} technology: ${existing.name}`);
        res.json(tech);
        return;
    }

    // Soft-version: deactivate old, create new
    await prisma.technology.update({ where: { id }, data: { isActive: false } });
    const newTech = await prisma.technology.create({ data: { name: name ?? existing.name } });
    await auditMasterData('Technology', newTech.id, 'UPDATE', req.user!.userId, `Updated technology (versioned): "${existing.name}" → "${name ?? existing.name}"`);
    res.json(newTech);
}

export async function deleteTechnology(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.technology.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Technology not found.' }); return; }
    await prisma.technology.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('Technology', id, 'DELETE', req.user!.userId, `Deactivated technology: ${existing.name}`);
    res.json({ message: 'Technology deactivated.' });
}

// ── Pricing Models ──
export async function listPricingModels(req: Request, res: Response) {
    const models = await prisma.pricingModel.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(models);
}

export async function listAllPricingModels(req: Request, res: Response) {
    const models = await prisma.pricingModel.findMany({ orderBy: { name: 'asc' } });
    res.json(models);
}

export async function createPricingModel(req: Request, res: Response) {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Pricing model name is required.' }); return; }
    const existing = await prisma.pricingModel.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Pricing model "${name}" already exists.` }); return; }
    const model = await prisma.pricingModel.create({ data: { name } });
    await auditMasterData('PricingModel', model.id, 'CREATE', req.user!.userId, `Created pricing model: ${name}`);
    res.status(201).json(model);
}

export async function updatePricingModel(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.pricingModel.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Pricing model not found.' }); return; }

    if (isActive !== undefined && !name) {
        const model = await prisma.pricingModel.update({ where: { id }, data: { isActive } });
        await auditMasterData('PricingModel', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} pricing model: ${existing.name}`);
        res.json(model);
        return;
    }

    await prisma.pricingModel.update({ where: { id }, data: { isActive: false } });
    const newModel = await prisma.pricingModel.create({ data: { name: name ?? existing.name } });
    await auditMasterData('PricingModel', newModel.id, 'UPDATE', req.user!.userId, `Updated pricing model (versioned): "${existing.name}" → "${name ?? existing.name}"`);
    res.json(newModel);
}

export async function deletePricingModel(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.pricingModel.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Pricing model not found.' }); return; }
    await prisma.pricingModel.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('PricingModel', id, 'DELETE', req.user!.userId, `Deactivated pricing model: ${existing.name}`);
    res.json({ message: 'Pricing model deactivated.' });
}

// ── Project Types ──
export async function listProjectTypes(req: Request, res: Response) {
    const types = await prisma.projectType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(types);
}

export async function listAllProjectTypes(req: Request, res: Response) {
    const types = await prisma.projectType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
}

export async function createProjectType(req: Request, res: Response) {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Project type name is required.' }); return; }
    const existing = await prisma.projectType.findFirst({ where: { name, isActive: true } });
    if (existing) { res.status(409).json({ error: `Project type "${name}" already exists.` }); return; }
    const type = await prisma.projectType.create({ data: { name } });
    await auditMasterData('ProjectType', type.id, 'CREATE', req.user!.userId, `Created project type: ${name}`);
    res.status(201).json(type);
}

export async function updateProjectType(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.projectType.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Project type not found.' }); return; }

    if (isActive !== undefined && !name) {
        const type = await prisma.projectType.update({ where: { id }, data: { isActive } });
        await auditMasterData('ProjectType', id, 'UPDATE', req.user!.userId, `${isActive ? 'Activated' : 'Deactivated'} project type: ${existing.name}`);
        res.json(type);
        return;
    }

    await prisma.projectType.update({ where: { id }, data: { isActive: false } });
    const newType = await prisma.projectType.create({ data: { name: name ?? existing.name } });
    await auditMasterData('ProjectType', newType.id, 'UPDATE', req.user!.userId, `Updated project type (versioned): "${existing.name}" → "${name ?? existing.name}"`);
    res.json(newType);
}

export async function deleteProjectType(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.projectType.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Project type not found.' }); return; }
    await prisma.projectType.update({ where: { id }, data: { isActive: false } });
    await auditMasterData('ProjectType', id, 'DELETE', req.user!.userId, `Deactivated project type: ${existing.name}`);
    res.json({ message: 'Project type deactivated.' });
}

// ── Salespersons (users with Sales/Manager/Management role) ──
export async function listSalespersons(req: Request, res: Response) {
    const users = await prisma.user.findMany({
        where: {
            isActive: true,
            roles: { some: { name: { in: ['Sales', 'Manager', 'Admin', 'Management'] } } },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, department: true, roles: { select: { name: true } } },
    });
    res.json(users);
}

// ── Departments from QPeople ──
export async function listDepartments(req: Request, res: Response) {
    try {
        const qpeopleToken = process.env.QPEOPLE_API_TOKEN;
        if (!qpeopleToken) {
          return res.status(500).json({ error: 'QPEOPLE_API_TOKEN not configured' });
        }
        const response = await fetch(
            'https://hr.qbadvisory.com/api/method/hrms.api.employee.get_all_managers_with_departments',
            { headers: { 'Authorization': `token ${qpeopleToken}` } }
        );
        const json: any = await response.json();
        const departments = [...new Set(
            (json.message?.data || [])
                .map((e: any) => e.department || e.department_name)
                .filter(Boolean)
        )].sort();
        res.json(departments);
    } catch (error) {
        console.error('QPeople API error:', error);
        res.status(502).json({ error: 'Failed to fetch departments from HRMS.' });
    }
}

// ── Managers by Department (CRM users with Manager role) ──
export async function listManagersByDepartment(req: Request, res: Response) {
    const { department } = req.query;
    try {
        const where: any = {
            isActive: true,
            roles: { some: { name: 'Manager' } },
        };
        if (department && typeof department === 'string') {
            where.department = department;
        }
        const users = await prisma.user.findMany({
            where,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, email: true, department: true },
        });
        res.json(users);
    } catch (error) {
        console.error('List managers error:', error);
        res.status(500).json({ error: 'Failed to fetch managers.' });
    }
}
