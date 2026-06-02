import fs from 'fs';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		https: fs.existsSync('localhost.pem')
			? {
					cert: fs.readFileSync('localhost.pem'),
					key: fs.readFileSync('localhost-key.pem')
				}
			: undefined,
		watch: {
			ignored: ['**/data/**']
		}
	},
	worker: {
		format: 'es'
	},
	resolve: {
		conditions: ['browser']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['src/test-setup.ts']
	}
});
