/**
 * Pure functions for toolbar actions that operate on markdown content strings.
 * These mirror the Swift ToolbarView behavior.
 */

/** Appends wrapper+"text"+wrapper to content (matching Swift behavior) */
export function wrapSelection(content: string, wrapper: string): string {
	return content + `${wrapper}text${wrapper}`;
}

/** If empty or ends with \n, append prefix. Otherwise append \n+prefix. */
export function prependToLine(content: string, prefix: string): string {
	if (content === '' || content.endsWith('\n')) {
		return content + prefix;
	}
	return content + '\n' + prefix;
}

const TABLE_TEMPLATE = [
	'| Column 1 | Column 2 | Column 3 |',
	'|----------|----------|----------|',
	'| data     | data     | data     |',
	'| data     | data     | data     |'
].join('\n');

/** Inserts a 3-col, 2-row table template */
export function insertTable(content: string): string {
	if (content === '') return TABLE_TEMPLATE;
	if (content.endsWith('\n')) return content + TABLE_TEMPLATE;
	return content + '\n' + TABLE_TEMPLATE;
}

/** Line starts with | and ends with | and length >= 3 */
export function isTableRow(line: string): boolean {
	return line.length >= 3 && line.startsWith('|') && line.endsWith('|');
}

/** Inner content (between first and last |) contains only |, -, space, : */
export function isSeparatorRow(line: string): boolean {
	if (!isTableRow(line)) return false;
	const inner = line.slice(1, -1);
	return /^[|\-\s:]+$/.test(inner);
}

/**
 * Finds last table row, inserts a new row with matching column count after it.
 * If no table found, inserts a new table.
 */
export function addRow(content: string): string {
	const lines = content.split('\n');

	// Find the last table row index
	let lastTableRowIdx = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			lastTableRowIdx = i;
			break;
		}
	}

	if (lastTableRowIdx === -1) {
		return insertTable(content);
	}

	// Count columns from the header row of the last table block
	// Walk backwards from lastTableRowIdx to find start of table
	let tableStart = lastTableRowIdx;
	for (let i = lastTableRowIdx - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			tableStart = i;
		} else {
			break;
		}
	}

	const colCount = lines[tableStart].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).length;
	const newRow = '|' + ' data     |'.repeat(colCount);

	lines.splice(lastTableRowIdx + 1, 0, newRow);
	return lines.join('\n');
}

/**
 * Finds the last table block, appends " New |" or " --- |" to each row.
 * If no table found, inserts a new table.
 */
export function addColumn(content: string): string {
	const lines = content.split('\n');

	// Find last table block
	let lastTableRowIdx = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			lastTableRowIdx = i;
			break;
		}
	}

	if (lastTableRowIdx === -1) {
		return insertTable(content);
	}

	// Find table block boundaries
	let tableStart = lastTableRowIdx;
	for (let i = lastTableRowIdx - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			tableStart = i;
		} else {
			break;
		}
	}

	for (let i = tableStart; i <= lastTableRowIdx; i++) {
		if (isSeparatorRow(lines[i])) {
			lines[i] = lines[i].slice(0, -1) + ' --- |';
		} else if (i === tableStart) {
			// Header row
			lines[i] = lines[i].slice(0, -1) + ' New |';
		} else {
			// Data row
			lines[i] = lines[i].slice(0, -1) + ' data |';
		}
	}

	return lines.join('\n');
}

/**
 * Finds the last table block and removes the last data row (not header or separator).
 * Returns content unchanged if no deletable row exists.
 */
export function deleteRow(content: string): string {
	const lines = content.split('\n');

	// Find last table block
	let lastTableRowIdx = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			lastTableRowIdx = i;
			break;
		}
	}

	if (lastTableRowIdx === -1) return content;

	// Find table block start
	let tableStart = lastTableRowIdx;
	for (let i = lastTableRowIdx - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			tableStart = i;
		} else {
			break;
		}
	}

	// Need at least header + separator + 1 data row to delete
	// The last row that isn't the header or separator is the one to delete
	// Walk backwards from lastTableRowIdx to find the last data row
	for (let i = lastTableRowIdx; i >= tableStart; i--) {
		if (!isSeparatorRow(lines[i]) && i !== tableStart) {
			lines.splice(i, 1);
			return lines.join('\n');
		}
	}

	return content;
}

/**
 * Finds the last table block and removes the last column from every row.
 * Returns content unchanged if the table has only one column.
 */
export function deleteColumn(content: string): string {
	const lines = content.split('\n');

	// Find last table block
	let lastTableRowIdx = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			lastTableRowIdx = i;
			break;
		}
	}

	if (lastTableRowIdx === -1) return content;

	// Find table block start
	let tableStart = lastTableRowIdx;
	for (let i = lastTableRowIdx - 1; i >= 0; i--) {
		if (isTableRow(lines[i])) {
			tableStart = i;
		} else {
			break;
		}
	}

	// Check column count — need at least 2 to delete one
	const colCount = lines[tableStart].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).length;
	if (colCount <= 1) return content;

	for (let i = tableStart; i <= lastTableRowIdx; i++) {
		if (!isTableRow(lines[i])) continue;
		// Remove the last cell: find the second-to-last | and truncate
		const lastPipe = lines[i].lastIndexOf('|');
		const secondLastPipe = lines[i].lastIndexOf('|', lastPipe - 1);
		if (secondLastPipe >= 0) {
			lines[i] = lines[i].slice(0, secondLastPipe) + '|';
		}
	}

	return lines.join('\n');
}

/** Inserts ![altText](src) with appropriate newline prefix */
export function insertImage(content: string, altText: string, src: string): string {
	const imageMarkdown = `![${altText}](${src})`;
	if (content === '') return imageMarkdown;
	if (content.endsWith('\n')) return content + imageMarkdown;
	return content + '\n' + imageMarkdown;
}

/** Inserts ```mermaid\n{template}\n``` with appropriate newline prefix */
export function insertDiagram(content: string, template: string): string {
	const block = '```mermaid\n' + template + '\n```';
	if (content === '') return block;
	if (content.endsWith('\n')) return content + block;
	return content + '\n' + block;
}

/** Darkens a hex color to 80% brightness */
function darkenHex(hex: string): string {
	const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.8);
	const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.8);
	const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.8);
	return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Given a hex color like "#3498db", computes a darkened stroke (80%),
 * returns content + classDef line.
 */
export function insertClassDef(content: string, hexColor: string): string {
	const strokeHex = darkenHex(hexColor);
	const line = `classDef myColor fill:${hexColor},stroke:${strokeHex},color:#fff`;
	if (content === '') return line;
	if (content.endsWith('\n')) return content + line;
	return content + '\n' + line;
}
