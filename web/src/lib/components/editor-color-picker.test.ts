import { describe, it, expect } from 'vitest';
import { rgbToHex, hslToHex, colorToHex, colorPickerPlugin } from './editor-color-picker';

describe('rgbToHex', () => {
	it('converts basic RGB values', () => {
		expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
		expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
		expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
	});

	it('converts mixed RGB values', () => {
		expect(rgbToHex(52, 152, 219)).toBe('#3498db');
		expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
		expect(rgbToHex(0, 0, 0)).toBe('#000000');
	});

	it('clamps out-of-range values', () => {
		expect(rgbToHex(300, -10, 128)).toBe('#ff0080');
	});
});

describe('hslToHex', () => {
	it('converts red (0, 100%, 50%)', () => {
		expect(hslToHex(0, 100, 50)).toBe('#ff0000');
	});

	it('converts black (0, 0%, 0%)', () => {
		expect(hslToHex(0, 0, 0)).toBe('#000000');
	});

	it('converts white (0, 0%, 100%)', () => {
		expect(hslToHex(0, 0, 100)).toBe('#ffffff');
	});

	it('converts green (120, 100%, 50%)', () => {
		expect(hslToHex(120, 100, 50)).toBe('#00ff00');
	});

	it('converts blue (240, 100%, 50%)', () => {
		expect(hslToHex(240, 100, 50)).toBe('#0000ff');
	});
});

describe('colorToHex', () => {
	it('passes through 6-digit hex', () => {
		expect(colorToHex('#3498db')).toBe('#3498db');
		expect(colorToHex('#FFFFFF')).toBe('#FFFFFF');
	});

	it('expands 3-digit hex shorthand', () => {
		expect(colorToHex('#abc')).toBe('#aabbcc');
		expect(colorToHex('#fff')).toBe('#ffffff');
	});

	it('strips alpha from 8-digit hex', () => {
		expect(colorToHex('#3498dbff')).toBe('#3498db');
		expect(colorToHex('#00ff00aa')).toBe('#00ff00');
	});

	it('parses rgb()', () => {
		expect(colorToHex('rgb(52, 152, 219)')).toBe('#3498db');
		expect(colorToHex('rgb(255, 0, 0)')).toBe('#ff0000');
	});

	it('parses hsl()', () => {
		expect(colorToHex('hsl(0, 100%, 50%)')).toBe('#ff0000');
		expect(colorToHex('hsl(120, 100%, 50%)')).toBe('#00ff00');
	});

	it('returns black for unknown formats', () => {
		expect(colorToHex('#zz')).toBe('#000000');
	});
});

describe('colorPickerPlugin', () => {
	it('is defined and exportable', () => {
		expect(colorPickerPlugin).toBeDefined();
	});
});
