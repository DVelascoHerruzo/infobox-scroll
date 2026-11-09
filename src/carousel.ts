import { normalizePath, setIcon, TFile, TFolder, Vault } from "obsidian";
import type InfoboxScrollPlugin from "./main";

export const BOX_SELECTOR =
	'.callout[data-callout~="infobox"]:is([data-callout-metadata~="scroll"], [data-callout-metadata~="gallery"])';

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "bmp"]);

const FOLDER_LINE = /^\s*folder:\s*(.+?)\s*$/i;

/** A slide is shown by showing its nodes; every other slide's nodes get `.ifs-hidden`. */
interface Source {
	count(): number;
	show(index: number): void;
	signature: string;
}

/** Live folder galleries, refreshed when images are added/removed/renamed. */
export interface FolderBox {
	el: HTMLElement;
	folderPath: string;
	refresh(): void;
}

function hash(text: string): string {
	let h = 5381;
	for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

/** `---` inside a callout renders as <hr> (Reading mode may wrap it in a div). */
function isSeparator(el: Element): boolean {
	if (el.tagName === "HR") return true;
	return el.children.length === 1 && el.firstElementChild?.tagName === "HR" && !el.textContent?.trim();
}

function toggle(groups: HTMLElement[][], index: number) {
	groups.forEach((nodes, i) => nodes.forEach((n) => n.toggleClass("ifs-hidden", i !== index)));
}

// ---------------------------------------------------------------- infobox|scroll

function scrollSource(content: HTMLElement): Source | null {
	const groups: HTMLElement[][] = [[]];
	for (const child of Array.from(content.children) as HTMLElement[]) {
		if (isSeparator(child)) {
			child.addClass("ifs-sep");
			groups.push([]);
		} else {
			groups[groups.length - 1].push(child);
		}
	}
	const slides = groups.filter((g) => g.length > 0);
	if (slides.length === 0) return null;
	const signature = slides
		.map((g) => {
			const heading = g.find((e) => /^H[1-6]$/.test(e.tagName));
			return (heading ?? g[0]).textContent?.trim().slice(0, 60) ?? "";
		})
		.join("|");
	return { signature: "s:" + signature, count: () => slides.length, show: (i) => toggle(slides, i) };
}

// ---------------------------------------------------------------- infobox|gallery

function embedGallerySource(content: HTMLElement): Source | null {
	const items = Array.from(content.querySelectorAll<HTMLElement>(".internal-embed.image-embed, img")).filter(
		(el) => el.tagName !== "IMG" || !el.closest(".internal-embed")
	);
	if (items.length === 0) return null;
	const signature = items.map((el) => el.getAttribute("src") ?? "").join("|");
	return { signature: "g:" + signature, count: () => items.length, show: (i) => toggle(items.map((el) => [el]), i) };
}

export function resolveFolder(vault: Vault, raw: string, sourcePath: string): TFolder | null {
	const name = raw.replace(/^\[\[|\]\]$/g, "").replace(/^\/+|\/+$/g, "");
	if (!name) return null;
	const direct = vault.getFolderByPath(normalizePath(name));
	if (direct) return direct;
	const dir = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
	if (dir) {
		const relative = vault.getFolderByPath(normalizePath(`${dir}/${name}`));
		if (relative) return relative;
	}
	// Fall back to a unique folder with that name anywhere in the vault.
	const byName = vault.getAllFolders().filter((f) => f.name === name);
	return byName.length === 1 ? byName[0] : null;
}

export function imagesIn(folder: TFolder): TFile[] {
	return folder.children
		.filter((f): f is TFile => f instanceof TFile && IMAGE_EXTENSIONS.has(f.extension.toLowerCase()))
		.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: "base" }));
}

function folderGallerySource(
	plugin: InfoboxScrollPlugin,
	box: HTMLElement,
	content: HTMLElement,
	sourcePath: string,
	onRefresh: () => void
): Source | null {
	const line = Array.from(content.children).find((el) => el.tagName === "P" && FOLDER_LINE.test(el.textContent ?? ""));
	if (!line) return null;
	const folderName = FOLDER_LINE.exec(line.textContent ?? "")![1];
	line.addClass("ifs-sep");

	const holder = createDiv({ cls: "ifs-folder" });
	line.after(holder);
	const img = holder.createEl("img", { attr: { draggable: "false" } });
	const caption = holder.createDiv({ cls: "ifs-caption" });

	let files: TFile[] = [];
	const load = () => {
		const folder = resolveFolder(plugin.app.vault, folderName, sourcePath);
		files = folder ? imagesIn(folder) : [];
		holder.toggleClass("ifs-empty", files.length === 0);
		if (!folder) caption.setText(`Folder not found: ${folderName}`);
		else if (files.length === 0) caption.setText(`No images in ${folder.path}`);
		return folder;
	};
	const folder = load();

	plugin.trackFolderBox({
		el: box,
		folderPath: folder?.path ?? normalizePath(folderName),
		refresh: () => {
			load();
			onRefresh();
		},
	});

	return {
		signature: "f:" + (folder?.path ?? folderName),
		count: () => files.length,
		show: (i) => {
			const file = files[i];
			if (!file) {
				img.removeAttribute("src");
				img.hide();
				return;
			}
			img.show();
			img.src = plugin.app.vault.getResourcePath(file);
			img.alt = file.basename;
			img.title = file.name;
			caption.setText(file.basename);
		},
	};
}

// ---------------------------------------------------------------- shared controls

function swallow(el: HTMLElement, onClick?: () => void) {
	// Stop Live Preview from moving the cursor into the callout (which would show its source).
	for (const type of ["pointerdown", "mousedown", "mouseup", "dblclick", "contextmenu"]) {
		el.addEventListener(type, (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
	}
	el.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onClick?.();
	});
}

/** Turns one scroll/gallery infobox into a carousel. Safe to call repeatedly. */
export function setupBox(plugin: InfoboxScrollPlugin, box: HTMLElement, sourcePath: string) {
	if (box.dataset.ifsReady) return;
	const content = box.querySelector<HTMLElement>(":scope > .callout-content");
	if (!content || content.childElementCount === 0) return; // not rendered yet; we'll be called again

	const meta = (box.getAttribute("data-callout-metadata") ?? "").split(/\s+/);
	const isGallery = meta.includes("gallery");

	let index = 0;
	let source: Source | null = null;
	const update = () => {
		const count = source?.count() ?? 0;
		if (index >= count) index = 0;
		box.toggleClass("ifs-single", count <= 1);
		source?.show(index);
		counter.setText(count ? `${index + 1} / ${count}` : "");
	};

	if (isGallery) {
		source = folderGallerySource(plugin, box, content, sourcePath, update) ?? embedGallerySource(content);
	} else {
		source = scrollSource(content);
	}
	if (!source) return;

	box.dataset.ifsReady = "1";
	box.addClass("ifs-box", isGallery ? "ifs-gallery" : "ifs-scroll");

	const key = hash(source.signature);
	const go = (delta: number) => {
		const count = source!.count();
		if (count === 0) return;
		index = (index + delta + count) % count;
		update();
		plugin.saveIndex(sourcePath, key, index);
	};

	const prev = box.createDiv({ cls: "ifs-arrow ifs-prev", attr: { "aria-label": "Previous" } });
	setIcon(prev, "lucide-chevron-left");
	swallow(prev, () => go(-1));
	const next = box.createDiv({ cls: "ifs-arrow ifs-next", attr: { "aria-label": "Next" } });
	setIcon(next, "lucide-chevron-right");
	swallow(next, () => go(1));
	const counter = box.createDiv({ cls: "ifs-counter" });

	index = plugin.loadIndex(sourcePath, key);
	update();
}

/** Undoes setupBox (used when the plugin is disabled), leaving the plain infobox. */
export function teardownBox(box: HTMLElement) {
	box.querySelectorAll(":scope > .ifs-arrow, :scope > .ifs-counter, .ifs-folder").forEach((el) => el.remove());
	box.querySelectorAll(".ifs-hidden, .ifs-sep").forEach((el) => el.removeClass("ifs-hidden", "ifs-sep"));
	box.removeClass("ifs-box", "ifs-gallery", "ifs-scroll", "ifs-single");
	delete box.dataset.ifsReady;
}
