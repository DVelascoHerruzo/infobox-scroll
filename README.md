# Infobox Scroll

Infoboxes and images you can flip through. Arrows on the sides of the box switch it to the next version, so your note can stay the same while the box changes.

Some ways to use it:
- **Tarot or card decks:** a note about a card that flips between different artists' versions of it, or a box that pages through a whole deck.
- **Characters and parties:** scroll through every member of a party, or through different portraits of one character.
- **Places, items, timelines:** anything with several versions you want to compare in one spot.

Built for [ITS Theme](https://github.com/SlRvb/Obsidian--ITS-Theme) infoboxes. Pair it with **[Infobox Live](https://github.com/DVelascoHerruzo/obsidian-infobox-live)** so the boxes also float beside your text in Live Preview.

## Scrollable infobox
Write each version of the infobox one after another, separated by a `---` line:

```
> [!infobox|scroll right third]
> # El Mago (Rider-Waite)
> ![[El Mago - Rider-Waite.png]]
> | Number | I |
> | Element | Air |
>
> ---
>
> # El Mago (Thoth)
> ![[El Mago - Thoth.png]]
> | Number | I |
> | Element | Air |
```

Keep the empty `>` lines above and below `---`. Without them, Markdown turns the line above it into a heading.

## Scrollable image
List the images:

```
> [!infobox|gallery right third]
> ![[El Mago - Rider-Waite.png]]
> ![[El Mago - Thoth.png]]
> ![[El Mago - Marseille.png]]
```

Or show **every image in a folder**:

```
> [!infobox|gallery right third]
> folder: Decks/Major Arcana
```

- The folder can be its full path in the vault, a path relative to the note, or just the folder's name if no other folder shares it.
- Images are sorted by name with numbers in natural order (1, 2, 3 … 10, 21), and the file name is shown under each image.
- Images added to or removed from the folder appear in the box automatically.

## Using the arrows
- Click **‹** or **›** on the sides of the box. After the last version it goes back to the first.
- The counter in the corner shows where you are, e.g. `2 / 5`.
- Each box **remembers** the version it was last showing, even after you close the note. This is stored in the plugin's settings data, never in your note.
- Without the plugin, the box shows all of its versions one after another, so nothing is lost.

## Insert menu
Right-click in a note and open **Insert**:
- **Infobox (scrollable):** a two-version infobox template.
- **Image (scrollable):** choose *Every image in a folder…*, *Pick images one by one…* (press Esc when you're done picking), or *Empty template*.

The command palette has **Insert scrollable infobox** and **Insert scrollable image** too, which you can also use as hotkeys or `/` slash commands.

## Installation

### From Community plugins
1. In Obsidian, open **Settings → Community plugins** and make sure Restricted mode is off.
2. Select **Browse**, search for **Infobox Scroll**, then select **Install** and **Enable**.

### With BRAT, for beta versions or before the plugin is listed
1. Install and enable the **BRAT** plugin from Community plugins.
2. Run the command **BRAT: Add a beta plugin for testing** and paste:
   `https://github.com/DVelascoHerruzo/obsidian-infobox-scroll`
3. Enable **Infobox Scroll** in **Settings → Community plugins**.

### Manually
1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/DVelascoHerruzo/obsidian-infobox-scroll/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/infobox-scroll/`. Create the folder if it doesn't exist. The `.obsidian` folder is hidden, so turn on "show hidden files" if you can't see it.
3. Restart Obsidian, or reload plugins, then enable **Infobox Scroll** in **Settings → Community plugins**.

## Compatibility
- Images must be inside your vault, because Obsidian can't display files from outside it.
- Desktop and mobile. Requires Obsidian 1.6.6 or newer.

## Development
```
npm install
npm run dev     # rebuild on change
npm run build   # type-check + production build
```
The build copies the plugin into a test vault's `.obsidian/plugins/infobox-scroll/` folder. Set `OBSIDIAN_VAULT` to choose the vault.

To release a new version:
1. Bump `version` in `manifest.json` and `package.json`, and add the new version to `versions.json`.
2. Build, commit and push.
3. Run `gh release create <version> main.js manifest.json styles.css`. The tag has no `v` prefix.

## License
[MIT](LICENSE)
