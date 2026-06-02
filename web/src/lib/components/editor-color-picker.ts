import { MatchDecorator, Decoration, WidgetType, ViewPlugin, EditorView } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*\)/g;

export function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
	return '#' + [r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('');
}

export function hslToHex(h: number, s: number, l: number): string {
	h = ((h % 360) + 360) % 360;
	s = Math.max(0, Math.min(100, s)) / 100;
	l = Math.max(0, Math.min(100, l)) / 100;

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;

	let r = 0, g = 0, b = 0;
	if (h < 60) { r = c; g = x; }
	else if (h < 120) { r = x; g = c; }
	else if (h < 180) { g = c; b = x; }
	else if (h < 240) { g = x; b = c; }
	else if (h < 300) { r = x; b = c; }
	else { r = c; b = x; }

	return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function colorToHex(colorText: string): string {
	const trimmed = colorText.trim();

	if (trimmed.startsWith('#')) {
		const hex = trimmed.slice(1);
		if (hex.length === 3) {
			return '#' + hex.split('').map(c => c + c).join('');
		}
		if (hex.length === 8) {
			return '#' + hex.slice(0, 6);
		}
		if (hex.length === 6) {
			return '#' + hex;
		}
		return '#000000';
	}

	const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
	if (rgbMatch) {
		return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
	}

	const hslMatch = trimmed.match(/^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*\)$/);
	if (hslMatch) {
		return hslToHex(+hslMatch[1], +hslMatch[2], +hslMatch[3]);
	}

	return '#000000';
}

class ColorSwatchWidget extends WidgetType {
	color: string;
	from: number;
	to: number;

	constructor(color: string, from: number, to: number) {
		super();
		this.color = color;
		this.from = from;
		this.to = to;
	}

	eq(other: ColorSwatchWidget) {
		return this.color === other.color && this.from === other.from && this.to === other.to;
	}

	toDOM(view: EditorView) {
		const span = document.createElement('span');
		span.className = 'cm-color-swatch';
		span.style.backgroundColor = this.color;
		span.setAttribute('aria-label', `Color swatch: ${this.color}`);

		span.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();

			const input = document.createElement('input');
			input.type = 'color';
			input.value = colorToHex(this.color);
			input.style.position = 'fixed';
			input.style.opacity = '0';
			input.style.pointerEvents = 'none';
			document.body.appendChild(input);

			input.addEventListener('input', () => {
				span.style.backgroundColor = input.value;
			});

			input.addEventListener('change', () => {
				view.dispatch({
					changes: { from: this.from, to: this.to, insert: input.value }
				});
				input.remove();
			});

			// Also clean up if picker is dismissed without change
			input.addEventListener('blur', () => {
				setTimeout(() => input.remove(), 100);
			});

			input.click();
		});

		return span;
	}

	ignoreEvent() {
		return false;
	}
}

const colorMatcher = new MatchDecorator({
	regexp: COLOR_RE,
	decoration: (match, view, pos) => {
		const from = pos;
		const to = pos + match[0].length;
		return Decoration.widget({
			widget: new ColorSwatchWidget(match[0], from, to),
			side: 1
		});
	}
});

class ColorPickerPluginClass {
	decorations: DecorationSet;
	constructor(view: EditorView) {
		this.decorations = colorMatcher.createDeco(view);
	}
	update(update: ViewUpdate) {
		this.decorations = colorMatcher.updateDeco(update, this.decorations);
	}
}

export const colorPickerPlugin = ViewPlugin.fromClass(ColorPickerPluginClass, {
	decorations: (v) => v.decorations
});
