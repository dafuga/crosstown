# The bus's voice: where it comes from

## `voice.mp3` + `voice.json` (one file: every spoken part one after another; `voice.json` says where each lies: `clips[id] = [start s, length s]`)
- **Synthetic speech made on our own machine (bigbox) with a free, local text-to-speech engine. Nothing was sent to any service; no money and no paid quota was used.**
- Engine: **Piper** (`piper-tts` 1.8.0, GPL-3.0-or-later: the program; its output is not covered by that licence), run from the subway lane's
  venv (`lanes/subway/tools/venv-voice`).
- Voice: **`en_US-ljspeech-high`** from https://huggingface.co/rhasspy/piper-voices : model licence **MIT**; trained from scratch on
  **LJ Speech 1.1**, which is **public domain** (https://keithito.com/LJ-Speech-Dataset/). (Licences as read by the subway lane on Nov 14 2026,
  `game/assets/subway/voice/SOURCES.md`; not read again by the bus lane.) No voice was cloned; no recording of any transit system or of any
  real announcer is used or copied.
- Text to sounds: Piper's own phonemiser, **espeak-ng** (GPL-3.0-or-later, shipped inside the piper-tts wheel; a program, its output is not
  covered), voice `en`. Model file: `lanes/subway/tools/venv-voice/models/en_US-ljspeech-high.onnx` (+ `.onnx.json`: dataset `ljspeech`,
  one speaker, 22,050 Hz), read on bigbox Nov 15 2026.
- Encoding: ffmpeg with **LAME** (LGPL; an encoder, its output is not covered). Checking only, nothing of it in the game: `faster-whisper`
  1.2.1 (MIT) with Whisper `base.en` (MIT), on bigbox.
- Our processing (`lanes/bus/tools/voice-make.py`, using the subway lane's helpers `speak`, `chain`, `finish` unchanged): Piper length scale 1.02,
  the whole voice lowered by resampling x0.92 (so it is not the trains' voice), high-pass 95 Hz, a small presence lift, gentle levelling, trimmed
  to the speech, -20 dBFS speech level, peaks under -3 dBFS; the file is 24 kHz mono MP3 (ffmpeg / LAME), bitrate in `voice.json`.
- The wording is ours ("Next stop: ...", "This is ...", "This is the last stop on this bus.", "This is an M4 bus to ..."); street names, route
  numbers and destinations are facts from the open timetable data. The texts are made by `lanes/bus/src/bus/voice_text.js`
  (`node lanes/bus/tools/voice-list.mjs -v` lists every part).
- In the game (`src/bus/sound.js`) the parts are played one after another through a small "ceiling speaker" filter chain made in WebAudio.

## Parts
`p-next` "Next stop:", `p-this` "This is", `p-last` "This is the last stop on this bus.", `p-thisan` "This is an", `p-busto` "bus to",
`a-<street>` a first half of a stop's name spoken with its "and" ("Fifth Avenue and"), `s-<street>` a last half ("West 42nd Street."),
`r-<route>` a route number ("M 15 Select"), `h-<place>` where a bus goes ("Midtown, 32nd Street and Fifth Avenue.").
A new stop or route: `voice-make.py render` speaks only the parts it does not have yet, then `build`, then `check` (all through paced).

## Everything else the buses sound like
Engine, electric whine, road, air brake, doors, kneeling beeper and the stop-requested chime are synthesised in code
(`src/bus/sound_core.js`): arithmetic only, nothing recorded, nothing copied.
