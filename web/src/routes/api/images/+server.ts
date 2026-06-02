import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolve, normalize, extname } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

const IMAGES_DIR = resolve('data/images');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/svg+xml',
	'image/webp',
	'image/bmp',
]);

const MIME_TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.bmp': 'image/bmp',
};

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('image');

	if (!file || !(file instanceof File)) {
		throw error(400, 'Missing image file');
	}

	if (!ALLOWED_MIME_TYPES.has(file.type)) {
		throw error(400, 'Invalid file type. Allowed: png, jpg, gif, svg, webp, bmp');
	}

	if (file.size > MAX_FILE_SIZE) {
		throw error(400, 'File too large. Maximum size is 10MB');
	}

	const ext = extname(file.name).toLowerCase() || '.png';
	const filename = `${randomUUID()}${ext}`;

	await mkdir(IMAGES_DIR, { recursive: true });
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(resolve(IMAGES_DIR, filename), buffer);

	return json({ filename });
};

export const GET: RequestHandler = async ({ url }) => {
	const imagePath = url.searchParams.get('path');
	if (!imagePath) {
		throw error(400, 'Missing path parameter');
	}

	// Path traversal protection
	const resolved = resolve(IMAGES_DIR, normalize(imagePath));
	if (!resolved.startsWith(IMAGES_DIR + '/')) {
		throw error(403, 'Path traversal not allowed');
	}

	if (!existsSync(resolved)) {
		throw error(404, 'Image not found');
	}

	const ext = resolved.substring(resolved.lastIndexOf('.')).toLowerCase();
	const contentType = MIME_TYPES[ext] || 'application/octet-stream';

	const data = await readFile(resolved);
	return new Response(data, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=3600',
		},
	});
};
