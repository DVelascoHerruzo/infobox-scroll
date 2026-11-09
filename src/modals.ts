import { App, FuzzySuggestModal, SuggestModal, TFile, TFolder } from "obsidian";
import { IMAGE_EXTENSIONS, imagesIn } from "./carousel";

type Choice = { id: "pick" | "folder" | "template"; title: string; hint: string };

const CHOICES: Choice[] = [
	{ id: "folder", title: "Every image in a folder…", hint: "Scroll through a whole folder, e.g. a full deck" },
	{ id: "pick", title: "Pick images one by one…", hint: "Choose images, press Esc when done" },
	{ id: "template", title: "Empty template", hint: "Insert placeholders to fill in yourself" },
];

/** First step of "Image (scrollable)": how the images are chosen. */
export class GallerySourceModal extends SuggestModal<Choice> {
	constructor(app: App, private onPick: (choice: Choice["id"]) => void) {
		super(app);
		this.setPlaceholder("Scrollable image: where do the images come from?");
	}
	getSuggestions(query: string): Choice[] {
		const q = query.toLowerCase();
		return CHOICES.filter((c) => c.title.toLowerCase().includes(q));
	}
	renderSuggestion(choice: Choice, el: HTMLElement) {
		el.createDiv({ text: choice.title });
		el.createEl("small", { text: choice.hint, cls: "ifs-modal-hint" });
	}
	onChooseSuggestion(choice: Choice) {
		this.onPick(choice.id);
	}
}

export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	constructor(app: App, private onPick: (folder: TFolder) => void) {
		super(app);
		this.setPlaceholder("Folder with the images…");
	}
	getItems(): TFolder[] {
		// Folders that contain images first.
		const all = this.app.vault.getAllFolders(false);
		return all.sort((a, b) => Number(imagesIn(b).length > 0) - Number(imagesIn(a).length > 0));
	}
	getItemText(folder: TFolder): string {
		const n = imagesIn(folder).length;
		return n ? `${folder.path}  (${n} image${n === 1 ? "" : "s"})` : folder.path;
	}
	onChooseItem(folder: TFolder) {
		this.onPick(folder);
	}
}

/**
 * Picks images one at a time; after each pick it reopens so you can add another.
 * Esc finishes and calls `done` with everything picked so far.
 */
export class ImagePickerModal extends FuzzySuggestModal<TFile> {
	private chosen = false;

	constructor(app: App, private picked: TFile[], private done: (files: TFile[]) => void) {
		super(app);
		this.setPlaceholder(
			picked.length === 0 ? "Pick the first image…" : `${picked.length} picked. Pick another, or press Esc to insert`
		);
	}
	getItems(): TFile[] {
		return this.app.vault
			.getFiles()
			.filter((f) => IMAGE_EXTENSIONS.has(f.extension.toLowerCase()) && !this.picked.includes(f));
	}
	getItemText(file: TFile): string {
		return file.path;
	}
	onChooseItem(file: TFile) {
		this.chosen = true;
		new ImagePickerModal(this.app, [...this.picked, file], this.done).open();
	}
	onClose() {
		super.onClose();
		// Obsidian closes the modal *before* calling onChooseItem, so wait a tick.
		window.setTimeout(() => {
			if (!this.chosen) this.done(this.picked);
		}, 0);
	}
}
