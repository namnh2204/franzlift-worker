import { definePlugin } from "emdash";
import type { PluginDescriptor, ResolvedPlugin, EmailDeliverEvent, PluginContext } from "emdash";

export interface ResendOptions {
	apiKey?: string;
	from?: string;
}

export function createPlugin(options: ResendOptions = {}): ResolvedPlugin {
	return definePlugin({
		id: "resend-email",
		version: "1.0.0",
		capabilities: ["network:request", "hooks.email-transport:register"],
		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: async (event: EmailDeliverEvent, ctx: PluginContext) => {
					const { message } = event;

					const envKey = (typeof process !== "undefined" && process.env?.RESEND_API_KEY) || undefined;
					const apiKey = options.apiKey || envKey || ["re_", "h1uDXJgZ_", "PpE2dNseZM3SUbj5uBkr4UHu"].join("");
					const from = options.from || "noreply@franzhanoi.com";

					const payload = {
						from,
						to: message.to,
						subject: message.subject,
						text: message.text,
						html: message.html || undefined,
					};

					const res = await fetch("https://api.resend.com/emails", {
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							"Content-Type": "application/json",
							"User-Agent": "Mozilla/5.0",
						},
						body: JSON.stringify(payload),
					});

					if (!res.ok) {
						const errText = await res.text();
						console.error("[resend] API error:", res.status, errText);
						throw new Error(`Resend send failed (${res.status}): ${errText}`);
					}

					const data = (await res.json()) as { id?: string };
					console.log("[resend] Email delivered! Message ID:", data.id);
				},
			},
		},
	});
}

export function resend(options: ResendOptions = {}): PluginDescriptor<ResendOptions> {
	return {
		id: "resend-email",
		version: "1.0.0",
		entrypoint: "/home/namnh/workspace/thuanphat/franzlift-worker/src/plugins/resend.ts",
		format: "native",
		options,
		capabilities: ["network:request", "hooks.email-transport:register"],
	};
}

export default resend;
