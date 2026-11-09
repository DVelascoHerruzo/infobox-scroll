import { Editor } from "obsidian";

// Same helper as in the Infobox Live plugin (each plugin must work on its own).


const isQuote = (line: string) => /^\s*>/.test(line);
const isBlank = (line: string) => line.trim() === "";

/**
 * Inserts a block (callout) as its own paragraph near the cursor and selects `select`
 * (the first occurrence of that text inside the block) so the user can type over it.
 *
 * - On an empty line: the block replaces that line.
 * - On a text line: the block goes above it (an infobox must come *before* the text that wraps around it).
 * - Inside another quote/callout: the block goes after that quote, so it is not nested.
 * Blank lines are added where needed so the block doesn't merge with surrounding text.
 */
export function insertBlock(editor: Editor, lines: string[], select?: string) {
	let lineNo = editor.getCursor("from").line;
	const last = editor.lineCount() - 1;
	let replaceLine = false;

	if (isQuote(editor.getLine(lineNo))) {
		while (lineNo < last && isQuote(editor.getLine(lineNo + 1))) lineNo++;
		// Insert after the quote block.
		if (lineNo === last) {
			const end = { line: last, ch: editor.getLine(last).length };
			editor.replaceRange("\n\n" + lines.join("\n") + "\n", end);
			selectIn(editor, last + 2, lines, select);
			return;
		}
		lineNo++;
		if (isBlank(editor.getLine(lineNo))) replaceLine = true;
	} else if (isBlank(editor.getLine(lineNo))) {
		replaceLine = true;
	}

	const prev = lineNo > 0 ? editor.getLine(lineNo - 1) : "";
	const pre = lineNo > 0 && !isBlank(prev) ? "\n" : "";
	const body = lines.join("\n");
	let text: string;
	let to = { line: lineNo, ch: 0 };

	if (replaceLine) {
		const next = lineNo < last ? editor.getLine(lineNo + 1) : null;
		const post = next !== null && !isBlank(next) ? "\n" : "";
		text = pre + body + post;
		to = { line: lineNo, ch: editor.getLine(lineNo).length };
	} else {
		text = pre + body + "\n\n";
	}

	editor.replaceRange(text, { line: lineNo, ch: 0 }, to);
	selectIn(editor, lineNo + (pre ? 1 : 0), lines, select);
}

function selectIn(editor: Editor, firstLine: number, lines: string[], select?: string) {
	if (select) {
		for (let i = 0; i < lines.length; i++) {
			const ch = lines[i].indexOf(select);
			if (ch >= 0) {
				editor.setSelection({ line: firstLine + i, ch }, { line: firstLine + i, ch: ch + select.length });
				editor.focus();
				return;
			}
		}
	}
	const endLine = firstLine + lines.length - 1;
	editor.setCursor({ line: endLine, ch: lines[lines.length - 1].length });
	editor.focus();
}

