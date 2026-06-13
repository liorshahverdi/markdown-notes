import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolve, normalize, extname } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { getDataDir } from '$lib/server/dataDir';

function getImagesDir(userId: string): string {
	return resolve(getDataDir(), 'images', userId);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'image/bmp',
]);

const MIME_TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.bmp': 'image/bmp',
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const formData = await request.formData();
	const file = formData.get('image');

	if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || !('type' in file) || !('size' in file) || !('name' in file)) {
		throw error(400, 'Missing image file');
	}

	if (!ALLOWED_MIME_TYPES.has(file.type)) {
		throw error(400, 'Invalid file type. Allowed: png, jpg, gif, webp, bmp');
	}

	if (file.size > MAX_FILE_SIZE) {
		throw error(400, 'File too large. Maximum size is 10MB');
	}

	const ext = extname(file.name).toLowerCase() || '.png';
	const filename = `${randomUUID()}${ext}`;

	const imagesDir = getImagesDir(locals.user!.id);
	await mkdir(imagesDir, { recursive: true });
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(resolve(imagesDir, filename), buffer);

	return json({ filename });
};

export const GET: RequestHandler = async ({ url, locals }) => {
	const imagePath = url.searchParams.get('path');
	if (!imagePath) {
		throw error(400, 'Missing path parameter');
	}

	// Path traversal protection
	const imagesDir = getImagesDir(locals.user!.id);
	const resolved = resolve(imagesDir, normalize(imagePath));
	if (!resolved.startsWith(imagesDir + '/')) {
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
