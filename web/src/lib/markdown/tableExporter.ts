function isSeparatorRow(line: string): boolean {
	// A separator row contains only |, -, :, and spaces
	return /^[\s|:\-]+$/.test(line) && line.includes('-');
}

function isTableRow(line: string): boolean {
	const trimmed = line.trim();
	return trimmed.startsWith('|') && trimmed.endsWith('|');
}

function parseCells(line: string): string[] {
	const trimmed = line.trim();
	// Remove leading and trailing |, then split on |
	const inner = trimmed.slice(1, -1);
	return inner.split('|').map((cell) => cell.trim());
}

function escapeCSVCell(cell: string): string {
	if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
		return '"' + cell.replace(/"/g, '""') + '"';
	}
	return cell;
}

export function extractCSV(markdown: string): string | null {
	const lines = markdown.split('\n');

	// Find the first contiguous block of table rows
	let tableLines: string[] = [];
	let inTable = false;

	for (const line of lines) {
		if (isTableRow(line)) {
			inTable = true;
			tableLines.push(line);
		} else if (inTable) {
			break;
		}
	}

	if (tableLines.length === 0) return null;

	// Filter out separator rows, parse cells, escape, join
	const dataRows = tableLines
		.filter((line) => !isSeparatorRow(line))
		.map((line) => parseCells(line).map(escapeCSVCell).join(','));

	if (dataRows.length === 0) return null;

	return dataRows.join('\n');
}
