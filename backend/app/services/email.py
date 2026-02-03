import secrets
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent
from app.config import settings

def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)

async def send_verification_email(to_email: str, token: str) -> bool:
    if not settings.SENDGRID_API_KEY:
        print(f"SendGrid not configured, token: {token}")
        return False
    
    verification_url = f"{settings.FRONTEND_URL}/verify?token={token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                        <tr>
                            <td style="padding: 40px 40px 32px; text-align: center;">
                                <img src="https://umnik.ai/logo.png" alt="Umnik.AI" width="48" height="48" style="margin-bottom: 24px;">
                                <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1a1a2e;">
                                    Добро пожаловать в Umnik.AI!
                                </h1>
                                <p style="margin: 0 0 32px; font-size: 15px; line-height: 1.6; color: #64748b;">
                                    Для завершения регистрации подтвердите ваш email адрес, нажав на кнопку ниже.
                                </p>
                                <a href="{verification_url}" style="display: inline-block; padding: 14px 32px; background-color: #1a1a2e; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 50px;">
                                    Подтвердить email
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 24px 40px; background-color: #f8f8fa; text-align: center;">
                                <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                                    Если вы не регистрировались на Umnik.AI, просто проигнорируйте это письмо.
                                </p>
                            </td>
                        </tr>
                    </table>
                    <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8;">
                        © 2026 Umnik.AI. Все права защищены.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    message = Mail(
        from_email=Email(settings.SENDGRID_FROM_EMAIL, "Umnik.AI"),
        to_emails=To(to_email),
        subject="Подтвердите ваш email — Umnik.AI",
        html_content=HtmlContent(html_content)
    )
    
    try:
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code in [200, 201, 202]
    except Exception as e:
        print(f"SendGrid error: {e}")
        return False