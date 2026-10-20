# Mnemonic Lookup — starter app

A mobile-friendly PWA prototype with:
- Home screen with Scan Code and Look Up Poster choices
- Rear-camera access (requires HTTPS or localhost)
- OCR using Tesseract.js
- Manual code entry fallback
- Searchable poster gallery
- Result screen with poster, mnemonic code, and fixed quantity
- Home button and basic offline caching

## Important
The records in `data.json` are **sample placeholders**. Replace them with your real lookup table and poster filenames before sharing the app.

## Data format
Each entry in `data.json` should have:
```json
{
  "code": "ABC-123",
  "title": "Poster title",
  "quantity": 24,
  "image": "posters/abc-123.jpg"
}
```
`image` can be a relative path to an image file included in the site. If there is no image, use an empty string (`""`) and the app will show a placeholder.

## Updating your data
1. Edit `data.json` and add/remove records or change quantities.
2. Add the poster image files into the `posters/` folder.
3. Update each record's `image` path to match the filename exactly.
4. Publish/redeploy the site to update what all users see.

## Hosting
Upload the contents of this folder to a static hosting provider such as Netlify or Vercel. Use HTTPS. The app does not need a server-side database for fixed, read-only records. Anyone with the link can view the published lookup data, so don't put confidential information in it.

## OCR notes
OCR accuracy depends on the size, contrast, font, lighting, and angle of the mnemonic code. This prototype attempts to match known codes within recognized text and provides manual entry when OCR does not find a match. Test with your real printed codes before relying on it.


## Your lookup data

The sample data has been replaced with the 17 poster codes and quantities from `SRP Cart Posters - Sheet1.csv`. The `Picture` column in that spreadsheet was empty, so this version uses poster placeholders until image files are added. To add images, place each image in the app's `posters` folder and set that record's `image` field in `data.json` to its relative path (for example, `posters/mvpfbc1-E.jpg`).


## Poster images added

All 17 poster images from `poster_img.zip` were matched to their lookup codes and included in the `posters/` folder. The `data.json` records reference each corresponding image.
