# Privacy Policy — TextPad

**Last updated:** 2026-07-29

## Data Collection
TextPad does **not** collect, store, or transmit any personally identifiable information (PII).  
All file content is stored **locally** in your browser's IndexedDB.
## Cloud Sync (Optional)

If you enable cloud sync, your data passes through the sync relay server. **The relay server cannot read any of your content** — encryption keys never leave your device:

- **File content, deltas, and full snapshots** are encrypted with AES-256-GCM **on your device** before upload (using the same key that encrypts local storage).
- The server stores only **opaque ciphertext blobs** — it never sees plaintext content, plaintext diffs, or your key material, and performs no content processing.
- **Version history is also encrypted**: pulling older versions returns ciphertext patches that are decrypted and applied locally (in a Web Worker).
- The server stores metadata it needs to route sync (device id, file id, name, version numbers, timestamps). File **names** are transmitted in plaintext for the file list.

## Third-Party Services

- No analytics, no telemetry, no cookies are used.
- Fonts (Inter, JetBrains Mono) are self-hosted — no external requests.
- On the free hosting tier (Render), the relay database is ephemeral and may be reset without notice — your files are always safe on your device and re-upload as needed.
## Data Retention
All data is stored locally. You can clear it at any time via browser storage settings or by uninstalling the app.

## Contact
Open an issue at the project repository for privacy concerns.
