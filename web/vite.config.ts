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
	build: {
		// Heavy libraries are now lazy-loaded behind routes/workers. Keep the warning
		// threshold above those isolated chunks while still catching accidental
		// multi-megabyte app bundles.
		chunkSizeWarningLimit: 900,
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
