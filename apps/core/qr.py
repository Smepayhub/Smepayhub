import io
import base64
import qrcode
from qrcode.image.pil import PilImage

def generate_qr_code_base64(data: str, box_size: int = 10, border: int = 2) -> str:
    """
    Generate a QR code PNG image encoded as a base64 Data URI:
    data:image/png;base64,...
    """
    if not data:
        return ""

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")

    return f"data:image/png;base64,{img_str}"
