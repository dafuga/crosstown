# streets/carts: sources

Everything in this part is drawn by `game/src/streets/carts.js` at load (boxes, cylinders, canvas-painted signage). No model, photo or
logo from anywhere is shipped. All names on the carts are invented.

| file | what | source | licence |
|---|---|---|---|
| `halal_ar.png` (384x192, 6 kB) | the Arabic word حلال ("halal"), white on clear | rendered here with Pillow from GNU FreeFont, FreeSerif Bold (https://www.gnu.org/software/freefont/) | the word is a common word, not a mark; the font is GPL-3 with the font exception (text set in it carries no licence) |

Looked at for how the real carts are built (reference only, nothing copied into the game):

| photo | author / licence | used for |
|---|---|---|
| https://commons.wikimedia.org/wiki/File:Halal_Food_(26146800459).jpg | CC BY 2.0 | the LED sign on the roof edge, photo wrap on the body, drinks on the sill |
| https://commons.wikimedia.org/wiki/File:Halal_Food_Stand_at_Night_-_Manhattan_-_New_York_-_NY_-_USA_(52498013071).jpg | CC BY 2.0 | the lit photo-menu band, white tube lights, the row of water bottles, night look |
| https://commons.wikimedia.org/wiki/File:53rd_St_6th_Av_td_14_-_1301_6th_Avenue.jpg | CC BY-SA 4.0 | the south-west corner of W 53rd St and 6th Ave: carts on the kerb, umbrellas |
| https://commons.wikimedia.org/wiki/File:NYC_Hotdog_cart.jpg | CC BY 2.0 | the hot-dog pushcart |

Rules and sizes: NYC DOHMH "Regulations for Mobile Food Vendors" (cart at most 5 ft x 10 ft, 6-12 in from the kerb, 10 ft from a
crosswalk or subway entrance, 20 ft from a building entrance, long side along the kerb):
https://www.nyc.gov/assets/doh/downloads/pdf/rii/regulations-for-mobile-food-vendors.pdf

## Food photographs (food.jpg atlas)

`food.jpg` (1024x512, 4x3 tiles of 256x170) is the one place this part ships photographs. All twelve are from Wikimedia Commons;
licences were read from the Commons API (`extmetadata`) on 2026-11-15. Each was cropped and resized. Full-size downloads and the
build script are in `handoff-carts/trial/food-src/`.

- 0, chicken over rice: "Chicken over rice (16425553415).jpg", by T.Tseng, CC BY 2.0, https://commons.wikimedia.org/wiki/File:Chicken_over_rice_(16425553415).jpg, cropped and resized
- 1, gyro (döner) meat over rice: "Döner kebab at the office.jpg", by JIP, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:D%C3%B6ner_kebab_at_the_office.jpg, cropped and resized
- 2, platter over rice (chicken shawarma, white sauce, takeout tray): "Chicken Shwarama plate.jpeg", by User:CrunchySkies, CC BY-SA 3.0, https://commons.wikimedia.org/wiki/File:Chicken_Shwarama_plate.jpeg, cropped and resized
- 3, gyro wrap: "Lamb Gyros Sydney.jpg", by insatiablemunch, CC BY 2.0, https://commons.wikimedia.org/wiki/File:Lamb_Gyros_Sydney.jpg, cropped and resized
- 4, falafel in pita: "Falafel in a pita.jpg", by Israel_photo_gallery (photo: Dana Friedlander for the Israeli Ministry of Tourism), CC BY-SA 2.0, https://commons.wikimedia.org/wiki/File:Falafel_in_a_pita.jpg, cropped and resized
- 5, shish kebab on skewers: "Shish kebab (8670798905).jpg", by Shevchenko Alexander, CC BY 2.0, https://commons.wikimedia.org/wiki/File:Shish_kebab_(8670798905).jpg, cropped and resized
- 6, hot dog in a bun: "Hot Dogs on a Bun.jpg", by TheBusyBrain, CC BY 2.0, https://commons.wikimedia.org/wiki/File:Hot_Dogs_on_a_Bun.jpg, cropped and resized
- 7, Philly cheese steak: "Philly cheesesteak sandwich.jpg", by jeffreyw, CC BY 2.0, https://commons.wikimedia.org/wiki/File:Philly_cheesesteak_sandwich.jpg, cropped and resized
- 8, French fries: "French Fries.JPG", by StockSnap, CC0 1.0, https://commons.wikimedia.org/wiki/File:French_Fries.JPG, cropped and resized
- 9, knish: "Knish with potato.jpg", by UeArtemis, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:Knish_with_potato.jpg, cropped and resized
- 10, cold drinks: "El Coyote - January 2023 - Sarah Stierch 01.jpg", by Missvain (Sarah Stierch), CC BY 4.0, https://commons.wikimedia.org/wiki/File:El_Coyote_-_January_2023_-_Sarah_Stierch_01.jpg, cropped and resized
- 11, soft pretzel (New York street cart): "A great day in Manhattan, NYC. (2954326861).jpg", by Jazz Guy from New Jersey, United States, CC BY 2.0, https://commons.wikimedia.org/wiki/File:A_great_day_in_Manhattan,_NYC._(2954326861).jpg, cropped and resized
