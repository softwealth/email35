from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1080, 1920

def make_slide(text, subtitle, filename):
    img = Image.new('RGB', (W, H), (10, 10, 15))
    draw = ImageDraw.Draw(img)
    
    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72)
        sub_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 42)
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
    except:
        title_font = ImageFont.load_default()
        sub_font = title_font
        small_font = title_font
    
    # Logo
    draw.ellipse([W//2-60, 120, W//2+60, 240], outline=(85,85,85), width=3)
    draw.text((W//2, 180), "35", fill=(0,212,255), font=title_font, anchor="mm")
    
    # Title
    y = 400
    words = text.split()
    lines, current = [], ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0,0), test, font=title_font)
        if bbox[2] > W - 120:
            lines.append(current)
            current = word
        else:
            current = test
    if current: lines.append(current)
    
    for line in lines:
        draw.text((W//2, y), line, fill=(255,255,255), font=title_font, anchor="mt")
        y += 90
    
    # Subtitle
    y += 50
    for sub_line in subtitle.split("\n"):
        words = sub_line.split()
        sub_lines, current = [], ""
        for word in words:
            test = (current + " " + word).strip()
            bbox = draw.textbbox((0,0), test, font=sub_font)
            if bbox[2] > W - 100:
                sub_lines.append(current)
                current = word
            else:
                current = test
        if current: sub_lines.append(current)
        for line in sub_lines:
            draw.text((W//2, y), line, fill=(150,150,150), font=sub_font, anchor="mt")
            y += 55
    
    draw.text((W//2, H-100), "email35.com", fill=(0,212,255), font=small_font, anchor="mm")
    img.save(filename, "JPEG", quality=90)
    print(f"Created {filename}")

base = os.path.expanduser("~/email35/social")
os.makedirs(base, exist_ok=True)

make_slide("Your inbox should PAY YOU", "Every email you receive earns you money.\nSpam becomes impossible when sending\ncosts a penny.", f"{base}/slide1.jpg")
make_slide("Spam costs $0 to send. That's the problem.", "Email35 makes senders pay $0.01\nto reach you. Spammers can't\nafford to spam you.", f"{base}/slide2.jpg")
make_slide("How it works", "1. Get yourname@email35.com\n2. Share it everywhere\n3. Senders pay $0.01 to deliver\n4. Paid emails go to your real inbox", f"{base}/slide3.jpg")
make_slide("100 emails = $1/day = $365/year", "For doing nothing.\nYour attention has value.\nStop giving it away for free.", f"{base}/slide4.jpg")
make_slide("Get your free address now", "email35.com\nYour inbox, spam-free.", f"{base}/slide5.jpg")

print("All slides done!")
