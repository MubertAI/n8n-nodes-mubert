# @mubert/n8n-nodes-mubert

This is an n8n community node. It lets you use [Mubert](https://mubert.com/api) in your n8n workflows.

Mubert generates royalty-free music from a text prompt, a genre or mood channel, or an image — at the exact length you ask for. Use it to add background music to automated videos (Shorts, Reels, TikTok, ads), apps, games and podcasts.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `@mubert/n8n-nodes-mubert`.

## Operations

**Track**

- **Generate** — generate a track of an exact length from:
  - a **text prompt** (up to 255 characters),
  - a **playlist** — a genre, mood or activity channel, with optional BPM and key,
  - an **image** from a binary field (PNG, JPG, WEBP or BMP, 50 KB – 10 MB).

  Options: duration, intensity (low / medium / high), mode (track, loop, jingle, mix), format (mp3 / wav), bitrate.
- **Generate Similar** — a new variation of an existing track. Keeps the original length, intensity and mode unless you change them.
- **Edit** — a new version of a track with instruments or stems deleted or replaced, or with a new length, intensity or format.
- **Get** — a track and a fresh download link, optionally with the audio file.
- **Get Many** — tracks generated with these credentials.

**Playlist**

- **Get Many** — the channels you can generate from (for example `Genres / Hiphop / Lofi`).

Generation is asynchronous. By default the node waits until the track is ready (usually 5–30 seconds) and downloads it into a binary field, so the next node — a video renderer, Google Drive, YouTube upload — gets the file directly. You can turn off waiting and fetch the track later with **Get**.

Notes:

- **Edit** and **Generate Similar** create a new track and use your quota.
- Download links are short-lived. The node fetches a fresh link right before downloading.
- The node can be used as a tool by the AI Agent node.

## Credentials

Two ways to connect:

**Mubert Automation API (recommended).** One API key `mk_…`.

1. No key yet? Add a Mubert node, choose **Account → Get Free Key**, enter your email and run it. You get a key instantly with a few free tracks, valid for 7 days. The output shows the exact limits.
2. Create a **Mubert Automation API** credential and paste the key.
3. **Account → Get Usage** shows how many tracks are left.

**Customer ID and Access Token.** For existing Mubert API customers.

1. Get an API plan at [mubert.com/api](https://mubert.com/api). You receive a `company-id` and a `license-token`.
2. Create a customer with `POST https://music-api.mubert.com/api/v3/service/customers` using those headers and any `custom_id`. The response contains the customer `id` and `access.token`.
3. Create a **Mubert API** credential: Customer ID = the customer `id` (not `access.id`), Access Token = `access.token`. The token renews itself while in use and expires after about a month of inactivity.

## Compatibility

Built and tested with n8n 2.43.

## Usage

**Background music for an automated video.** Put the Mubert node before your render step (Creatomate, Shotstack, JSON2Video, FFmpeg API). Set **Duration** to the video length in seconds, describe the mood in **Prompt** and set **Intensity** to *Low* if there is a voice-over. The audio comes out in the `data` binary field.

**A music bed for a long video.** Use the **Playlist** source with a channel such as `Genres / Hiphop / Lofi`, mode **Loop**, and a long duration.

**Another version.** Use **Edit → Delete Stems → Drums** for a calmer version of the same track, or **Generate Similar** for a variation.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Mubert API](https://mubert.com/api)
- [Mubert API documentation](https://mubert.com/api/docs)

## Version history

### 0.1.2

Official Mubert logo.

### 0.1.1

Published from GitHub Actions with npm provenance.

### 0.1.0

First release: generate (prompt, playlist, image), generate similar, edit, get, get many tracks; get many playlists; free key and usage via the Mubert Automation API.
