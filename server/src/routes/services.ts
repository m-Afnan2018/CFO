import { Router, Request, Response } from 'express';
import Service from '../models/Service';

const router = Router();

function toSlug(name: string, existing: string[] = []): string {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = base;
  let i = 2;
  while (existing.includes(slug)) { slug = `${base}-${i++}`; }
  return slug;
}

// GET all services (flat list; client builds tree)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const services = await Service.find().sort({ order: 1, createdAt: 1 });
    res.json(services);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create service
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, parentId, icon, color } = req.body as {
      name: string; parentId?: string; icon?: string; color?: string;
    };
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    const existing = (await Service.find({}, 'slug')).map(s => s.slug);
    const slug = toSlug(name.trim(), existing);

    const maxOrder = await Service.findOne(
      { parentId: parentId || null },
      'order',
    ).sort({ order: -1 });

    const service = await Service.create({
      name: name.trim(),
      slug,
      parentId: parentId || null,
      icon: icon || 'ti-briefcase',
      color: color || 'indigo',
      order: (maxOrder?.order ?? -1) + 1,
    });
    res.status(201).json(service);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// PUT update service
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!service) return res.status(404).json({ error: 'Not found' });
    res.json(service);
  } catch {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// DELETE service (and all its children)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Service.deleteMany({ parentId: req.params.id });
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
