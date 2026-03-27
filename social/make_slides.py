from PIL import Image, ImageDraw, ImageFont
import os, sys, json

W, H = 1080, 1920

def get_fonts():
    try:
        title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
        body = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 52)
        small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
        big = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 80)
    except:
        title = body = small = big = ImageFont.load_default()
    return title, body, small, big

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0,0), test, font=font)
        if bbox[2] > max_width:
            if current: lines.append(current)
            current = word
        else:
            current = test
    if current: lines.append(current)
    return lines

def make_slide(text, subtitle="", slide_num=0, total=0, is_hook=False, is_cta=False):
    img = Image.new('RGB', (W, H), (10, 10, 15))
    draw = ImageDraw.Draw(img)
    title_font, body_font, small_font, big_font = get_fonts()

    # Logo at top
    draw.ellipse([W//2-40, 60, W//2+40, 140], outline=(85,85,85), width=2)
    draw.text((W//2, 100), "35", fill=(0,212,255), font=title_font, anchor="mm")

    if is_hook:
        # Hook slide — big text, eye-catching
        y = 500
        lines = wrap_text(draw, text, big_font, W - 120)
        for line in lines:
            draw.text((W//2, y), line, fill=(255,255,255), font=big_font, anchor="mt")
            y += 100
        if subtitle:
            y += 30
            sub_lines = wrap_text(draw, subtitle, body_font, W - 100)
            for line in sub_lines:
                draw.text((W//2, y), line, fill=(200,200,200), font=body_font, anchor="mt")
                y += 65
    elif is_cta:
        # CTA slide — cyan accent
        y = 600
        lines = wrap_text(draw, text, title_font, W - 120)
        for line in lines:
            draw.text((W//2, y), line, fill=(0,212,255), font=title_font, anchor="mt")
            y += 80
        if subtitle:
            y += 20
            draw.text((W//2, y), subtitle, fill=(150,150,150), font=small_font, anchor="mt")
    else:
        # Content slide — body text, centered
        y = 600
        lines = wrap_text(draw, text, body_font, W - 100)
        total_height = len(lines) * 65
        y = (H - total_height) // 2
        for line in lines:
            draw.text((W//2, y), line, fill=(230,230,240), font=body_font, anchor="mt")
            y += 65

    # Slide counter
    if total > 0:
        draw.text((W//2, H-80), f"{slide_num}/{total}", fill=(80,80,80), font=small_font, anchor="mm")

    # CTA on last slide
    if is_cta:
        draw.text((W//2, H-80), "email35.com", fill=(0,212,255), font=small_font, anchor="mm")

    return img

def generate_post(post_data, output_dir):
    """Generate slides from post data dict with 'slides' list."""
    os.makedirs(output_dir, exist_ok=True)
    slides = post_data.get("slides", [])
    total = len(slides)
    
    for i, slide in enumerate(slides):
        is_hook = (i == 0)
        is_cta = (i == total - 1)
        text = slide.get("text", slide) if isinstance(slide, dict) else slide
        subtitle = slide.get("subtitle", "") if isinstance(slide, dict) else ""
        
        img = make_slide(text, subtitle, i+1, total, is_hook=is_hook, is_cta=is_cta)
        path = os.path.join(output_dir, f"slide{i+1}.jpg")
        img.save(path, "JPEG", quality=90)
    
    print(f"Generated {total} slides in {output_dir}")

# Default: generate from command line JSON or use built-in post
if __name__ == "__main__":
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        with open(sys.argv[1]) as f:
            post = json.load(f)
        generate_post(post, os.path.expanduser("~/email35/social"))
    else:
        # Default post — The Audacity
        post = {
            "slides": [
                "You buy ONE thing from a company",
                "Their email team: noted. Deploying 47 emails about spatulas.",
                "Also spatula accessories. Spatula insurance. Spatula newsletter.",
                "You hit unsubscribe.",
                "Them: how about emails about FORKS instead",
                {"text": "What if every email cost them $0.01?", "subtitle": "Suddenly they'd learn restraint. email35.com"}
            ]
        }
        generate_post(post, os.path.expanduser("~/email35/social"))
