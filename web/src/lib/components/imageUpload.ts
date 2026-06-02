const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/svg+xml',
	'image/webp',
	'image/bmp',
];

export async function uploadImageFile(file: File): Promise<string> {
	if (!ALLOWED_TYPES.includes(file.type)) {
		throw new Error('Invalid file type. Allowed: png, jpg, gif, svg, webp, bmp');
	}

	if (file.size > MAX_FILE_SIZE) {
		throw new Error('File too large. Maximum size is 10MB');
	}

	const formData = new FormData();
	formData.append('image', file);

	const response = await fetch('/api/images', {
		method: 'POST',
		body: formData,
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({ message: 'Upload failed' }));
		throw new Error(err.message || 'Upload failed');
	}

	const { filename } = await response.json();
	return filename;
}
