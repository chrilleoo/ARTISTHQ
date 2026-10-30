Project HQ v4.6 — Audioverktyg

YouTube -> MP3 anvander yt-dlp + FFmpeg.
Om de inte redan finns pa datorn forsoker appen vid forsta nedladdningen
hamta dem automatiskt fran deras officiella utgivare over HTTPS.
- yt-dlp: github.com/yt-dlp/yt-dlp/releases
- FFmpeg essentials Windows: gyan.dev/ffmpeg/builds/

SHA-256 verifieras mot utgivarnas hashfiler innan binarerna anvands.
Forsta nedladdningen kan vara cirka 130 MB och ta ett par minuter.
Verktygen ligger da i samma mapp som denna fil (inte globalt installerade).
Internet och Windows PowerShell kravs for forsta gangen.

Om en officiell server ar nere kan det forsta forsoket misslyckas.
Appen visar da feltexten och du kan forsoka igen senare.

Valfritt: lagg yt-dlp.exe och ffmpeg.exe i denna mapp sjalv
for att slippa internet och automatisk hamtning.
