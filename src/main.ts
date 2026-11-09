import { debounce, Editor, MarkdownView, Plugin, TAbstractFile, TFile } from "obsidian";
import { BOX_SELECTOR, FolderBox, setupBox, teardownBox } from "./carousel";
import { insertBlock } from "./insert";
import { FolderPickerModal, GallerySourceModal, ImagePickerModal } from "./modals";

interface Data {
	/** note path -> box key -> slide index last shown */
	positions: Record<string, Record<string, number>>;
}

const SCROLL_TEMPLATE = [
	"> [!infobox|scroll right third]",
	"> # Version 1",
	"> ![[image-1.png]]",
	"> | | |",
	"> | --- | --- |",
	"> | Field | Value |",
	">",
	"> ---",
	">",
	"> # Version 2",
	"> ![[image-2.png]]",
	"> | | |",
	"> | --- | --- |",
	"> | Field | Value |",
];

const GALLERY_HEADER = "> [!infobox|gallery right third]";

/**
 * Infobox Scroll
 *  > [!infobox|scroll]   versions separated by `---`, arrows switch between them
 *  > [!infobox|gallery]  images (or `folder: Some/Folder`), arrows switch between them
 */
export default class InfoboxScrollPlugin extends Plugin {
	data: Data = { positions: {} };
	private folderBoxes = new Set<FolderBox>();
	private docs = new Set<Document>();
	private requestSave = debounce(() => this.saveData(this.data), 1000, true);

	async onload() {
		this.data = Object.assign({ positions: {} }, await this.loadData());

		// Reading mode (and anything else Obsidian renders through post-processors).
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (el.matches(BOX_SELECTOR)) setupBox(this, el, ctx.sourcePath);
			el.querySelectorAll<HTMLElement>(BOX_SELECTOR).forEach((box) => setupBox(this, box, ctx.sourcePath));
		});

		// Live Preview renders callouts as editor widgets; pick those up as they appear.
		// One observer per window (main window + popouts).
		let scheduled = false;
		const observer = new MutationObserver(() => {
			if (scheduled) return;
			scheduled = true;
			window.requestAnimationFrame(() => {
				scheduled = false;
				this.scanAll();
			});
		});
		const watch = (doc: Document) => {
			this.docs.add(doc);
			observer.observe(doc.body, { childList: true, subtree: true });
			this.scanAll();
		};
		this.app.workspace.onLayoutReady(() => watch(document));
		this.registerEvent(this.app.workspace.on("window-open", (win) => watch(win.doc)));
		this.registerEvent(this.app.workspace.on("window-close", (win) => this.docs.delete(win.doc)));
		this.register(() => observer.disconnect());

		this.registerVaultEvents();
		this.registerInsert();
	}

	onunload() {
		this.requestSave.run();
		// Put rendered boxes back to plain infoboxes.
		for (const doc of this.docs) doc.querySelectorAll<HTMLElement>("[data-ifs-ready]").forEach(teardownBox);
	}

	// ------------------------------------------------------------- rendering

	private scanAll() {
		for (const doc of this.docs) {
			doc.querySelectorAll<HTMLElement>(`${BOX_SELECTOR}:not([data-ifs-ready])`).forEach((box) => {
				setupBox(this, box, this.sourcePathOf(box));
			});
		}
	}

	private sourcePathOf(el: HTMLElement): string {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.containerEl.contains(el)) return view.file?.path ?? "";
		}
		return this.app.workspace.getActiveFile()?.path ?? "";
	}

	trackFolderBox(box: FolderBox) {
		this.folderBoxes.add(box);
	}

	private pendingPaths: string[] = [];
	private refreshFolders = debounce(
		() => {
			const paths = this.pendingPaths;
			this.pendingPaths = [];
			for (const box of this.folderBoxes) {
				if (!box.el.isConnected) {
					this.folderBoxes.delete(box);
					continue;
				}
				if (paths.some((p) => p.startsWith(box.folderPath + "/"))) box.refresh();
			}
		},
		300,
		true
	);

	// ------------------------------------------------------------- remembered position

	loadIndex(notePath: string, key: string): number {
		return this.data.positions[notePath]?.[key] ?? 0;
	}

	saveIndex(notePath: string, key: string, index: number) {
		if (!notePath) return;
		const note = (this.data.positions[notePath] ??= {});
		if (index === 0) delete note[key];
		else note[key] = index;
		if (Object.keys(note).length === 0) delete this.data.positions[notePath];
		this.requestSave();
	}

	private registerVaultEvents() {
		const folderChange = (path: string) => {
			this.pendingPaths.push(path);
			this.refreshFolders();
		};
		this.registerEvent(this.app.vault.on("create", (f) => folderChange(f.path)));
		this.registerEvent(
			this.app.vault.on("delete", (f: TAbstractFile) => {
				folderChange(f.path);
				if (f instanceof TFile && this.data.positions[f.path]) {
					delete this.data.positions[f.path];
					this.requestSave();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (f: TAbstractFile, oldPath: string) => {
				folderChange(f.path);
				folderChange(oldPath);
				if (f instanceof TFile && this.data.positions[oldPath]) {
					this.data.positions[f.path] = this.data.positions[oldPath];
					delete this.data.positions[oldPath];
					this.requestSave();
				}
			})
		);
	}

	// ------------------------------------------------------------- insert menu

	private registerInsert() {
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, info) => {
				const sourcePath = info.file?.path ?? "";
				menu.addItem((item) =>
					item
						.setSection("selection.insert.basic")
						.setTitle("Infobox (scrollable)")
						.setIcon("lucide-gallery-horizontal")
						.onClick(() => this.insertScrollInfobox(editor))
				);
				menu.addItem((item) =>
					item
						.setSection("selection.insert.basic")
						.setTitle("Image (scrollable)")
						.setIcon("lucide-images")
						.onClick(() => this.insertGallery(editor, sourcePath))
				);
			})
		);

		this.addCommand({
			id: "insert-scrollable-infobox",
			name: "Insert scrollable infobox",
			icon: "lucide-gallery-horizontal",
			editorCallback: (editor) => this.insertScrollInfobox(editor),
		});
		this.addCommand({
			id: "insert-scrollable-image",
			name: "Insert scrollable image",
			icon: "lucide-images",
			editorCallback: (editor, ctx) => this.insertGallery(editor, ctx.file?.path ?? ""),
		});
	}

	private insertScrollInfobox(editor: Editor) {
		insertBlock(editor, SCROLL_TEMPLATE, "Version 1");
	}

	private insertGallery(editor: Editor, sourcePath: string) {
		const embed = (file: TFile) => "> !" + this.app.fileManager.generateMarkdownLink(file, sourcePath);
		new GallerySourceModal(this.app, (choice) => {
			if (choice === "folder") {
				new FolderPickerModal(this.app, (folder) =>
					insertBlock(editor, [GALLERY_HEADER, `> folder: ${folder.path}`])
				).open();
			} else if (choice === "pick") {
				new ImagePickerModal(this.app, [], (files) => {
					if (files.length === 0) return;
					insertBlock(editor, [GALLERY_HEADER, ...files.map(embed)]);
				}).open();
			} else {
				insertBlock(editor, [GALLERY_HEADER, "> ![[image-1.png]]", "> ![[image-2.png]]"], "image-1.png");
			}
		}).open();
	}
}
