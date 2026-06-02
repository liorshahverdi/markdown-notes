export function exportDiagramSVG(svgString: string): Blob {
	return new Blob([svgString], { type: 'image/svg+xml' });
}

export async function exportDiagramPNG(
	svgString: string,
	renderedWidth?: number,
	renderedHeight?: number
): Promise<Blob> {
	if (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
		try {
			const parser = new DOMParser();
			const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
			const svgEl = svgDoc.querySelector('svg');

			// Use the actual rendered size from the DOM if provided,
			// otherwise fall back to viewBox or attributes.
			let w = renderedWidth || 800;
			let h = renderedHeight || 600;

			if (!renderedWidth || !renderedHeight) {
				if (svgEl) {
					const vb = svgEl.getAttribute('viewBox');
					if (vb) {
						const parts = vb.split(/[\s,]+/).map(Number);
						if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
							w = parts[2];
							h = parts[3];
						}
					}
					const ew = parseFloat(svgEl.getAttribute('width') || '');
					const eh = parseFloat(svgEl.getAttribute('height') || '');
					if (ew > 0) w = ew;
					if (eh > 0) h = eh;
				}
			}

			// Set explicit dimensions on the SVG so the Image rasterises at the right size
			if (svgEl) {
				svgEl.setAttribute('width', String(w));
				svgEl.setAttribute('height', String(h));
			}

			const scale = 2;
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				return new Blob([svgString], { type: 'image/svg+xml' });
			}

			canvas.width = w * scale;
			canvas.height = h * scale;
			ctx.scale(scale, scale);

			const fixedSvgString = new XMLSerializer().serializeToString(svgDoc);
			const img = new Image();
			const svgBlob = new Blob([fixedSvgString], { type: 'image/svg+xml' });
			const url = URL.createObjectURL(svgBlob);

			return new Promise<Blob>((resolve) => {
				img.onload = () => {
					ctx.drawImage(img, 0, 0, w, h);
					URL.revokeObjectURL(url);

					canvas.toBlob((blob) => {
						resolve(blob ?? new Blob([svgString], { type: 'image/svg+xml' }));
					}, 'image/png');
				};

				img.onerror = () => {
					URL.revokeObjectURL(url);
					resolve(new Blob([svgString], { type: 'image/svg+xml' }));
				};

				img.src = url;
			});
		} catch {
			return new Blob([svgString], { type: 'image/svg+xml' });
		}
	}

	return new Blob([svgString], { type: 'image/svg+xml' });
}
