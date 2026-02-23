"""
Shareable Image Generator for Astronomical Events

Generates beautiful social media images featuring upcoming astronomical events
with MyAstroBoard branding and GitHub advertisement.

Uses PIL/Pillow for image generation.
"""

import io
from datetime import datetime
from typing import Optional, Tuple, TYPE_CHECKING
from dataclasses import dataclass
from logging_config import get_logger

logger = get_logger(__name__)

# For type checking only - avoid "possibly unbound" errors
if TYPE_CHECKING:
    from PIL import Image, ImageDraw, ImageFont
    from PIL.Image import Image as PILImage
    from PIL.ImageDraw import ImageDraw as PILImageDraw
    from PIL.ImageFont import FreeTypeFont

# Runtime import with error handling
try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    Image = None  # type: ignore[assignment]
    ImageDraw = None  # type: ignore[assignment]
    ImageFont = None  # type: ignore[assignment]
    logger.warning("PIL/Pillow not available. Image generation will be disabled.")


@dataclass
class EventImage:
    """Container for generated event image"""
    image_bytes: bytes
    event_type: str
    filename: str


class EventImageGenerator:
    """Generates shareable social media images for astronomical events"""

    # Image dimensions (Instagram story: 1080x1920, but we'll use flexible size)
    IMAGE_WIDTH = 1080
    IMAGE_HEIGHT = 1920

    # Color scheme - space theme
    BG_COLOR = (15, 15, 35)  # Dark blue-ish
    ACCENT_COLOR = (100, 200, 255)  # Light blue
    TEXT_COLOR = (255, 255, 255)  # White
    SECONDARY_TEXT_COLOR = (200, 200, 200)  # Light gray
    GITHUB_COLOR = (65, 131, 196)  # GitHub blue

    def __init__(self):
        """Initialize image generator"""
        if not HAS_PIL:
            raise ImportError("PIL/Pillow is required for image generation. Install with: pip install Pillow")

    def generate_eclipse_image(
        self,
        event_type: str,  # "Solar Eclipse" or "Lunar Eclipse"
        eclipse_type: str,  # "Total", "Partial", "Annular"
        peak_time: str,  # ISO format datetime
        obscuration: float,  # Percentage
        location: str,  # User location name
        visibility: bool,
        score: Optional[float] = None,
    ) -> EventImage:
        """
        Generate a shareable image for eclipse event - minimalist professional design
        """
        img = Image.new('RGB', (self.IMAGE_WIDTH, self.IMAGE_HEIGHT), (10, 20, 40))  # type: ignore[union-attr]
        draw = ImageDraw.Draw(img)  # type: ignore[union-attr]

        # Add gradient background
        self._add_gradient_background(img)

        # Parse event time
        event_dt: Optional[datetime] = None
        try:
            event_dt = datetime.fromisoformat(peak_time)
            date_str = event_dt.strftime("%B %d, %Y")
            time_str = event_dt.strftime("%H:%M")
        except Exception as e:
            logger.error(f"Failed to parse event time: {e}")
            date_str = "Date TBD"
            time_str = "Time TBD"

        is_solar = "Solar" in event_type
        accent_color = (255, 200, 80) if is_solar else (200, 220, 255)

        # Use simple default font
        font_large = self._get_font(44, bold=True)
        font_medium = self._get_font(36)
        font_small = self._get_font(28)
        font_tiny = self._get_font(20)

        y_pos = 100

        # Title
        if is_solar:
            title = "SOLAR ECLIPSE"
        else:
            title = "LUNAR ECLIPSE"
        
        bbox = draw.textbbox((0, 0), title, font=font_large)
        title_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((title_x, y_pos), title, font=font_large, fill=accent_color)

        # Eclipse type
        y_pos += 80
        type_text = f"{eclipse_type.upper()}"
        bbox = draw.textbbox((0, 0), type_text, font=font_medium)
        type_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((type_x, y_pos), type_text, font=font_medium, fill=(180, 200, 255))

        # Separator line
        y_pos += 70
        draw.line([(100, y_pos), (self.IMAGE_WIDTH - 100, y_pos)], fill=accent_color, width=2)

        # Location
        y_pos += 60
        loc_label = "Location:"
        draw.text((100, y_pos), loc_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), location, font=font_small, fill=self.TEXT_COLOR)

        # Visibility
        y_pos += 60
        vis_label = "Visible:"
        vis_value = "YES" if visibility else "NO"
        vis_color = (120, 255, 120) if visibility else (255, 120, 120)
        draw.text((100, y_pos), vis_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), vis_value, font=font_small, fill=vis_color)

        # Date
        y_pos += 60
        date_label = "Date:"
        draw.text((100, y_pos), date_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), date_str, font=font_small, fill=self.TEXT_COLOR)

        # Time
        y_pos += 60
        time_label = "Peak:"
        draw.text((100, y_pos), time_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), time_str, font=font_small, fill=self.TEXT_COLOR)

        # Obscuration
        y_pos += 60
        obs_label = "Obscuration:"
        obs_value = f"{obscuration:.1f}%"
        draw.text((100, y_pos), obs_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), obs_value, font=font_medium, fill=accent_color)

        # Score if available
        if score is not None:
            y_pos += 70
            score_label = "Astrophotography:"
            draw.text((100, y_pos), score_label, font=font_small, fill=(180, 180, 180))
            score_value = f"{score:.1f} / 10"
            draw.text((330, y_pos), score_value, font=font_medium, fill=accent_color)

        # Footer separator
        y_pos = self.IMAGE_HEIGHT - 200
        draw.line([(100, y_pos), (self.IMAGE_WIDTH - 100, y_pos)], fill=accent_color, width=2)

        # Footer
        y_pos += 50
        footer_text = "MyAstroBoard"
        bbox = draw.textbbox((0, 0), footer_text, font=font_small)
        footer_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((footer_x, y_pos), footer_text, font=font_small, fill=accent_color)

        y_pos += 50
        repo_text = "WorldOfGZ/myastroboard"
        bbox = draw.textbbox((0, 0), repo_text, font=font_tiny)
        repo_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((repo_x, y_pos), repo_text, font=font_tiny, fill=(150, 150, 150))

        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        filename = f"{eclipse_type.lower()}_eclipse_{event_dt.strftime('%Y%m%d') if event_dt else 'event'}.png"

        return EventImage(
            image_bytes=img_bytes.getvalue(),
            event_type=event_type,
            filename=filename,
        )

    def generate_aurora_image(
        self,
        visibility_percent: float,
        kp_index: float,
        forecast_date: str,
        location: str,
    ) -> EventImage:
        """
        Generate a shareable image for aurora event - minimalist professional design
        """
        img = Image.new('RGB', (self.IMAGE_WIDTH, self.IMAGE_HEIGHT), (10, 20, 40))  # type: ignore[union-attr]
        draw = ImageDraw.Draw(img)  # type: ignore[union-attr]

        # Add gradient background
        self._add_gradient_background(img)

        # Parse date
        event_dt: Optional[datetime] = None
        try:
            event_dt = datetime.fromisoformat(forecast_date)
            date_str = event_dt.strftime("%B %d, %Y")
        except Exception as e:
            logger.error(f"Failed to parse forecast date: {e}")
            date_str = "Date TBD"

        accent_color = (100, 220, 150)

        # Use simple default font
        font_large = self._get_font(44, bold=True)
        font_medium = self._get_font(36)
        font_small = self._get_font(28)
        font_tiny = self._get_font(20)

        y_pos = 100

        # Title
        title = "AURORA BOREALIS"
        bbox = draw.textbbox((0, 0), title, font=font_large)
        title_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((title_x, y_pos), title, font=font_large, fill=accent_color)

        # Separator line
        y_pos += 80
        draw.line([(100, y_pos), (self.IMAGE_WIDTH - 100, y_pos)], fill=accent_color, width=2)

        # Date
        y_pos += 60
        date_label = "Date:"
        draw.text((100, y_pos), date_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), date_str, font=font_small, fill=self.TEXT_COLOR)

        # Location
        y_pos += 60
        loc_label = "Location:"
        draw.text((100, y_pos), loc_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), location, font=font_small, fill=self.TEXT_COLOR)

        # Visibility percentage - LARGE and prominent
        y_pos += 100
        vis_label = "Visibility:"
        draw.text((100, y_pos), vis_label, font=font_small, fill=(180, 180, 180))
        vis_value = f"{visibility_percent:.0f}%"
        bbox = draw.textbbox((0, 0), vis_value, font=font_medium)
        vis_x = 330
        draw.text((vis_x, y_pos), vis_value, font=font_medium, fill=accent_color)

        # KP Index
        y_pos += 80
        kp_label = "Kp Index:"
        draw.text((100, y_pos), kp_label, font=font_small, fill=(180, 180, 180))
        kp_value = f"{kp_index:.1f}"
        draw.text((330, y_pos), kp_value, font=font_medium, fill=self.TEXT_COLOR)

        # Intensity
        y_pos += 80
        if kp_index >= 7:
            intensity = "STRONG"
            intensity_color = (255, 100, 100)
        elif kp_index >= 5:
            intensity = "MODERATE"
            intensity_color = (255, 200, 100)
        else:
            intensity = "WEAK"
            intensity_color = (100, 220, 150)

        intensity_label = "Activity:"
        draw.text((100, y_pos), intensity_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), intensity, font=font_small, fill=intensity_color)

        # Footer separator
        y_pos = self.IMAGE_HEIGHT - 200
        draw.line([(100, y_pos), (self.IMAGE_WIDTH - 100, y_pos)], fill=accent_color, width=2)

        # Footer
        y_pos += 50
        footer_text = "MyAstroBoard"
        bbox = draw.textbbox((0, 0), footer_text, font=font_small)
        footer_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((footer_x, y_pos), footer_text, font=font_small, fill=accent_color)

        y_pos += 50
        repo_text = "WorldOfGZ/myastroboard"
        bbox = draw.textbbox((0, 0), repo_text, font=font_tiny)
        repo_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((repo_x, y_pos), repo_text, font=font_tiny, fill=(150, 150, 150))

        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        filename = f"aurora_{event_dt.strftime('%Y%m%d') if event_dt else 'forecast'}.png"

        return EventImage(
            image_bytes=img_bytes.getvalue(),
            event_type="Aurora",
            filename=filename,
        )

    def generate_moon_phase_image(
        self,
        phase_name: str,
        phase_date: str,
        location: str,
    ) -> EventImage:
        """
        Generate a shareable image for moon phase event - minimalist professional design
        """
        img = Image.new('RGB', (self.IMAGE_WIDTH, self.IMAGE_HEIGHT), (10, 20, 40))  # type: ignore[union-attr]
        draw = ImageDraw.Draw(img)  # type: ignore[union-attr]

        self._add_gradient_background(img)

        # Parse date
        event_dt: Optional[datetime] = None
        try:
            event_dt = datetime.fromisoformat(phase_date)
            date_str = event_dt.strftime("%B %d, %Y")
        except Exception as e:
            logger.error(f"Failed to parse phase date: {e}")
            date_str = "Date TBD"

        accent_color = (200, 220, 255)

        # Use simple default font
        font_large = self._get_font(44, bold=True)
        font_medium = self._get_font(36)
        font_small = self._get_font(28)
        font_tiny = self._get_font(20)

        y_pos = 100

        # Title
        title = f"{phase_name.upper()}"
        bbox = draw.textbbox((0, 0), title, font=font_large)
        title_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((title_x, y_pos), title, font=font_large, fill=accent_color)

        # Separator line
        y_pos += 80
        draw.line([(100, y_pos), (self.IMAGE_WIDTH - 100, y_pos)], fill=accent_color, width=2)

        # Date
        y_pos += 60
        date_label = "Date:"
        draw.text((100, y_pos), date_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), date_str, font=font_small, fill=self.TEXT_COLOR)

        # Location
        y_pos += 60
        loc_label = "Location:"
        draw.text((100, y_pos), loc_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), location, font=font_small, fill=self.TEXT_COLOR)

        # Activity recommendation
        y_pos += 100
        activities = {
            "New Moon": "Perfect for deep-sky observations",
            "First Quarter": "Great for lunar studying",
            "Full Moon": "Ideal for lunar photography",
            "Last Quarter": "Good for crater observations",
        }
        activity = activities.get(phase_name, "Observe the night sky!")

        activity_label = "Best for:"
        draw.text((100, y_pos), activity_label, font=font_small, fill=(180, 180, 180))
        draw.text((330, y_pos), activity, font=font_small, fill=(150, 220, 255))

        # Footer separator
        y_pos = self.IMAGE_HEIGHT - 200
        draw.line([(100, y_pos), (self.IMAGE_WIDTH - 100, y_pos)], fill=accent_color, width=2)

        # Footer
        y_pos += 50
        footer_text = "MyAstroBoard"
        bbox = draw.textbbox((0, 0), footer_text, font=font_small)
        footer_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((footer_x, y_pos), footer_text, font=font_small, fill=accent_color)

        y_pos += 50
        repo_text = "WorldOfGZ/myastroboard"
        bbox = draw.textbbox((0, 0), repo_text, font=font_tiny)
        repo_x = (self.IMAGE_WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((repo_x, y_pos), repo_text, font=font_tiny, fill=(150, 150, 150))

        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        filename = f"moon_{phase_name.lower().replace(' ', '_')}_{event_dt.strftime('%Y%m%d') if event_dt else 'event'}.png"

        return EventImage(
            image_bytes=img_bytes.getvalue(),
            event_type="Moon Phase",
            filename=filename,
        )

    # =============================
    # Helper methods
    # =============================

    def _add_gradient_background(self, img: "PILImage") -> None:
        """Add a gradient background to simulate space"""
        pixels = img.load()
        for y in range(self.IMAGE_HEIGHT):
            # Gradient from dark blue at top to purple at bottom
            ratio = y / self.IMAGE_HEIGHT
            r = int(20 + ratio * 35)
            g = int(10 + ratio * 15)
            b = int(50 + ratio * 40)

            for x in range(self.IMAGE_WIDTH):
                pixels[x, y] = (r, g, b)  # type: ignore[index]

    def _add_github_footer(self, draw: "PILImageDraw") -> None:
        """Add GitHub branding footer"""
        footer_y = self.IMAGE_HEIGHT - 180

        # Draw footer background rectangle
        draw.rectangle(
            [(0, footer_y - 20), (self.IMAGE_WIDTH, self.IMAGE_HEIGHT)],
            fill=(15, 8, 40),  # Deep blue/purple
        )

        # Decorative line above footer
        draw.line([(50, footer_y - 30), (self.IMAGE_WIDTH - 50, footer_y - 30)], fill=self.ACCENT_COLOR, width=2)

        # GitHub icon and text
        github_text = "🔭 MyAstroBoard"
        repo_text = "WorldOfGZ/myastroboard"

        footer_font = self._get_font(32, bold=True)
        repo_font = self._get_font(24)

        # Draw MyAstroBoard name - centered
        github_bbox = draw.textbbox((0, 0), github_text, font=footer_font)
        github_x = (self.IMAGE_WIDTH - github_bbox[2] + github_bbox[0]) // 2
        draw.text((github_x, footer_y + 10), github_text, font=footer_font, fill=self.ACCENT_COLOR)

        # Draw GitHub repo - centered
        repo_bbox = draw.textbbox((0, 0), repo_text, font=repo_font)
        repo_x = (self.IMAGE_WIDTH - repo_bbox[2] + repo_bbox[0]) // 2
        draw.text((repo_x, footer_y + 65), repo_text, font=repo_font, fill=self.GITHUB_COLOR)

    def _get_font(self, size: int, bold: bool = False) -> "FreeTypeFont":
        """
        Get a font at specified size.
        Tries TrueType fonts first, falls back to default PIL font.
        Note: Default PIL font doesn't scale with size parameter.
        """
        try:
            # Windows first (most common for this project)
            font_name = "C:\\Windows\\Fonts\\"
            if bold:
                font_name += "arialbd.ttf"
            else:
                font_name += "arial.ttf"
            
            try:
                return ImageFont.truetype(font_name, size)  # type: ignore[attr-defined]
            except (IOError, OSError):
                pass
            
            # Try Linux
            font_paths = [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            ]

            for path in font_paths:
                try:
                    return ImageFont.truetype(path, size)  # type: ignore[attr-defined]
                except (IOError, OSError):
                    pass
            
            # macOS
            try:
                return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)  # type: ignore[attr-defined]
            except (IOError, OSError):
                pass

            # Fallback to default
            logger.info("Using PIL default font")
            return ImageFont.load_default()  # type: ignore[attr-defined]

        except Exception as e:
            logger.warning(f"Font loading error: {e}, using default")
            return ImageFont.load_default()  # type: ignore[attr-defined]


# Singleton instance
_image_generator = None


def get_image_generator() -> EventImageGenerator:
    """Get or create the image generator singleton"""
    global _image_generator
    if _image_generator is None:
        _image_generator = EventImageGenerator()
    return _image_generator
