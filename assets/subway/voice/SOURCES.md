# The subway's sound: where every sound comes from

## The announcer: `announcer.mp3` (one MIXED file: 107 spoken parts one after another, each on our own station bed; `voice.json` says where each lies)
- **Synthetic speech from ElevenLabs text-to-speech**, made Nov 14 2026 by `lanes/subway/tools/voice-eleven.py render` (model `eleven_multilingual_v2`)
  on the company's ElevenLabs account (Creator plan; key `elevenlabs-nyc`; order: Matt through CHIEF, Nov 14 19:23Z). 1,742 characters in all (one run of 1,646, then ten parts made again without words-after, 96).
  Nov 15 2026 (CHIEF's yes, 10:45 ET): ten more station names for the stations added since (50 St, 59 St-Columbus Circle, 7 Av, 57 St-7 Av, Grand Central-42 St,
  51 St, 5 Av/53 St, Lexington Av/53 St, 57 St, 5 Av/59 St), same voice and settings, 282 characters, inside the plan's monthly characters; the file now holds 107 parts.
- **Two of ElevenLabs' own stock ("premade") library voices. No voice was cloned or designed from anyone's recording.**
  - station, transfer and next-stop lines (`who: car`): **"Matilda"**, voice id `XrExE9yKIg1WjnnlVkGX` (ElevenLabs' labels: female, American, middle-aged)
  - "Stand clear of the closing doors, please.", the platform lines and notices (`who: safety`): **"Bill"**, id `pqHfZKP75CvOlQylNhV4` (male, American, older, "crisp")
  - settings: stability 0.75, similarity 0.75, style 0, speed 0.95 / 0.97 (`tools/voice-eleven.json`). The voices were picked by their labels; nobody auditioned them.
- **No recording of the real subway system, and no real announcer's voice, is used or copied.** The wording is the real system's (the order above);
  station names and line letters are facts. The words are in `src/subway/voice-phrases.js`. ElevenLabs was sent the announcement texts and nothing else.
- **Licence**: ElevenLabs output on a paid plan may be used in a game only combined with other material, never as isolated generated output
  (Creative Terms Exhibit 4 s2, as CHIEF read it, lanes/INBOX.md 15:21Z Nov 14; ruling Nov 14 17:46 ET: every part must itself be a mixed cue).
  So no part of the file is bare speech. The single takes stay in `lanes/subway/out/voice/eleven-raw/` (never in the build or a hand-over). Keep it so.
- **What is mixed into every part, all of it ours, made in code by `tools/voice-sprite.py` (numpy; seeded noise and sines; nothing recorded, nothing
  from the MTA or the real system, no ElevenLabs sound):**
  - **a station bed** (`bed()`): ventilation air (pink noise, 120 Hz to 5 kHz, -40 dBFS), a far low rumble (noise, 40 to 75 Hz, -44 dBFS) and a faint
    mains hum (120 + 240 Hz, -54 dBFS). It runs unbroken through the whole file, so it lies under the speech of all 97 parts (20 dB under the
    speech) and in every gap between them; the mix is made before encoding, so it cannot be taken out again.
  - **our call tone** (`calltone()`: one soft open fifth, C5 + G5, two decaying sines) in the 0.72 s before each of the six parts a platform
    announcement can begin with (`a-there`, `a-therean`, `a-edge`, `n-1`, `n-2`, `n-3`; `"pre"` in `voice.json`). `voice.js` plays it from the
    file with the part and no longer makes that tone at run time.
  - the file opens with **our two-tone chime** (1.5 s) and 3 s of the bed alone (`"bed"` in `voice.json`).
- How the game plays it (`src/subway/voice.js`): a part is cut from the file WITH its bed and 45 ms of bed alone each side, never trimmed to the
  speech; joined parts overlap by those 45 ms and a pause inside an announcement is filled from the 3 s of bed, so the bed is even through an announcement.
- Measured on the shipped file (`voice-sprite.py measure`, `voice-joins.py`; out/voice/measure.txt, joins.txt; Nov 14): over all 97 parts the
  share of our bed found under the speech is 0.93 to 0.96 (1 = all of it); the quietest 10 ms inside any part is -43.1 dBFS (speech alone: silence);
  in all 162 phrases joined as the game joins them the joins and pauses hold -40.9 to -36.7 dBFS (bed alone: -39). A machine's numbers: nobody has
  listened to the mixed file yet.
- Processing of each take (ours, `tools/voice-sprite.py`): trimmed to the speech, speech level -20 dBFS, peaks under -3 dBFS, short fades; the whole
  file 24 kHz mono MP3 at 64 kbit/s (ffmpeg / LAME).

## Everything else: made in the browser by `src/subway/voice.js` (WebAudio), nothing recorded, nothing copied
The two-tone door chime (two falling bell notes: a sine with three quick-dying partials each), the car
and platform loudspeaker sound (filters, soft clipping, echoes, a noise-made reverb), train rumble, wheel roar, rail joints, the rush of air, brake
and flange squeal, motor whine, air, door rumble, room tone and drips: oscillators and filtered noise (the game's own noise buffers).

## Kept beside it: a free voice (not in the build now)
`tools/voice-make.py render` makes the same parts with the Piper voice `en_US-ljspeech-high` (model MIT, https://huggingface.co/rhasspy/piper-voices;
trained from scratch on LJ Speech 1.1, public domain, https://keithito.com/LJ-Speech-Dataset/; both read Nov 14 2026), two speakers by processing.
It was the voice before the ElevenLabs key could speak; it is the fallback if the ElevenLabs terms ever rule the file out. Tools: `piper-tts` 1.8.0
(GPL-3.0-or-later; its output is not covered), `numpy`, `scipy`. Checking only: `faster-whisper` 1.2.1 (MIT) with Whisper `base.en` (MIT).

## Parts in `voice.json`
`c-*` car parts, `a-*` platform parts, `n-*` notices, `st-<name>` a station name, `bc-/bp-<where>` "Queens-bound" (car / platform speaker),
`rc-/rp-<line>` "F local train" (car / platform), `l-<line>` a line in a transfer list. A new station is one more `st-` part:
`voice-eleven.py render` asks ElevenLabs only for parts it does not have yet, then `voice-sprite.py build` (through paced) remakes the whole mixed file
(then `voice-sprite.py measure` and `node tools/voice-test.mjs`).
