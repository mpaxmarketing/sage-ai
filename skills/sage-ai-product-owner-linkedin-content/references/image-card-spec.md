# Image card specification

Every post gets one image card. A card is one standalone HTML document stored in the item's media_source_code. ProductSage stores it and does not render it. The Product Owner renders it to a PNG in Chrome and uploads the PNG to LinkedIn with the post.

## Dimensions

The card is 1080 by 1350 pixels, the LinkedIn portrait ratio. The html and body are locked to that size.

    html, body { width:1080px; height:1350px; overflow:hidden; }

The body is the card. There is no padding around it. That lets the full size screenshot capture an exact 1080 by 1350 PNG with nothing extra. The validator checks the lock.

## Brand slots

The colors, fonts, and watermark come from the Product Owner's content profile. Never use values from another Product Owner. If a slot is empty, ask for it before building the cards.

| Slot | Use |
| --- | --- |
| background | The card ground. |
| accent | The top and bottom bars, and emphasis inside the headline. |
| text | The headline. |
| muted text | The subtext. |
| watermark text | The company name in the footer. |
| watermark color | Low contrast, so it does not compete. |
| heading font | The headline. Use a heavy weight. |
| body font | The subtext and the watermark. |

Where the Product Owner has no brand development document, choose restrained values and tell them they are placeholders to replace.

## Required elements

- A top bar and a bottom bar in the accent color, 10px each.
- The background in the background color. A very faint diagonal texture is allowed, at about 1 percent opacity.
- The headline from the image text, at roughly 96 to 112px in the heading font, with letter spacing of about minus 0.02em. Use the accent color to emphasize a word or two.
- The subtext from the image text, at roughly 38 to 44px in the body font and muted text color. For a list post, use the points instead, at a size that fits.
- A watermark with the watermark text, in spaced uppercase, about 20px, centered above the bottom bar.
- A font import at the top of the style tag. The default is a Google Fonts import, so the card must be opened over HTTP and not as a local file. A Product Owner who prefers system fonts sets a system font stack in the profile, and the card then renders anywhere.
- No script tag. No external image. No percent sign that is not a CSS value.
- No em dash or en dash.

## One layout concept per card

Each card in a batch has its own layout concept, invented from the topic of its post. Do not reuse one layout for the batch. The headline and subtext still come from the image text. Examples that worked: a checkbox swap for a post about work that finally got done. A giant ghost numeral for a post about a team of two. A three icon loop for a post about a cycle. A size contrast treatment for a post about small and big. Build the concept from CSS shapes and type. Keep the HTML compact, because the cards drive the file size.

## Skeleton

Start from this and change the layout, not the slots. Replace each value in curly braces with the Product Owner's slot value.

    <!DOCTYPE html>
    <html lang="en"><head><meta charset="UTF-8"><style>
    @import url('{font import url}');
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:1080px;height:1350px;overflow:hidden;background:{background}}
    .bar{position:absolute;left:0;width:1080px;height:10px;background:{accent}}
    .top{top:0}.bottom{bottom:0}
    .wrap{position:absolute;left:90px;right:90px;top:180px}
    h1{font-family:{heading font};font-weight:900;font-size:104px;line-height:1.02;letter-spacing:-0.02em;color:{text}}
    h1 em{font-style:normal;color:{accent}}
    p{margin-top:48px;font-family:{body font};font-size:40px;line-height:1.35;color:{muted text}}
    .mark{position:absolute;bottom:48px;left:0;width:1080px;text-align:center;font-family:{body font};font-weight:500;font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:{watermark color}}
    </style></head><body>
    <div class="bar top"></div>
    <div class="wrap"><h1>{headline with <em>emphasis</em>}</h1><p>{subtext}</p></div>
    <div class="mark">{watermark text}</div>
    <div class="bar bottom"></div>
    </body></html>

## Rendering a card to a PNG

The Product Owner does this for each card they want to use.

1. Take the HTML from the item's media_source_code and save it as a file ending in .html.
2. Serve the folder over HTTP. For example, run npx serve in the folder.
3. Open the file in Chrome at http://localhost:3000/filename.html. Fonts load from the internet.
4. Open Chrome DevTools with F12.
5. Turn on the device toolbar with Ctrl+Shift+M and set the dimensions to 1080 by 1350.
6. Open the command palette with Ctrl+Shift+P, type screenshot, and choose Capture full size screenshot.
7. Chrome saves a PNG at exactly 1080 by 1350. That PNG goes to LinkedIn with the post.
