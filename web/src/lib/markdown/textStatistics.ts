export interface TextStats {
	wordCount: number;
	characterCount: number;
	lineCount: number;
}

export function computeTextStatistics(text: string): TextStats {
	const characterCount = text.length;

	if (text.length === 0) {
		return { wordCount: 0, characterCount: 0, lineCount: 0 };
	}

	// Split on whitespace, omitting empty subsequences (matches Swift's split(omittingEmptySubsequences: true))
	const words = text.split(/\s+/).filter((w) => w.length > 0);
	const wordCount = words.length;

	// Count newline characters (\n and \r), matching Swift's isNewline
	const newlineCount = [...text].filter((ch) => ch === '\n' || ch === '\r').length;
	const lineCount = newlineCount + 1;

	return { wordCount, characterCount, lineCount };
}
