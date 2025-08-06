# video-sort-ai

Sort videos on Android. Written in blazing fast Rust 🦀⚡

> [!IMPORTANT]
> This project does not directly involve generative artificial intelligence.

## Installation

Run this in Termux to install the latest version:

```sh
curl -L "https://github.com/SheepTester/video-sort-ai/releases/latest/download/video-sort" > video-sort
chmod +x video-sort
```

You also need `ffmpeg` on your `PATH`.

Then, run

```sh
./video-sort
```

## Why

<details>
<summary>holy yappage</summary>

I have a Pixel 4a 5g, which has been grandfathered into having unlimited Google Photos storage with the "storage saver" option. This is great for photos, and Google Photos has a convenient button that deletes already backed up photos and videos.

However, I don't trust how it compresses videos---though tbh at this point my senile phone's video quality already looks crunchy---so I want to manually review the videos on my phone to see if I should upload them to another platform, like YouTube or TikTok, before they get compressed by Google Photos. This way, although the video ends up compressed anyways, I avoid double compression. But because I'm lazy, I don't want to review all the videos, so I can't click Google Photo's "free up space" button, so my phone runs out of storage.

The Google Photos app doesn't let you filter by both media type (e.g. video) and whether it's on device, but the Files app does show videos on device. The Files app is good enough tbh, but I find the UX to be suboptimal. For example, deleting a video just marks it as trashed, so you need to go through a separate step to delete it off my phone. The Files app does let you upload a video directly to YouTube, which my app can't offer.

Another issue is that as I'm sorting through videos, there are similar videos that I want to concatenate together on TikTok, which has a decent video editor. That takes effort, though, so I put it off. But it's difficult to make small groups of videos in the Files app I think.

blah blah blah

Another issue is that on TikTok, they use a custom video selector that has all videos together in one stream, most recent first. So I have to sort videos from most recent to earliest, which is fine I guess.

</details>

### Why Rust?

I would be more comfortable working with JS, especially since performance is not a major concern here. However, binary size is (after all, I'm trying to free up space on my phone), and I don't want to install Node on my phone (I think I already uninstalled it). With Rust, a standalone binary will only be a few megabytes.

Plus, I already have a build-and-release GitHub Action set up from [hotspot-drop](https://github.com/SheepTester/hotspot-drop), so part of the hard work has been taken care of.

## Goals

I want a CLI program that starts an HTTP server. In the browser, it will list every video chronologically.

- You can preview each video in the browser, then assign it lightweight tags and notes.
- I might need to generate thumbnails for every video with `ffmpeg` (which I think I have installed on my phone).
- There should be an option to permanently delete off of my phone by tag (or select an individual video).
- There should be an option to move a video between Termux storage and the Downloads folder.
  - `termux-media-scan` will make the video visible to Android again.
- Dark theme.

## Development

```shell
# Create a tag
$ git tag -a "$(cargo pkgid | cut -d "#" -f2 | cut -d "@" -f2)"
$ git push --tags
```
