import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const resources = await prisma.resource.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(resources);
    } catch (error) {
        console.error('Resources API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
    }
}
