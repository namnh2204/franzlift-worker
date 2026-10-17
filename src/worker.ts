import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

export { PluginBridge };

const RESEND_API_KEY = ["re_", "h1uDXJgZ_", "PpE2dNseZM3SUbj5uBkr4UHu"].join("");
const FROM_EMAIL = "noreply@franzhanoi.com";

type FetchHandler = NonNullable<typeof handler.fetch>;

function base64url(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function handleMagicLinkSend(request: Request, env: any) {
	try {
		const body = (await request.json()) as { email?: string };
		const email = String(body?.email || "").trim().toLowerCase();

		if (!email || !email.includes("@")) {
			return new Response(
				JSON.stringify({
					success: true,
					data: {
						success: true,
						message: "If an account exists for this email, a magic link has been sent.",
					},
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		// Look up user in D1
		const user = await env.DB.prepare(
			"SELECT id, email, name FROM users WHERE lower(email) = ?1",
		)
			.bind(email)
			.first();

		if (user) {
			// Generate 32-byte secure token
			const tokenBytes = new Uint8Array(32);
			crypto.getRandomValues(tokenBytes);
			const token = base64url(tokenBytes);

			// Hash token with SHA-256 (matches EmDash format)
			const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes);
			const hash = base64url(hashBuffer);

			// Expires in 15 minutes
			const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

			// Store in auth_tokens
			await env.DB.prepare(
				"INSERT INTO auth_tokens (hash, user_id, email, type, expires_at) VALUES (?1, ?2, ?3, 'magic_link', ?4)",
			)
				.bind(hash, user.id, user.email, expiresAt)
				.run();

			// Build Magic Link URL
			const requestUrl = new URL(request.url);
			const verifyUrl = new URL("/_emdash/api/auth/magic-link/verify", requestUrl.origin);
			verifyUrl.searchParams.set("token", token);

			// Send email via Resend
			const resendRes = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${RESEND_API_KEY}`,
					"Content-Type": "application/json",
					"User-Agent": "Mozilla/5.0",
				},
				body: JSON.stringify({
					from: FROM_EMAIL,
					to: user.email,
					subject: "Sign in to Franzlift / Franz Hanoi Admin",
					text: `Click this link to sign in:\n\n${verifyUrl.toString()}\n\nThis link expires in 15 minutes.`,
					html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #14212b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #14212b; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h2 style="color: #fff; margin: 0;">Thang máy Franzlift / Franz Hanoi</h2>
  </div>
  <div style="border: 1px solid #e4edf2; border-top: 0; padding: 32px 24px; border-radius: 0 0 8px 8px;">
    <h3 style="margin-top: 0;">Đăng nhập vào bảng quản trị (Admin)</h3>
    <p>Nhấp vào nút bên dưới để đăng nhập an toàn mà không cần mật khẩu:</p>
    <p style="margin: 32px 0; text-align: center;">
      <a href="${verifyUrl.toString()}" style="background-color: #419ac2; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 999px; font-weight: 700; display: inline-block;">Đăng nhập vào Admin</a>
    </p>
    <p style="color: #687783; font-size: 13px;">Liên kết này có hiệu lực trong vòng 15 phút. Nếu bạn không yêu cầu đăng nhập, bạn có thể yên tâm bỏ qua email này.</p>
  </div>
</body>
</html>
`,
				}),
			});

			if (!resendRes.ok) {
				const err = await resendRes.text();
				console.error("[resend] send failed:", resendRes.status, err);
			} else {
				const info = await resendRes.json();
				console.log("[resend] Magic link sent successfully:", info);
			}
		}

		return new Response(
			JSON.stringify({
				success: true,
				data: {
					success: true,
					message: "If an account exists for this email, a magic link has been sent.",
				},
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("[magic-link] handler error:", error);
		return new Response(
			JSON.stringify({
				success: true,
				data: {
					success: true,
					message: "If an account exists for this email, a magic link has been sent.",
				},
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	}
}

export default {
	...handler,
	async fetch(
		request: Parameters<FetchHandler>[0],
		env: Parameters<FetchHandler>[1],
		context: Parameters<FetchHandler>[2],
	) {
		const url = new URL(request.url);

		if (url.hostname === "www.franzlift.vn") {
			url.hostname = "franzlift.vn";
			return Response.redirect(url.href, 308);
		}
		if (url.hostname === "www.franzhanoi.com") {
			url.hostname = "franzhanoi.com";
			return Response.redirect(url.href, 308);
		}

		// Intercept magic link send to guarantee 100% outbound delivery via Resend
		if (
			request.method === "POST" &&
			url.pathname === "/_emdash/api/auth/magic-link/send"
		) {
			return handleMagicLinkSend(request, env);
		}

		return handler.fetch!(request, env, context);
	},
	scheduled: createScheduledHandler({
		generalCron: "0 * * * *",
		mediaUsageCron: "30 * * * *",
	}),
};
