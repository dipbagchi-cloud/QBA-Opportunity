import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { seedCurrenciesForRegion } from './currency.controller';

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
    const existing = await prisma.client.findFirst({ where: { name } });
    if (existing) { res.status(409).json({ error: `Client "${name}" already exists.` }); return; }
    const client = await prisma.client.create({ data: { name, domain, industry, country } });
    res.status(201).json(client);
}

export async function updateClient(req: Request, res: Response) {
    const { id } = req.params;
    const { name, domain, industry, country, isActive } = req.body;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Client not found.' }); return; }
    const client = await prisma.client.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(domain !== undefined && { domain }),
            ...(industry !== undefined && { industry }),
            ...(country !== undefined && { country }),
            ...(isActive !== undefined && { isActive }),
        },
    });
    res.json(client);
}

export async function deleteClient(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Client not found.' }); return; }
    await prisma.client.update({ where: { id }, data: { isActive: false } });
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
    const existing = await prisma.region.findUnique({ where: { name } });
    if (existing) { res.status(409).json({ error: `Region "${name}" already exists.` }); return; }
    const region = await prisma.region.create({ data: { name } });

    // Auto-seed currencies for the new region
    await seedCurrenciesForRegion(name).catch(() => { /* non-critical */ });

    res.status(201).json(region);
}

export async function updateRegion(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.region.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Region not found.' }); return; }
    const region = await prisma.region.update({
        where: { id },
        data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
    });
    res.json(region);
}

export async function deleteRegion(req: Request, res: Response) {
    const { id } = req.params;
    await prisma.region.delete({ where: { id } });
    res.json({ message: 'Region deleted.' });
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
    const existing = await prisma.technology.findUnique({ where: { name } });
    if (existing) { res.status(409).json({ error: `Technology "${name}" already exists.` }); return; }
    const tech = await prisma.technology.create({ data: { name } });
    res.status(201).json(tech);
}

export async function updateTechnology(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.technology.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Technology not found.' }); return; }
    const tech = await prisma.technology.update({
        where: { id },
        data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
    });
    res.json(tech);
}

export async function deleteTechnology(req: Request, res: Response) {
    const { id } = req.params;
    await prisma.technology.delete({ where: { id } });
    res.json({ message: 'Technology deleted.' });
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
    const existing = await prisma.pricingModel.findUnique({ where: { name } });
    if (existing) { res.status(409).json({ error: `Pricing model "${name}" already exists.` }); return; }
    const model = await prisma.pricingModel.create({ data: { name } });
    res.status(201).json(model);
}

export async function updatePricingModel(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.pricingModel.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Pricing model not found.' }); return; }
    const model = await prisma.pricingModel.update({
        where: { id },
        data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
    });
    res.json(model);
}

export async function deletePricingModel(req: Request, res: Response) {
    const { id } = req.params;
    await prisma.pricingModel.delete({ where: { id } });
    res.json({ message: 'Pricing model deleted.' });
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
    const existing = await prisma.projectType.findUnique({ where: { name } });
    if (existing) { res.status(409).json({ error: `Project type "${name}" already exists.` }); return; }
    const type = await prisma.projectType.create({ data: { name } });
    res.status(201).json(type);
}

export async function updateProjectType(req: Request, res: Response) {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const existing = await prisma.projectType.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Project type not found.' }); return; }
    const type = await prisma.projectType.update({
        where: { id },
        data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
    });
    res.json(type);
}

export async function deleteProjectType(req: Request, res: Response) {
    const { id } = req.params;
    await prisma.projectType.delete({ where: { id } });
    res.json({ message: 'Project type deleted.' });
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
        const response = await fetch(
            'https://hr.qbadvisory.com/api/method/hrms.api.employee.get_all_managers_with_departments',
            { headers: { 'Authorization': 'token 762913b0eb9f140:1205f410c1b7b31' } }
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

// ── Managers by Department from QPeople ──
export async function listManagersByDepartment(req: Request, res: Response) {
    const { department } = req.query;
    try {
        const response = await fetch(
            'https://hr.qbadvisory.com/api/method/hrms.api.employee.get_all_managers_with_departments',
            { headers: { 'Authorization': 'token 762913b0eb9f140:1205f410c1b7b31' } }
        );
        const json: any = await response.json();
        const all: any[] = json.message?.data || [];
        const filtered = department
            ? all.filter((e: any) => (e.department || e.department_name) === department)
            : all;
        const managers = filtered.map((e: any) => ({
            id: e.name || e.employee,
            name: e.employee_name || e.full_name || e.name,
            department: e.department || e.department_name,
        })).filter((m: any) => m.name);
        res.json(managers);
    } catch (error) {
        console.error('QPeople managers API error:', error);
        res.status(502).json({ error: 'Failed to fetch managers from HRMS.' });
    }
}
